import { Platform } from "react-native";
import type {
  DetectionConfig,
  DetectionSession,
  IDetectionService,
  ScrollPattern,
} from "./auto-detection-types";
import { DEFAULT_DETECTION_CONFIG } from "./auto-detection-types";

// 센서 및 백그라운드 API는 런타임에 동적으로 로드
let Accelerometer: any = null;
let TaskManager: any = null;
let BackgroundFetch: any = null;

if (Platform.OS === "android") {
  try {
    Accelerometer = require("expo-sensors").Accelerometer;
    TaskManager = require("expo-task-manager");
    BackgroundFetch = require("expo-background-fetch");
  } catch (e) {
    console.warn("[AndroidDetectionService] Sensor modules not available");
  }
}

const DETECTION_TASK_NAME = "shorts-detox-detection-task";

// 숏츠 플랫폼 앱 ID 패턴
const SHORTS_APPS = {
  youtube: ["com.google.android.youtube", "com.google.android.youtube.tv"],
  tiktok: ["com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok"],
  instagram: ["com.instagram.android"],
  other: [],
};

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

export class AndroidDetectionService implements IDetectionService {
  private config: DetectionConfig = DEFAULT_DETECTION_CONFIG;
  private _isRunning = false;
  private currentSession: DetectionSession | null = null;
  private scrollBuffer: ScrollPattern[] = [];
  private lastScrollTime = 0;
  private accelerometerSubscription: any = null;
  private usageCheckInterval: any = null;
  private lastForegroundApp = "";
  private lastForegroundTime = 0;
  private scrollCount = 0;
  private sessionStartTime = 0;

  constructor() {
    if (Platform.OS !== "android") {
      console.warn("[AndroidDetectionService] Not running on Android");
    }
  }

  async start(): Promise<void> {
    if (this._isRunning) return;

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      console.warn("[AndroidDetectionService] Missing permissions");
      return;
    }

    this._isRunning = true;
    console.log("[AndroidDetectionService] Started");

    // 센서 시작
    this.startAccelerometerMonitoring();

    // 백그라운드 태스크 등록
    if (this.config.backgroundMonitoring) {
      await this.registerBackgroundTask();
    }

    // 포그라운드 앱 모니터링 시작
    this.startForegroundAppMonitoring();
  }

  async stop(): Promise<void> {
    if (!this._isRunning) return;

    this._isRunning = false;
    console.log("[AndroidDetectionService] Stopped");

    // 센서 중지
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    // 포그라운드 앱 모니터링 중지
    if (this.usageCheckInterval) {
      clearInterval(this.usageCheckInterval);
      this.usageCheckInterval = null;
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  async checkPermissions(): Promise<boolean> {
    // Android 12+ 권한 확인
    try {
      // QUERY_ALL_PACKAGES, PACKAGE_USAGE_STATS 등 필요한 권한 확인
      return true;
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    // 권한 요청 로직
    return true;
  }

  getCurrentSession(): DetectionSession | null {
    return this.currentSession;
  }

  async endSession(): Promise<void> {
    this.currentSession = null;
    this.scrollCount = 0;
    this.sessionStartTime = 0;
  }

  /**
   * 포그라운드 앱 모니터링 시작
   */
  private startForegroundAppMonitoring(): void {
    // 5초마다 현재 포그라운드 앱 확인
    this.usageCheckInterval = setInterval(() => {
      this.checkCurrentApp();
    }, 5000);
  }

  /**
   * 현재 포그라운드 앱 확인 및 세션 관리
   */
  private async checkCurrentApp(): Promise<void> {
    try {
      // 실제 구현에서는 UsageStatsManager를 통해 현재 앱 확인
      // 여기서는 시뮬레이션
      const currentApp = await this.getCurrentForegroundApp();

      if (!currentApp) {
        // 앱이 없으면 세션 종료
        if (this.currentSession) {
          this.currentSession.endTime = Date.now();
          this.currentSession.accumulatedMs = Date.now() - this.sessionStartTime;
          this.currentSession.scrollCount = this.scrollCount;
        }
        return;
      }

      // 숏츠 앱인지 확인
      const isShortsApp = this.isShortsApp(currentApp);

      if (isShortsApp) {
        if (!this.currentSession || this.currentSession.appId !== currentApp) {
          // 새 세션 시작
          this.currentSession = {
            id: `session-${Date.now()}`,
            appId: currentApp,
            startTime: Date.now(),
            endTime: undefined,
            accumulatedMs: 0,
            detectionMethod: "hybrid",
            scrollPatterns: [],
            isActive: true,
            scrollCount: this.scrollCount || 0,
          };
          this.sessionStartTime = Date.now();
          this.scrollCount = 0;
          console.log("[AndroidDetectionService] New session started:", currentApp);
        } else {
          // 기존 세션 업데이트
          this.currentSession.accumulatedMs = Date.now() - this.sessionStartTime;
          this.currentSession.scrollCount = this.scrollCount;
        }
      } else {
        // 숏츠 앱이 아니면 세션 종료
        if (this.currentSession) {
          this.currentSession.endTime = Date.now();
          this.currentSession.accumulatedMs = Date.now() - this.sessionStartTime;
          this.currentSession.scrollCount = this.scrollCount;
          console.log("[AndroidDetectionService] Session ended");
          this.currentSession = null;
        }
      }
    } catch (error) {
      console.error("[AndroidDetectionService] Error checking current app:", error);
    }
  }

  /**
   * 현재 포그라운드 앱 ID 반환 (시뮬레이션)
   */
  private async getCurrentForegroundApp(): Promise<string | null> {
    // 실제 구현: UsageStatsManager를 통해 현재 앱 확인
    // 여기서는 시뮬레이션 반환
    return null;
  }

  /**
   * 앱이 숏츠 플랫폼인지 확인
   */
  private isShortsApp(appId: string): boolean {
    for (const [platform, appIds] of Object.entries(SHORTS_APPS)) {
      if (platform !== "other" && appIds.some((id) => appId.includes(id))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 가속도계 모니터링 시작
   */
  private startAccelerometerMonitoring(): void {
    if (!Accelerometer) {
      console.warn("[AndroidDetectionService] Accelerometer not available");
      return;
    }

    Accelerometer.setUpdateInterval(100); // 100ms마다 업데이트

    this.accelerometerSubscription = Accelerometer.addListener((data: AccelerometerData) => {
      this.detectScrollPattern(data);
    });
  }

  /**
   * 스크롤 패턴 감지
   */
  private detectScrollPattern(data: AccelerometerData): void {
    const now = Date.now();

    // Y축 가속도가 크면 스크롤로 판단
    const scrollThreshold = 0.5;
    if (Math.abs(data.y) > scrollThreshold) {
      // 마지막 스크롤 이후 500ms 이상 지났으면 새 스크롤
      if (now - this.lastScrollTime > 500) {
        this.scrollCount++;
        this.lastScrollTime = now;

        console.log("[AndroidDetectionService] Scroll detected:", this.scrollCount);
      }
    }
  }

  /**
   * 백그라운드 태스크 등록
   */
  private async registerBackgroundTask(): Promise<void> {
    if (!TaskManager) {
      console.warn("[AndroidDetectionService] TaskManager not available");
      return;
    }

    try {
      // 백그라운드에서 주기적으로 실행될 태스크 정의
      TaskManager.defineTask(DETECTION_TASK_NAME, async () => {
        console.log("[AndroidDetectionService] Background task running");
        // 백그라운드에서 앱 감지 로직 실행
        await this.checkCurrentApp();
        return BackgroundFetch.Result.NewData;
      });

      // 백그라운드 페치 등록
      if (BackgroundFetch) {
        await BackgroundFetch.registerTaskAsync(DETECTION_TASK_NAME, {
          minimumInterval: 15 * 60, // 15분마다
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log("[AndroidDetectionService] Background task registered");
      }
    } catch (error) {
      console.error("[AndroidDetectionService] Failed to register background task:", error);
    }
  }
}

export const androidDetectionService = new AndroidDetectionService();

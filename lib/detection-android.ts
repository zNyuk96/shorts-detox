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

    // 사용량 체크 중지
    if (this.usageCheckInterval) {
      clearInterval(this.usageCheckInterval as any);
      this.usageCheckInterval = null;
    }

    // 현재 세션 종료
    if (this.currentSession) {
      await this.endSession();
    }
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  async checkPermissions(): Promise<boolean> {
    // Android 12+: QUERY_ALL_PACKAGES 권한 필요
    // 실제 권한 체크는 네이티브 모듈에서 처리
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    // 네이티브 권한 요청 다이얼로그
    // 실제 구현은 네이티브 모듈에서 처리
    return true;
  }

  getCurrentSession(): DetectionSession | null {
    return this.currentSession;
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.isActive = false;

      // 세션 저장 (store에 저장)
    console.log("[AndroidDetectionService] Session ended:", this.currentSession?.id);

    this.currentSession = null;
    this.scrollBuffer = [];
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private startAccelerometerMonitoring(): void {
    if (!Accelerometer) {
      console.warn("[AndroidDetectionService] Accelerometer not available");
      return;
    }

    // 센서 샘플링 레이트 설정
    Accelerometer.setUpdateInterval(1000 / this.config.sensorSamplingRate);

    this.accelerometerSubscription = Accelerometer.addListener(
      (data: AccelerometerData) => {
        this.processAccelerometerData(data);
      }
    );

    // 포그라운드 앱 체크 (1초마다)
    this.usageCheckInterval = setInterval(() => {
      this.checkForegroundApp();
    }, 1000);
  }

  private processAccelerometerData(data: AccelerometerData): void {
    // 가속도 크기 계산 (m/s²)
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // 중력 제거 (약 9.8 m/s²)
    const adjustedMagnitude = Math.abs(magnitude - 9.8);

    // 임계값 초과 시 스크롤 감지
    if (adjustedMagnitude > this.config.scrollThreshold) {
      const now = Date.now();

      // 스크롤 방향 판단 (간단한 휴리스틱)
      let direction: "up" | "down" | "left" | "right" = "down";
      if (Math.abs(data.y) > Math.abs(data.x)) {
        direction = data.y > 0 ? "down" : "up";
      } else {
        direction = data.x > 0 ? "right" : "left";
      }

      // 스크롤 패턴 기록
      const pattern: ScrollPattern = {
        timestamp: now,
        direction,
        magnitude: adjustedMagnitude,
        consecutiveCount: this.getConsecutiveScrollCount(direction),
      };

      this.scrollBuffer.push(pattern);
      this.lastScrollTime = now;

      // 연속 스크롤 감지 시 세션 시작
      if (
        pattern.consecutiveCount >= this.config.consecutiveScrollCount &&
        !this.currentSession
      ) {
        this.startNewSession("scroll");
      }
    }
  }

  private getConsecutiveScrollCount(direction: string): number {
    let count = 1;
    for (let i = this.scrollBuffer.length - 1; i >= 0; i--) {
      if (this.scrollBuffer[i].direction === direction) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private checkForegroundApp(): void {
    // 네이티브 모듈에서 포그라운드 앱 정보 가져오기
    // 여기서는 시뮬레이션
    const foregroundApp = this.getForegroundAppSimulated();

    if (foregroundApp !== this.lastForegroundApp) {
      // 앱 전환 감지
      if (this.lastForegroundApp && this.currentSession) {
        const durationMs = Date.now() - this.lastForegroundTime;
        if (durationMs >= this.config.minDurationMs && durationMs <= this.config.maxDurationMs) {
          this.currentSession.accumulatedMs += durationMs;
        }
      }

      this.lastForegroundApp = foregroundApp;
      this.lastForegroundTime = Date.now();

      // 새로운 숏츠 앱 감지 시 세션 시작
      if (this.isShortsApp(foregroundApp) && !this.currentSession) {
        this.startNewSession("usage");
      }
    }
  }

  private getForegroundAppSimulated(): string {
    // 실제 구현에서는 네이티브 모듈 호출
    // UsageStatsManager.queryUsageStats() 사용
    return "com.google.android.youtube";
  }

  private isShortsApp(appId: string): boolean {
    return this.config.targetApps.includes(appId);
  }

  private startNewSession(method: "scroll" | "usage" | "hybrid"): void {
    this.currentSession = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      appId: this.lastForegroundApp,
      startTime: Date.now(),
      accumulatedMs: 0,
      detectionMethod: method,
      scrollPatterns: [...this.scrollBuffer],
      isActive: true,
    };

    console.log("[AndroidDetectionService] New session started:", this.currentSession?.id);
  }

  private async registerBackgroundTask(): Promise<void> {
    if (!TaskManager || !BackgroundFetch) {
      console.warn("[AndroidDetectionService] Background task modules not available");
      return;
    }

    try {
      TaskManager.defineTask(DETECTION_TASK_NAME, async () => {
        // 백그라운드에서 주기적으로 실행되는 태스크
        console.log("[AndroidDetectionService] Background task running");
        this.checkForegroundApp();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });

      await BackgroundFetch.registerTaskAsync(DETECTION_TASK_NAME, {
        minimumInterval: 15 * 60, // 15분마다
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log("[AndroidDetectionService] Background task registered");
    } catch (error) {
      console.error("[AndroidDetectionService] Failed to register background task:", error);
    }
  }
}

export const androidDetectionService = new AndroidDetectionService();

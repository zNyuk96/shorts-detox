import { Platform, AppState, type AppStateStatus } from "react-native";
import type {
  DetectionConfig,
  DetectionSession,
  IDetectionService,
  ScrollPattern,
} from "./auto-detection-types";
import { DEFAULT_DETECTION_CONFIG } from "./auto-detection-types";

// 모션 센서 API는 런타임에 동적으로 로드
let DeviceMotion: any = null;

if (Platform.OS === "ios") {
  try {
    DeviceMotion = require("expo-sensors").DeviceMotion;
  } catch (e) {
    console.warn("[iOSDetectionService] DeviceMotion not available");
  }
}

export class iOSDetectionService implements IDetectionService {
  private config: DetectionConfig = DEFAULT_DETECTION_CONFIG;
  private _isRunning = false;
  private currentSession: DetectionSession | null = null;
  private scrollBuffer: ScrollPattern[] = [];
  private lastScrollTime = 0;
  private motionSubscription: any = null;
  private appStateSubscription: any = null;
  private lastAppState: AppStateStatus = "active";
  private appForegroundTime = 0;
  private targetAppsSimulated = [
    "com.google.youtube.shorts",
    "com.tiktok.shorts",
    "com.instagram.reels",
  ];

  constructor() {
    if (Platform.OS !== "ios") {
      console.warn("[iOSDetectionService] Not running on iOS");
    }
  }

  async start(): Promise<void> {
    if (this._isRunning) return;

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      console.warn("[iOSDetectionService] Missing permissions");
      return;
    }

    this._isRunning = true;
    console.log("[iOSDetectionService] Started");

    // 모션 센서 시작
    this.startMotionMonitoring();

    // 앱 상태 모니터링 시작
    this.startAppStateMonitoring();
  }

  async stop(): Promise<void> {
    if (!this._isRunning) return;

    this._isRunning = false;
    console.log("[iOSDetectionService] Stopped");

    // 모션 센서 중지
    if (this.motionSubscription) {
      this.motionSubscription.remove();
      this.motionSubscription = null;
    }

    // 앱 상태 모니터링 중지
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
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
    // iOS에서는 모션 센서 접근이 기본적으로 허용됨
    // 사용자가 설정에서 비활성화할 수 있음
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    // iOS 14+: Motion & Fitness 권한 필요
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

    // 앱 포그라운드 시간 추가
    if (this.lastAppState === "active") {
      const durationMs = Date.now() - this.appForegroundTime;
      if (durationMs >= this.config.minDurationMs && durationMs <= this.config.maxDurationMs) {
        this.currentSession.accumulatedMs += durationMs;
      }
    }

    console.log("[iOSDetectionService] Session ended:", this.currentSession?.id);

    this.currentSession = null;
    this.scrollBuffer = [];
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private startMotionMonitoring(): void {
    if (!DeviceMotion) {
      console.warn("[iOSDetectionService] DeviceMotion not available");
      return;
    }

    // 센서 샘플링 레이트 설정
    DeviceMotion.setUpdateInterval(1000 / this.config.sensorSamplingRate);

    this.motionSubscription = DeviceMotion.addListener((data: any) => {
      this.processMotionData(data);
    });
  }

  private processMotionData(data: any): void {
    // DeviceMotion에서 가속도 및 회전 정보 추출
    const { acceleration, rotation } = data;

    if (!acceleration) return;

    // 가속도 크기 계산 (m/s²)
    const magnitude = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2
    );

    // 중력 제거 (약 9.8 m/s²)
    const adjustedMagnitude = Math.abs(magnitude - 9.8);

    // 임계값 초과 시 스크롤 감지
    if (adjustedMagnitude > this.config.scrollThreshold) {
      const now = Date.now();

      // 스크롤 방향 판단
      let direction: "up" | "down" | "left" | "right" = "down";
      if (Math.abs(acceleration.y) > Math.abs(acceleration.x)) {
        direction = acceleration.y > 0 ? "down" : "up";
      } else {
        direction = acceleration.x > 0 ? "right" : "left";
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
        !this.currentSession &&
        this.lastAppState === "active"
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

  private startAppStateMonitoring(): void {
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      this.handleAppStateChange(state);
    });

    // 초기 상태 설정
    this.lastAppState = AppState.currentState;
    this.appForegroundTime = Date.now();
  }

  private handleAppStateChange(state: AppStateStatus): void {
    if (state === "active" && this.lastAppState !== "active") {
      // 앱이 포그라운드로 돌아옴
      this.appForegroundTime = Date.now();

      // 숏츠 앱 감지 시 세션 시작
      if (!this.currentSession) {
        this.startNewSession("usage");
      }
    } else if (state !== "active" && this.lastAppState === "active") {
      // 앱이 백그라운드로 이동
      if (this.currentSession) {
        const durationMs = Date.now() - this.appForegroundTime;
        if (durationMs >= this.config.minDurationMs && durationMs <= this.config.maxDurationMs) {
          this.currentSession.accumulatedMs += durationMs;
        }
      }
    }

    this.lastAppState = state;
  }

  private startNewSession(method: "scroll" | "usage" | "hybrid"): void {
    this.currentSession = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      appId: this.getTargetAppSimulated(),
      startTime: Date.now(),
      accumulatedMs: 0,
      detectionMethod: method,
      scrollPatterns: [...this.scrollBuffer],
      isActive: true,
    };

    console.log("[iOSDetectionService] New session started:", this.currentSession?.id);
  }

  private getTargetAppSimulated(): string {
    // 실제 구현에서는 현재 활성 앱 정보 가져오기
    return this.targetAppsSimulated[0];
  }
}

export const iosDetectionService = new iOSDetectionService();

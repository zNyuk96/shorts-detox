import { Platform } from "react-native";
import type { IDetectionService, DetectionSession, DetectionConfig } from "./auto-detection-types";
import { androidDetectionService } from "./detection-android";
import { iosDetectionService } from "./detection-ios";
import { addSession, getTodayDateString } from "./store";

/**
 * 통합 감지 서비스
 * - Android: UsageStatsManager + 가속도계
 * - iOS: AppState + 모션 센서
 * - 플랫폼에 따라 자동으로 적절한 서비스 선택
 */
class DetectionServiceManager {
  private service: IDetectionService | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    if (this.isInitialized) return;

    if (Platform.OS === "android") {
      this.service = androidDetectionService;
      console.log("[DetectionServiceManager] Using Android detection service");
    } else if (Platform.OS === "ios") {
      this.service = iosDetectionService;
      console.log("[DetectionServiceManager] Using iOS detection service");
    } else {
      console.warn("[DetectionServiceManager] Unsupported platform:", Platform.OS);
    }

    this.isInitialized = true;
  }

  /**
   * 감지 서비스 시작
   */
  async start(): Promise<void> {
    if (!this.service) {
      console.warn("[DetectionServiceManager] Service not initialized");
      return;
    }
    await this.service.start();
  }

  /**
   * 감지 서비스 중지
   */
  async stop(): Promise<void> {
    if (!this.service) return;
    await this.service.stop();
  }

  /**
   * 감지 서비스 실행 중 여부
   */
  isRunning(): boolean {
    return this.service?.isRunning() ?? false;
  }

  /**
   * 권한 확인
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.service) return false;
    return await this.service.checkPermissions();
  }

  /**
   * 권한 요청
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.service) return false;
    return await this.service.requestPermissions();
  }

  /**
   * 현재 세션 조회
   */
  getCurrentSession(): DetectionSession | null {
    return this.service?.getCurrentSession() ?? null;
  }

  /**
   * 세션 종료 및 저장
   */
  async endSession(): Promise<void> {
    if (!this.service) return;

    const session = this.service.getCurrentSession();
    if (!session) return;

    // 세션을 store에 저장
    await this.saveSession(session);

    // 서비스의 세션 종료
    await this.service.endSession();
  }

  /**
   * 감지된 세션을 store에 저장
   */
  private async saveSession(session: DetectionSession): Promise<void> {
    if (session.accumulatedMs < 1000) {
      // 1초 미만은 저장하지 않음
      return;
    }

    try {
      await addSession({
        id: session.id,
        platform: this.mapAppIdToPlatform(session.appId),
        startTime: session.startTime,
        endTime: session.endTime ?? Date.now(),
        durationMs: session.accumulatedMs,
        date: getTodayDateString(),
      });

      console.log(
        "[DetectionServiceManager] Session saved:",
        session.id,
        `(${session.accumulatedMs}ms)`
      );
    } catch (error) {
      console.error("[DetectionServiceManager] Failed to save session:", error);
    }
  }

  /**
   * 앱 ID를 플랫폼으로 매핑
   */
  private mapAppIdToPlatform(appId: string): "youtube" | "tiktok" | "instagram" | "other" {
    if (appId.includes("youtube")) return "youtube";
    if (appId.includes("tiktok") || appId.includes("musically")) return "tiktok";
    if (appId.includes("instagram")) return "instagram";
    return "other";
  }
}

export const detectionService = new DetectionServiceManager();

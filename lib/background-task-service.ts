import { Platform, AppState, AppStateStatus } from "react-native";
import { realAppDetectionService } from "./real-app-detection";
import { loadSessions, getTodayDateString, loadSettings } from "./store";

/**
 * 백그라운드 모니터링 작업
 * - 실시간으로 시청 시간 누적
 * - 임계값 초과 시 알림 발송
 */
class BackgroundTaskService {
  private isTaskRegistered = false;
  private lastCheckTime = 0;
  private checkIntervalMs = 5000; // 5초마다 체크
  private monitoringInterval: any = null;
  private onThresholdExceeded: ((durationMs: number) => void) | null = null;

  /**
   * 백그라운드 모니터링 시작
   */
  async startMonitoring(): Promise<void> {
    if (this.isTaskRegistered) return;

    try {
      this.isTaskRegistered = true;

      // 정기적으로 모니터링 실행
      this.monitoringInterval = setInterval(() => {
        this.monitorShortsUsage();
      }, this.checkIntervalMs);

      console.log("[BackgroundTask] Background monitoring started");
    } catch (error) {
      console.error("[BackgroundTask] Error starting background monitoring:", error);
      this.isTaskRegistered = false;
    }
  }

  /**
   * 백그라운드 모니터링 중단
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isTaskRegistered) return;

    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      this.isTaskRegistered = false;
      console.log("[BackgroundTask] Background monitoring stopped");
    } catch (error) {
      console.error("[BackgroundTask] Error stopping background monitoring:", error);
    }
  }

  /**
   * 쇼츠 사용 모니터링
   * - 현재 앱 감지
   * - 스크롤 패턴 확인
   * - 시청 시간 누적
   * - 임계값 초과 체크
   */
  private async monitorShortsUsage(): Promise<void> {
    const now = Date.now();

    // 5초 간격으로만 체크
    if (now - this.lastCheckTime < this.checkIntervalMs) {
      return;
    }

    this.lastCheckTime = now;

    try {
      const currentApp = realAppDetectionService.getCurrentApp();
      const scrollCount = realAppDetectionService.getScrollCount();
      const sessionDuration = realAppDetectionService.getSessionDuration();

      // 쇼츠 앱이 아니면 무시
      if (!currentApp?.isShortsApp) {
        return;
      }

      // 스크롤 패턴 확인 (최소 1회 이상 스크롤)
      if (scrollCount === 0) {
        return;
      }

      console.log(
        "[BackgroundTask] Monitoring:",
        currentApp.appName,
        `Duration: ${sessionDuration}ms, Scrolls: ${scrollCount}`
      );

      // 임계값 체크
      await this.checkThreshold(sessionDuration);
    } catch (error) {
      console.error("[BackgroundTask] Error monitoring shorts usage:", error);
    }
  }

  /**
   * 임계값 체크
   */
  private async checkThreshold(durationMs: number): Promise<void> {
    try {
      const settings = await loadSettings();
      const thresholdMs = (settings.alertThresholdMinutes || 30) * 60 * 1000;

      // 임계값 초과 확인
      if (durationMs >= thresholdMs) {
        console.log(
          "[BackgroundTask] Threshold exceeded!",
          `${durationMs}ms >= ${thresholdMs}ms`
        );

        // 콜백 실행
        if (this.onThresholdExceeded) {
          this.onThresholdExceeded(durationMs);
        }
      }
    } catch (error) {
      console.error("[BackgroundTask] Error checking threshold:", error);
    }
  }

  /**
   * 임계값 초과 콜백 등록
   */
  setOnThresholdExceeded(callback: (durationMs: number) => void): void {
    this.onThresholdExceeded = callback;
  }

  /**
   * 오늘의 총 시청 시간 조회
   */
  async getTodayTotalWatchTime(): Promise<number> {
    try {
      const sessions = await loadSessions();
      const today = getTodayDateString();

      const todayMs = sessions
        .filter((s) => s.date === today && s.isAutoDetected)
        .reduce((sum, s) => sum + s.durationMs, 0);

      return todayMs;
    } catch (error) {
      console.error("[BackgroundTask] Error getting today watch time:", error);
      return 0;
    }
  }

  /**
   * 백그라운드 작업 상태 확인
   */
  isRunning(): boolean {
    return this.isTaskRegistered;
  }
}

export const backgroundTaskService = new BackgroundTaskService();

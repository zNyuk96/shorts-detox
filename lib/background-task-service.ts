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
   * - 현재 포그라운드 앱 감지 (유튜브/인스타/틱톡 등)
   * - 스크롤 패턴(1s~1분 간격) 유효 시청 시간만 누적
   * - 오늘 저장된 세션 + 현재 세션 유효 시간 합으로 임계값 체크
   */
  private async monitorShortsUsage(): Promise<void> {
    const now = Date.now();

    if (now - this.lastCheckTime < this.checkIntervalMs) return;
    this.lastCheckTime = now;

    try {
      const todayStoredMs = await this.getTodayTotalWatchTime();
      const totalTodayMs = todayStoredMs;

      await this.checkThreshold(totalTodayMs);
    } catch (error) {
      console.error("[BackgroundTask] Error monitoring shorts usage:", error);
    }
  }

  /**
   * 임계값 체크 (오늘 누적 시청 시간 기준)
   * 초과 시 알림 + pending detox 설정 + 콜백(포그라운드 시 디톡스 페이지 오픈용)
   */
  private async checkThreshold(totalTodayMs: number): Promise<void> {
    try {
      const settings = await loadSettings();
      const thresholdMs = (settings.alertThresholdMinutes || 30) * 60 * 1000;

      if (totalTodayMs < thresholdMs) return;

      console.log(
        "[BackgroundTask] Threshold exceeded!",
        `${totalTodayMs}ms >= ${thresholdMs}ms`
      );

      const { setPendingDetox } = await import("./pending-detox");
      await setPendingDetox(totalTodayMs, thresholdMs);

      const thresholdMinutes = Math.floor(thresholdMs / 60000);
      const { notificationService } = await import("./notification-service");
      await notificationService.checkAndSendAlert(totalTodayMs, thresholdMinutes);

      if (this.onThresholdExceeded) {
        this.onThresholdExceeded(totalTodayMs);
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

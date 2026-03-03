import { AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * 포그라운드 강제 전환 서비스
 * - 백그라운드에서 시청 시간 임계값 초과 감지
 * - 앱을 포그라운드로 전환하여 Recovery 페이지 표시
 */

interface ForegroundCheckState {
  lastCheckTime: number;
  isMonitoring: boolean;
  appState: AppStateStatus;
}

export class ForegroundService {
  private state: ForegroundCheckState = {
    lastCheckTime: 0,
    isMonitoring: false,
    appState: "active",
  };

  private appStateSubscription: any = null;
  private onThresholdExceeded: ((watchMs: number, thresholdMs: number) => void) | null = null;

  /**
   * 서비스 시작
   */
  start(onThresholdExceeded: (watchMs: number, thresholdMs: number) => void): void {
    if (this.state.isMonitoring) return;

    this.onThresholdExceeded = onThresholdExceeded;
    this.state.isMonitoring = true;

    // 앱 상태 변화 감지
    this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange.bind(this));

    console.log("[ForegroundService] Started");
  }

  /**
   * 서비스 중지
   */
  stop(): void {
    if (!this.state.isMonitoring) return;

    this.state.isMonitoring = false;

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * 앱 상태 변화 핸들러
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    this.state.appState = nextAppState;
  }

  /**
   * 임계값 초과 시: pending detox 저장 + 진동 + 콜백 실행
   * 알림 발송은 notificationService.checkAndSendAlert()에서 단일 처리
   */
  async triggerRecovery(watchMs: number, thresholdMs: number): Promise<void> {
    try {
      const { setPendingDetox } = await import("./pending-detox");
      await setPendingDetox(watchMs, thresholdMs);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      if (this.onThresholdExceeded) {
        this.onThresholdExceeded(watchMs, thresholdMs);
      }
    } catch (error) {
      console.error("[ForegroundService] Failed to trigger recovery:", error);
    }
  }

  /**
   * 현재 앱 상태 반환
   */
  getAppState(): AppStateStatus {
    return this.state.appState;
  }

  /**
   * 모니터링 상태 반환
   */
  isMonitoring(): boolean {
    return this.state.isMonitoring;
  }
}

export const foregroundService = new ForegroundService();

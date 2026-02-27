import { AppState, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
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
  private checkInterval: any = null;
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

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log("[ForegroundService] Stopped");
  }

  /**
   * 앱 상태 변화 핸들러
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    this.state.appState = nextAppState;

    if (nextAppState === "background") {
      console.log("[ForegroundService] App moved to background");
      // 백그라운드에서 주기적으로 임계값 확인
      this.startBackgroundCheck();
    } else if (nextAppState === "active") {
      console.log("[ForegroundService] App moved to foreground");
      // 포그라운드에서는 체크 중지
      this.stopBackgroundCheck();
    }
  }

  /**
   * 백그라운드 체크 시작
   */
  private startBackgroundCheck(): void {
    if (this.checkInterval) return;

    // 30초마다 체크
    this.checkInterval = setInterval(() => {
      // 이 메서드는 백그라운드에서 호출되므로
      // 실제 감지는 detection-service에서 처리
      console.log("[ForegroundService] Background check tick");
    }, 30000);
  }

  /**
   * 백그라운드 체크 중지
   */
  private stopBackgroundCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 임계값 초과 시 포그라운드로 강제 전환
   */
  async triggerRecovery(watchMs: number, thresholdMs: number): Promise<void> {
    try {
      // 진동 피드백
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // 알림 발송 (사용자에게 알림)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🛑 주의력 향상 시간",
          body: "시청 시간 임계값을 초과했습니다. 주의력을 회복해보세요!",
          sound: true,
          badge: 1,
          data: {
            type: "recovery",
            watchMs,
            thresholdMs,
          },
        },
        trigger: null,
      });

      // 콜백 실행 (Recovery 페이지로 이동)
      if (this.onThresholdExceeded) {
        this.onThresholdExceeded(watchMs, thresholdMs);
      }

      console.log("[ForegroundService] Recovery triggered");
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

import * as Notifications from "expo-notifications";
import { getTodayDateString } from "./store";

/**
 * 알람 서비스
 * - 시청 시간이 임계값을 초과할 때 푸시 알람 발송
 * - 마지막 알람 시간을 추적하여 중복 알람 방지
 */

interface AlertState {
  lastAlertTime: number;
  lastAlertWatchMs: number;
  lastAlertDate: string;
}

const ALERT_STATE_KEY = "@shorts_detox/alert_state";

export class NotificationService {
  private alertState: AlertState = {
    lastAlertTime: 0,
    lastAlertWatchMs: 0,
    lastAlertDate: "",
  };

  constructor() {
    this.loadAlertState();
    this.setupNotificationHandler();
  }

  /**
   * 알림 핸들러 설정
   */
  private setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,
      }),
    });
  }

  /**
   * 저장된 알람 상태 로드
   */
  private async loadAlertState(): Promise<void> {
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
      if (raw) {
        this.alertState = JSON.parse(raw);
      }
    } catch (error) {
      console.error("[NotificationService] Failed to load alert state:", error);
    }
  }

  /**
   * 알람 상태 저장
   */
  private async saveAlertState(): Promise<void> {
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(this.alertState));
    } catch (error) {
      console.error("[NotificationService] Failed to save alert state:", error);
    }
  }

  /**
   * 권한 요청
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("[NotificationService] Failed to request permissions:", error);
      return false;
    }
  }

  /**
   * 시청 시간 기반 알람 확인 및 발송
   */
  async checkAndSendAlert(currentWatchMs: number, thresholdMinutes: number): Promise<void> {
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const now = Date.now();
    const today = getTodayDateString();

    // 날짜가 바뀌면 알람 상태 자동 초기화
    if (this.alertState.lastAlertDate !== today) {
      await this.resetDailyAlert();
    }

    const timeSinceLastAlert = now - this.alertState.lastAlertTime;

    // 임계값을 초과했는지 확인
    if (currentWatchMs >= thresholdMs) {
      // 마지막 알람 이후 최소 5분이 지났는지 확인 (중복 알람 방지)
      if (timeSinceLastAlert > 5 * 60 * 1000) {
        await this.sendAlert(currentWatchMs, thresholdMinutes);
        this.alertState.lastAlertTime = now;
        this.alertState.lastAlertWatchMs = currentWatchMs;
        this.alertState.lastAlertDate = today;
        await this.saveAlertState();
      }
    }
  }

  /**
   * 알람 발송
   */
  private async sendAlert(watchMs: number, thresholdMinutes: number): Promise<void> {
    try {
      const watchMinutes = Math.floor(watchMs / 60000);
      const message = `${watchMinutes}분 시청했어요! 목표는 ${thresholdMinutes}분입니다. 잠깐 쉬어가세요 🧘`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🛑 숏츠 디톡스 알림",
          body: message,
          sound: true,
          badge: 1,
          data: {
            watchMinutes,
            thresholdMinutes,
            timestamp: Date.now(),
          },
        },
        trigger: null,
      });

      console.log("[NotificationService] Alert sent:", message);
    } catch (error) {
      console.error("[NotificationService] Failed to send alert:", error);
    }
  }

  /**
   * 일일 알람 상태 초기화 (자정)
   */
  async resetDailyAlert(): Promise<void> {
    this.alertState = {
      lastAlertTime: 0,
      lastAlertWatchMs: 0,
      lastAlertDate: getTodayDateString(),
    };
    await this.saveAlertState();
  }

  /**
   * 초과 시간 알람 (예: 30분 초과 시 10분마다 알람)
   */
  async checkAndSendExcessAlert(
    currentWatchMs: number,
    thresholdMinutes: number,
    excessAlertIntervalMinutes: number = 10
  ): Promise<void> {
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const excessMs = currentWatchMs - thresholdMs;

    if (excessMs > 0) {
      const timeSinceLastAlert = Date.now() - this.alertState.lastAlertTime;
      const intervalMs = excessAlertIntervalMinutes * 60 * 1000;

      if (timeSinceLastAlert > intervalMs) {
        const excessMinutes = Math.floor(excessMs / 60000);
        const watchMinutes = Math.floor(currentWatchMs / 60000);

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🚨 과도한 시청 시간",
              body: `이미 ${excessMinutes}분을 초과했어요! (총 ${watchMinutes}분) 지금 바로 멈춰보세요 🛑`,
              sound: true,
              badge: 1,
              data: {
                watchMinutes,
                excessMinutes,
                timestamp: Date.now(),
              },
            },
            trigger: null,
          });

          this.alertState.lastAlertTime = Date.now();
          await this.saveAlertState();

          console.log("[NotificationService] Excess alert sent:", excessMinutes, "minutes over");
        } catch (error) {
          console.error("[NotificationService] Failed to send excess alert:", error);
        }
      }
    }
  }

  /**
   * 테스트 알람 발송
   */
  async sendTestAlert(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "✅ 테스트 알람",
          body: "숏츠 디톡스 알람이 정상 작동합니다",
          sound: true,
        },
        trigger: null,
      });

      console.log("[NotificationService] Test alert sent");
    } catch (error) {
      console.error("[NotificationService] Failed to send test alert:", error);
    }
  }
}

export const notificationService = new NotificationService();

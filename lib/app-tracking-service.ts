import { Platform, AppState, AppStateStatus } from "react-native";
import { addSession, getTodayDateString } from "./store";

/**
 * 현재 실행 중인 앱 정보
 */
interface CurrentAppInfo {
  appId: string;
  appName: string;
  isShortsApp: boolean;
  timestamp: number;
}

/**
 * 숏츠 플랫폼 앱 목록
 */
const SHORTS_APPS = {
  youtube: {
    android: ["com.google.android.youtube"],
    ios: ["com.google.youtube"],
  },
  tiktok: {
    android: ["com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok"],
    ios: ["com.zhiliaoapp.musically"],
  },
  instagram: {
    android: ["com.instagram.android"],
    ios: ["com.instagram.app"],
  },
  reels: {
    android: ["com.facebook.katana"],
    ios: ["com.facebook.Facebook"],
  },
};

/**
 * 실제 앱 추적 서비스
 * - Android: UsageStatsManager를 통해 현재 포그라운드 앱 감지
 * - iOS: AppState를 통해 앱 상태 감지
 */
class AppTrackingService {
  private currentApp: CurrentAppInfo | null = null;
  private sessionStartTime = 0;
  private appStateSubscription: any = null;
  private trackingInterval: any = null;
  private isTracking = false;

  /**
   * 앱 추적 시작
   */
  async start(): Promise<void> {
    if (this.isTracking) return;

    this.isTracking = true;
    console.log("[AppTrackingService] Started");

    if (Platform.OS === "android") {
      this.startAndroidTracking();
    } else if (Platform.OS === "ios") {
      this.startIOSTracking();
    }
  }

  /**
   * 앱 추적 중지
   */
  async stop(): Promise<void> {
    if (!this.isTracking) return;

    this.isTracking = false;
    console.log("[AppTrackingService] Stopped");

    // 현재 세션 저장
    if (this.currentApp && this.sessionStartTime > 0) {
      await this.saveCurrentSession();
    }

    // 구독 해제
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // 추적 간격 해제
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /**
   * Android 앱 추적 시작
   */
  private startAndroidTracking(): void {
    // 5초마다 현재 포그라운드 앱 확인
    this.trackingInterval = setInterval(async () => {
      try {
        const currentApp = await this.getCurrentAndroidApp();
        await this.handleAppChange(currentApp);
      } catch (error) {
        console.error("[AppTrackingService] Error tracking Android app:", error);
      }
    }, 5000);

    console.log("[AppTrackingService] Android tracking started");
  }

  /**
   * iOS 앱 추적 시작
   */
  private startIOSTracking(): void {
    // AppState 변경 감지
    this.appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      this.handleAppStateChange(state);
    });

    console.log("[AppTrackingService] iOS tracking started");
  }

  /**
   * 현재 Android 포그라운드 앱 조회
   * 실제 구현에서는 UsageStatsManager를 통해 조회
   */
  private async getCurrentAndroidApp(): Promise<CurrentAppInfo | null> {
    try {
      // 시뮬레이션: 실제 구현에서는 native module을 통해 조회
      // const appId = await NativeModules.AppTracker.getCurrentApp();

      // 테스트용 데이터
      const testApps: CurrentAppInfo[] = [
        {
          appId: "com.google.android.youtube",
          appName: "YouTube",
          isShortsApp: true,
          timestamp: Date.now(),
        },
        {
          appId: "com.zhiliaoapp.musically",
          appName: "TikTok",
          isShortsApp: true,
          timestamp: Date.now(),
        },
        {
          appId: "com.instagram.android",
          appName: "Instagram",
          isShortsApp: true,
          timestamp: Date.now(),
        },
      ];

      // 실제 구현: UsageStatsManager 사용
      return null;
    } catch (error) {
      console.error("[AppTrackingService] Error getting current Android app:", error);
      return null;
    }
  }

  /**
   * iOS AppState 변경 처리
   */
  private async handleAppStateChange(state: AppStateStatus): Promise<void> {
    if (state === "active") {
      console.log("[AppTrackingService] App became active");
      // 앱이 활성화되면 현재 앱 정보 업데이트
      this.sessionStartTime = Date.now();
    } else if (state === "background") {
      console.log("[AppTrackingService] App went to background");
      // 앱이 백그라운드로 가면 세션 저장
      if (this.currentApp && this.sessionStartTime > 0) {
        await this.saveCurrentSession();
      }
    }
  }

  /**
   * 앱 변경 처리
   */
  private async handleAppChange(newApp: CurrentAppInfo | null): Promise<void> {
    // 앱이 변경되었으면 이전 세션 저장
    if (this.currentApp && newApp?.appId !== this.currentApp.appId) {
      if (this.sessionStartTime > 0) {
        await this.saveCurrentSession();
      }
      this.sessionStartTime = Date.now();
    }

    this.currentApp = newApp;

    if (newApp) {
      console.log(
        "[AppTrackingService] App changed to:",
        newApp.appName,
        `(${newApp.appId}), isShortsApp: ${newApp.isShortsApp}`
      );
    }
  }

  /**
   * 현재 세션 저장
   */
  private async saveCurrentSession(): Promise<void> {
    if (!this.currentApp || this.sessionStartTime === 0) return;

    try {
      const durationMs = Date.now() - this.sessionStartTime;

      // 1초 미만은 저장하지 않음
      if (durationMs < 1000) return;

      // 숏츠 앱만 저장
      if (!this.currentApp.isShortsApp) return;

      await addSession({
        id: `session-${Date.now()}`,
        platform: this.mapAppIdToPlatform(this.currentApp.appId),
        startTime: this.sessionStartTime,
        endTime: Date.now(),
        durationMs,
        date: getTodayDateString(),
        scrollFrequency: 0, // 스크롤 주기는 별도로 계산
        isAutoDetected: true,
      });

      console.log(
        "[AppTrackingService] Session saved:",
        this.currentApp.appName,
        `(${durationMs}ms)`
      );
    } catch (error) {
      console.error("[AppTrackingService] Error saving session:", error);
    }
  }

  /**
   * 앱 ID를 플랫폼으로 매핑
   */
  private mapAppIdToPlatform(
    appId: string
  ): "youtube" | "tiktok" | "instagram" | "other" {
    for (const [platform, appIds] of Object.entries(SHORTS_APPS)) {
      const platformAppIds = Platform.OS === "android" ? appIds.android : appIds.ios;
      if (platformAppIds.some((id) => appId.includes(id))) {
        return platform as any;
      }
    }
    return "other";
  }

  /**
   * 현재 앱 정보 조회
   */
  getCurrentApp(): CurrentAppInfo | null {
    return this.currentApp;
  }

  /**
   * 추적 상태 확인
   */
  isRunning(): boolean {
    return this.isTracking;
  }
}

export const appTrackingService = new AppTrackingService();

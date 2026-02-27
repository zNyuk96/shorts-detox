import { Platform, NativeModules, AppState, AppStateStatus } from "react-native";
import { addSession, getTodayDateString } from "./store";

const { AppDetector } = NativeModules;

/**
 * 현재 실행 중인 앱 정보
 */
export interface CurrentAppInfo {
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
    name: "YouTube",
  },
  tiktok: {
    android: ["com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok"],
    ios: ["com.zhiliaoapp.musically"],
    name: "TikTok",
  },
  instagram: {
    android: ["com.instagram.android"],
    ios: ["com.instagram.app"],
    name: "Instagram",
  },
  reels: {
    android: ["com.facebook.katana"],
    ios: ["com.facebook.Facebook"],
    name: "Facebook",
  },
};

/**
 * 실제 앱 감지 서비스
 * - Android: UsageStatsManager를 통해 현재 포그라운드 앱 감지
 * - iOS: AppState를 통해 앱 상태 감지 + 권한 확인
 */
class RealAppDetectionService {
  private currentApp: CurrentAppInfo | null = null;
  private sessionStartTime = 0;
  private appStateSubscription: any = null;
  private trackingInterval: any = null;
  private isTracking = false;
  private scrollCount = 0;
  private lastScrollTime = 0;

  /**
   * 앱 추적 시작
   */
  async start(): Promise<void> {
    if (this.isTracking) return;

    this.isTracking = true;
    console.log("[RealAppDetection] Started");

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
    console.log("[RealAppDetection] Stopped");

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
    // 2초마다 현재 포그라운드 앱 확인
    this.trackingInterval = setInterval(async () => {
      try {
        if (!AppDetector) {
          console.warn("[RealAppDetection] AppDetector native module not available");
          return;
        }

        // Native 모듈에서 현재 앱 조회
        const appId = await AppDetector.getCurrentApp();
        if (!appId) return;

        const currentApp: CurrentAppInfo = {
          appId,
          appName: this.getAppName(appId),
          isShortsApp: this.isShortsApp(appId),
          timestamp: Date.now(),
        };

        await this.handleAppChange(currentApp);
      } catch (error) {
        console.error("[RealAppDetection] Error tracking Android app:", error);
      }
    }, 2000);

    console.log("[RealAppDetection] Android tracking started");
  }

  /**
   * iOS 앱 추적 시작
   */
  private startIOSTracking(): void {
    // AppState 변경 감지
    this.appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      this.handleAppStateChange(state);
    });

    console.log("[RealAppDetection] iOS tracking started");
  }

  /**
   * 앱 변경 처리
   */
  private async handleAppChange(newApp: CurrentAppInfo): Promise<void> {
    // 앱이 변경되었으면 이전 세션 저장
    if (this.currentApp && newApp.appId !== this.currentApp.appId) {
      if (this.sessionStartTime > 0) {
        await this.saveCurrentSession();
      }
      this.sessionStartTime = Date.now();
      this.scrollCount = 0;
    }

    this.currentApp = newApp;

    if (newApp.isShortsApp) {
      console.log(
        "[RealAppDetection] Shorts app detected:",
        newApp.appName,
        `(${newApp.appId})`
      );
    }
  }

  /**
   * iOS AppState 변경 처리
   */
  private async handleAppStateChange(state: AppStateStatus): Promise<void> {
    if (state === "active") {
      console.log("[RealAppDetection] App became active");
      this.sessionStartTime = Date.now();
      this.scrollCount = 0;
    } else if (state === "background") {
      console.log("[RealAppDetection] App went to background");
      if (this.currentApp && this.sessionStartTime > 0) {
        await this.saveCurrentSession();
      }
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

      const platform = this.mapAppIdToPlatform(this.currentApp.appId);
      const scrollFrequency = this.scrollCount > 0 ? this.scrollCount / (durationMs / 1000) : 0;

      await addSession({
        id: `session-${Date.now()}`,
        platform,
        startTime: this.sessionStartTime,
        endTime: Date.now(),
        durationMs,
        date: getTodayDateString(),
        scrollFrequency,
        isAutoDetected: true,
      });

      console.log(
        "[RealAppDetection] Session saved:",
        this.currentApp.appName,
        `(${durationMs}ms, ${this.scrollCount} scrolls)`
      );

      this.scrollCount = 0;
    } catch (error) {
      console.error("[RealAppDetection] Error saving session:", error);
    }
  }

  /**
   * 스크롤 감지
   */
  recordScroll(): void {
    if (!this.currentApp?.isShortsApp) return;

    const now = Date.now();
    
    // 100ms 이내의 스크롤은 같은 스크롤로 간주
    if (now - this.lastScrollTime > 100) {
      this.scrollCount++;
      this.lastScrollTime = now;
      
      console.log(
        "[RealAppDetection] Scroll detected:",
        this.scrollCount,
        `in ${this.currentApp.appName}`
      );
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
   * 앱 ID가 숏츠 앱인지 확인
   */
  private isShortsApp(appId: string): boolean {
    for (const appIds of Object.values(SHORTS_APPS)) {
      const platformAppIds = Platform.OS === "android" ? appIds.android : appIds.ios;
      if (platformAppIds.some((id) => appId.includes(id))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 앱 ID로 앱 이름 조회
   */
  private getAppName(appId: string): string {
    for (const [, appInfo] of Object.entries(SHORTS_APPS)) {
      const platformAppIds = Platform.OS === "android" ? appInfo.android : appInfo.ios;
      if (platformAppIds.some((id) => appId.includes(id))) {
        return appInfo.name;
      }
    }
    return appId.split(".").pop() || "Unknown";
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

  /**
   * 스크롤 카운트 조회
   */
  getScrollCount(): number {
    return this.scrollCount;
  }

  /**
   * 세션 경과 시간 조회 (밀리초)
   */
  getSessionDuration(): number {
    if (this.sessionStartTime === 0) return 0;
    return Date.now() - this.sessionStartTime;
  }
}

export const realAppDetectionService = new RealAppDetectionService();

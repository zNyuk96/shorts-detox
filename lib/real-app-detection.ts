import { Platform, AppState, AppStateStatus } from "react-native";
import { addSession, getTodayDateString } from "./store";
import { AppDetector } from "../modules/app-detector/src";

export interface CurrentAppInfo {
  appId: string;
  appName: string;
  isShortsApp: boolean;
  timestamp: number;
}

const SHORTS_APPS: Record<string, { android: string[]; ios: string[]; name: string }> = {
  youtube: { android: ["com.google.android.youtube"], ios: ["com.google.youtube"], name: "YouTube" },
  tiktok: { android: ["com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok"], ios: ["com.zhiliaoapp.musically"], name: "TikTok" },
  instagram: { android: ["com.instagram.android"], ios: ["com.instagram.app"], name: "Instagram" },
  facebook: { android: ["com.facebook.katana"], ios: ["com.facebook.Facebook"], name: "Facebook" },
};

const ALL_SHORTS_ANDROID = Object.values(SHORTS_APPS).flatMap((a) => a.android);

class RealAppDetectionService {
  private currentApp: CurrentAppInfo | null = null;
  private sessionStartTime = 0;
  private appStateSubscription: any = null;
  private trackingInterval: any = null;
  private isTracking = false;
  private scrollCount = 0;
  private lastScrollTime = 0;
  private hasPermissionCached: boolean | null = null;
  private permissionCheckTime = 0;

  async start(): Promise<void> {
    if (this.isTracking) return;
    this.isTracking = true;
    if (Platform.OS === "android") {
      await this.startAndroidTracking();
    } else {
      this.startIOSTracking();
    }
  }

  async stop(): Promise<void> {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.currentApp && this.sessionStartTime > 0) await this.saveCurrentSession();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.trackingInterval) { clearInterval(this.trackingInterval); this.trackingInterval = null; }
  }

  isRunning() { return this.isTracking; }
  getCurrentApp() { return this.currentApp; }
  getScrollCount() { return this.scrollCount; }
  getSessionDuration() { return this.sessionStartTime === 0 ? 0 : Date.now() - this.sessionStartTime; }

  recordScroll(): void {
    const now = Date.now();
    if (now - this.lastScrollTime > 100) { this.scrollCount++; this.lastScrollTime = now; }
  }

  invalidatePermissionCache(): void { this.hasPermissionCached = null; }

  private async startAndroidTracking(): Promise<void> {
    this.trackingInterval = setInterval(() => this.pollForegroundApp(), 2000);
  }

  private async pollForegroundApp(): Promise<void> {
    try {
      const now = Date.now();
      if (this.hasPermissionCached !== null && now - this.permissionCheckTime < 30000) {
        if (!this.hasPermissionCached) return;
      } else {
        this.hasPermissionCached = await AppDetector.hasUsageStatsPermission();
        this.permissionCheckTime = now;
        if (!this.hasPermissionCached) return;
      }

      const packageName = await AppDetector.getCurrentApp();
      if (!packageName || packageName === "space.manus.shorts.detox.t20260226225554") return;

      const isShortsApp = ALL_SHORTS_ANDROID.some((p) => packageName.includes(p));
      const appInfo: CurrentAppInfo = {
        appId: packageName,
        appName: this.getAppDisplayName(packageName),
        isShortsApp,
        timestamp: Date.now(),
      };
      await this.handleAppChange(appInfo);
    } catch (e) {}
  }

  private async handleAppChange(newApp: CurrentAppInfo): Promise<void> {
    const prev = this.currentApp;
    if (prev && prev.appId !== newApp.appId) {
      if (this.sessionStartTime > 0) await this.saveCurrentSession();
      this.sessionStartTime = newApp.isShortsApp ? Date.now() : 0;
      this.scrollCount = 0;
    }
    if (newApp.isShortsApp && this.sessionStartTime === 0) {
      this.sessionStartTime = Date.now();
      this.scrollCount = 0;
      console.log("[RealAppDetection] Shorts detected:", newApp.appName);
    }
    if (!newApp.isShortsApp && prev?.isShortsApp) {
      await this.saveCurrentSession();
      this.sessionStartTime = 0;
    }
    this.currentApp = newApp;
  }

  private startIOSTracking(): void {
    this.appStateSubscription = AppState.addEventListener("change", async (state: AppStateStatus) => {
      if (state === "background") { this.sessionStartTime = Date.now(); this.scrollCount = 0; }
      else if (state === "active" && this.sessionStartTime > 0) {
        await this.saveCurrentSession();
        this.sessionStartTime = 0;
      }
    });
  }

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentApp || this.sessionStartTime === 0) return;
    const durationMs = Date.now() - this.sessionStartTime;
    if (durationMs < 3000) return;
    if (!this.currentApp.isShortsApp && Platform.OS === "android") return;
    try {
      const platform = this.mapPackageToPlatform(this.currentApp.appId);
      const scrollFrequency = this.scrollCount > 0 ? this.scrollCount / (durationMs / 1000) : 0;
      await addSession({
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        platform, startTime: this.sessionStartTime, endTime: Date.now(),
        durationMs, date: getTodayDateString(), scrollFrequency, isAutoDetected: true,
      });
      console.log(`[RealAppDetection] Saved: ${this.currentApp.appName} ${Math.round(durationMs/1000)}s`);
    } catch (e) { console.error("[RealAppDetection] Save failed:", e); }
  }

  private getAppDisplayName(packageName: string): string {
    for (const [, info] of Object.entries(SHORTS_APPS)) {
      if (info.android.some((p) => packageName.includes(p))) return info.name;
    }
    const parts = packageName.split(".");
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  }

  private mapPackageToPlatform(packageName: string): "youtube" | "tiktok" | "instagram" | "other" {
    for (const [platform, info] of Object.entries(SHORTS_APPS)) {
      const ids = Platform.OS === "android" ? info.android : info.ios;
      if (ids.some((p) => packageName.includes(p))) {
        if (platform === "facebook") return "other";
        return platform as "youtube" | "tiktok" | "instagram";
      }
    }
    return "other";
  }
}

export const realAppDetectionService = new RealAppDetectionService();

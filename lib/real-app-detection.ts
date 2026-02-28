import { Platform, AppState, AppStateStatus } from "react-native";
import { addSession, getTodayDateString } from "./store";
import { AppDetector } from "../modules/app-detector/src";

export interface CurrentAppInfo {
  appId: string;
  appName: string;
  isShortsApp: boolean;
  timestamp: number;
}

class RealAppDetectionService {
  private isTracking = false;
  private appStateSubscription: any = null;
  private onSessionsLoaded?: () => void;

  async start(): Promise<void> {
    if (this.isTracking) return;
    this.isTracking = true;

    if (Platform.OS === "android") {
      // 앱이 포그라운드로 돌아올 때 pending sessions 로드
      this.appStateSubscription = AppState.addEventListener(
        "change",
        this.handleAppState
      );
      // 시작 시 기존 pending sessions 로드
      await this.loadPendingSessions();
    }
  }

  async stop(): Promise<void> {
    if (!this.isTracking) return;
    this.isTracking = false;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  private handleAppState = async (state: AppStateStatus) => {
    if (state === "active") {
      await this.loadPendingSessions();
    }
  };

  async loadPendingSessions(): Promise<void> {
    if (Platform.OS !== "android") return;
    try {
      const json = await AppDetector.getPendingSessions();
      const sessions: any[] = JSON.parse(json);
      if (!Array.isArray(sessions) || sessions.length === 0) return;

      for (const s of sessions) {
        if (!s.id || !s.durationMs || s.durationMs < 3000) continue;
        await addSession({
          id: s.id,
          platform: s.platform || "other",
          startTime: s.startTime || Date.now(),
          endTime: s.endTime || Date.now(),
          durationMs: s.durationMs,
          date: s.date || getTodayDateString(),
          scrollFrequency: s.scrollFrequency || 0,
          isAutoDetected: true,
        });
      }
      await AppDetector.clearPendingSessions();
      this.onSessionsLoaded?.();
    } catch (e) {
      console.warn("[RealAppDetection] Failed to load pending sessions:", e);
    }
  }

  setOnSessionsLoaded(cb: () => void) {
    this.onSessionsLoaded = cb;
  }

  isRunning() { return this.isTracking; }
  getCurrentApp(): CurrentAppInfo | null { return null; }
  getScrollCount() { return 0; }
  getSessionDuration() { return 0; }
  recordScroll(): void {}
  invalidatePermissionCache(): void {}

  async startBackgroundMonitoring(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    try { return await AppDetector.startBackgroundMonitoring(); } catch { return false; }
  }

  async stopBackgroundMonitoring(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    try { return await AppDetector.stopBackgroundMonitoring(); } catch { return false; }
  }

  async isBackgroundMonitoringActive(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    try { return await AppDetector.isBackgroundMonitoringActive(); } catch { return false; }
  }
}

export const realAppDetectionService = new RealAppDetectionService();

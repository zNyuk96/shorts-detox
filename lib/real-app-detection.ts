import { Platform, AppState, AppStateStatus } from "react-native";
import { addSession, getTodayDateString } from "./store";
import { AppDetector } from "../modules/app-detector/src";

export interface CurrentAppInfo {
  appId: string;
  appName: string;
  isShortsApp: boolean;
  timestamp: number;
}

function isValidDateString(date: unknown): date is string {
  if (typeof date !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return !isNaN(new Date(date).getTime());
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

      let importedCount = 0;
      for (const s of sessions) {
        if (!s.id || !s.durationMs || s.durationMs < 3000) continue;
        // startTime 으로 날짜 재계산 (date 필드 유실/오류 방어)
        const date = isValidDateString(s.date)
          ? s.date
          : s.startTime
            ? new Date(s.startTime).toISOString().split("T")[0]
            : getTodayDateString();
        await addSession({
          id: s.id,
          platform: s.platform || "other",
          startTime: s.startTime || Date.now(),
          endTime: s.endTime || Date.now(),
          durationMs: s.durationMs,
          date,
          scrollFrequency: s.scrollFrequency || 0,
          isAutoDetected: true,
        });
        importedCount++;
      }

      if (importedCount > 0) {
        const cleared = await AppDetector.clearPendingSessions();
        if (!cleared) {
          // 다음 포그라운드 때 재시도. addSession 내 dedup 으로 이중 카운팅 방지됨
          console.warn("[RealAppDetection] clearPendingSessions failed, will retry");
        }
        this.onSessionsLoaded?.();
      }
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

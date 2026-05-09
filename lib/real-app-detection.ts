import { Platform, AppState, AppStateStatus, NativeEventSubscription } from "react-native";
import { addSession, getTodayDateString, isValidDateString } from "./store";
import { AppDetector } from "../modules/app-detector/src";
import { debugLogger } from "./debug-logger";

export interface CurrentAppInfo {
  appId: string;
  appName: string;
  isShortsApp: boolean;
  timestamp: number;
}

// Kotlin(AppMonitorService)과 동일하게 로컬 타임존 기준으로 날짜 문자열 생성
function toLocalDateString(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

class RealAppDetectionService {
  private isTracking = false;
  private appStateSubscription: NativeEventSubscription | null = null;
  private onSessionsLoaded?: () => void;
  private onLiveSessionUpdate?: (durationMs: number) => void;
  private liveSessionInterval: ReturnType<typeof setInterval> | null = null;
  private isLoadingPending = false;

  async start(): Promise<void> {
    if (this.isTracking) return;
    this.isTracking = true;
    debugLogger.log("DETECT", "RealAppDetectionService.start() 호출됨");

    if (Platform.OS === "android") {
      this.appStateSubscription = AppState.addEventListener(
        "change",
        this.handleAppState
      );
      await this.loadPendingSessions();
      this.startLiveSessionPolling();
    }
  }

  async stop(): Promise<void> {
    if (!this.isTracking) return;
    this.isTracking = false;
    debugLogger.log("DETECT", "RealAppDetectionService.stop() 호출됨");
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.stopLiveSessionPolling();
    this.onLiveSessionUpdate?.(0);
  }

  private handleAppState = async (state: AppStateStatus) => {
    debugLogger.log("DETECT", `AppState 변경: ${state}`);
    if (state === "active") {
      // 동시에 여러 loadPendingSessions() 호출 방지
      if (!this.isLoadingPending) {
        this.isLoadingPending = true;
        try {
          await this.loadPendingSessions();
        } catch (e) {
          debugLogger.log("DETECT", `handleAppState load 에러: ${e}`);
        } finally {
          this.isLoadingPending = false;
        }
      } else {
        debugLogger.log("DETECT", "loadPendingSessions 이미 진행 중, 스킵");
      }
      this.startLiveSessionPolling();
    } else if (state === "background" || state === "inactive") {
      this.stopLiveSessionPolling();
      this.onLiveSessionUpdate?.(0);
    }
  };

  // ── 라이브 세션 폴링 (30초마다, 포그라운드에서만 실행) ──
  private startLiveSessionPolling() {
    this.stopLiveSessionPolling();
    void this.checkLiveSession(); // 즉시 1회 (fire-and-forget)
    this.liveSessionInterval = setInterval(() => {
      void this.checkLiveSession();
    }, 30_000);
  }

  private stopLiveSessionPolling() {
    if (this.liveSessionInterval) {
      clearInterval(this.liveSessionInterval);
      this.liveSessionInterval = null;
    }
  }

  private async checkLiveSession(): Promise<void> {
    if (Platform.OS !== "android") return;
    try {
      const json = await AppDetector.getLiveSession();
      if (!json) {
        this.onLiveSessionUpdate?.(0);
        return;
      }
      const live = JSON.parse(json) as { pkg: string; startTime: number };
      const durationMs = Date.now() - live.startTime;
      debugLogger.log("LIVE", `pkg=${live.pkg} dur=${Math.round(durationMs / 1000)}s`);
      this.onLiveSessionUpdate?.(durationMs > 0 ? durationMs : 0);
    } catch {
      this.onLiveSessionUpdate?.(0);
    }
  }

  async loadPendingSessions(): Promise<void> {
    if (Platform.OS !== "android") return;
    try {
      debugLogger.log("PENDING", "loadPendingSessions() 호출됨");
      const json = await AppDetector.getPendingSessions();
      debugLogger.log("PENDING", `raw JSON 길이: ${json.length}`);
      const sessions: any[] = JSON.parse(json);
      if (!Array.isArray(sessions) || sessions.length === 0) {
        debugLogger.log("PENDING", "pendingSessions: 0건");
        return;
      }

      debugLogger.log("PENDING", `pendingSessions 수신: ${sessions.length}건`);
      let importedCount = 0;
      let skippedCount = 0;
      for (const s of sessions) {
        if (!s.id || !s.durationMs || s.durationMs < 3000) {
          debugLogger.log("PENDING", `SKIP: id=${s.id} dur=${s.durationMs}ms`);
          skippedCount++;
          continue;
        }
        // Kotlin과 동일하게 로컬 타임존 기준 날짜 계산 (date 필드 유실/오류 방어)
        const date = isValidDateString(s.date)
          ? s.date
          : s.startTime
            ? toLocalDateString(s.startTime)
            : getTodayDateString();

        const durSec = Math.round(s.durationMs / 1000);
        debugLogger.log("PENDING", `IMPORT: id=${s.id} platform=${s.platform} date=${date} dur=${durSec}s`);

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

      debugLogger.log("PENDING", `결과: imported=${importedCount} skipped=${skippedCount} total=${sessions.length}`);
      if (importedCount > 0) {
        const cleared = await AppDetector.clearPendingSessions();
        debugLogger.log("PENDING", `clearPendingSessions 결과: ${cleared}`);
        if (!cleared) {
          debugLogger.log("PENDING", "clearPendingSessions 실패! 다음 로드 시 중복 가능");
        }
        this.onSessionsLoaded?.();
        debugLogger.log("PENDING", "onSessionsLoaded 콜백 호출됨 (refreshData 트리거)");
      }
    } catch (e) {
      debugLogger.log("PENDING", `loadPendingSessions 에러: ${e}`);
      console.warn("[RealAppDetection] Failed to load pending sessions:", e);
    }
  }

  setOnSessionsLoaded(cb: () => void) {
    this.onSessionsLoaded = cb;
  }

  setOnLiveSessionUpdate(cb: (durationMs: number) => void) {
    this.onLiveSessionUpdate = cb;
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

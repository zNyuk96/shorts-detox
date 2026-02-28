import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type DetoxActivity,
  type Session,
  type UserSettings,
  type AttentionScore,
  type ScrollMetrics,
  addDetoxActivity,
  addSession,
  getTodayDateString,
  loadDetoxActivities,
  loadLastActiveDate,
  loadSessions,
  loadSettings,
  loadStreak,
  saveLastActiveDate,
  saveSettings,
  saveStreak,
  loadAttentionScores,
  addAttentionScore,
  loadScrollMetrics,
  addScrollMetric,
  calculateAttentionScore,
  getPlatformStats,
} from "./store";
import { permissionsService } from "./permissions-service";
import { appTrackingService } from "./app-tracking-service";
import { realAppDetectionService } from "./real-app-detection";
import { backgroundTaskService } from "./background-task-service";
import { scrollDetectionService } from "./scroll-detection-service";

const TEST_MODE_KEY = "@shorts_detox_test_mode";

interface AppContextValue {
  sessions: Session[];
  detoxActivities: DetoxActivity[];
  settings: UserSettings;
  streak: number;
  todayWatchMs: number;
  isLoading: boolean;
  testMode: boolean;
  setTestMode: (v: boolean) => void;
  addSessionRecord: (session: Session) => Promise<void>;
  addDetoxRecord: (activity: DetoxActivity) => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  refreshData: () => Promise<void>;
  attentionScores: AttentionScore[];
  scrollMetrics: ScrollMetrics[];
  platformStats: Record<string, { totalMs: number; sessionCount: number }>;
  todayAttentionScore: AttentionScore | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [detoxActivities, setDetoxActivities] = useState<DetoxActivity[]>([]);
  const [testMode, setTestModeState] = useState(false);
  const [attentionScores, setAttentionScores] = useState<AttentionScore[]>([]);
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics[]>([]);
  const [platformStats, setPlatformStats] = useState<Record<string, { totalMs: number; sessionCount: number }>>({});
  const [todayAttentionScore, setTodayAttentionScore] = useState<AttentionScore | null>(null);

  // Load testMode from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(TEST_MODE_KEY).then((val) => {
      if (val === "true") setTestModeState(true);
    });
  }, []);

  // Persist testMode to AsyncStorage
  const setTestMode = useCallback((v: boolean) => {
    setTestModeState(v);
    AsyncStorage.setItem(TEST_MODE_KEY, v ? "true" : "false");
  }, []);

  const [settings, setSettings] = useState<UserSettings>({
    dailyGoalMinutes: 30,
    alertIntervalMinutes: 15,
    alertEnabled: true,
    theme: "system",
    onboardingDone: false,
    alertThresholdMinutes: 30,
    manualInputEnabled: true,
  });
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [s, d, cfg, str, lastDate, scores, metrics] = await Promise.all([
      loadSessions(),
      loadDetoxActivities(),
      loadSettings(),
      loadStreak(),
      loadLastActiveDate(),
      loadAttentionScores(),
      loadScrollMetrics(),
    ]);

    // Update streak
    const today = getTodayDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = str;
    if (lastDate === today) {
      // already counted today
    } else if (lastDate === yesterdayStr) {
      newStreak = str + 1;
      await saveStreak(newStreak);
      await saveLastActiveDate(today);
    } else if (lastDate !== today) {
      newStreak = 1;
      await saveStreak(newStreak);
      await saveLastActiveDate(today);
    }

    setSessions(s);
    setDetoxActivities(d);
    setSettings(cfg);
    setStreak(newStreak);
    setAttentionScores(scores);
    setScrollMetrics(metrics);

    // 오늘의 플래폰별 통계 계산
    const stats = getPlatformStats(s);
    setPlatformStats(stats);

    // 오늘의 주의력 점수 찾기
    const todayScore = scores.find((s) => s.date === today) || null;
    setTodayAttentionScore(todayScore);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Real app detection and background monitoring
  useEffect(() => {
    const initializeDetection = async () => {
      try {
        await realAppDetectionService.start();
        console.log("[AppContext] Real app detection started");
        await backgroundTaskService.startMonitoring();
        console.log("[AppContext] Background monitoring started");
      } catch (error) {
        console.error("[AppContext] Error initializing detection:", error);
      }
    };
    initializeDetection();
    return () => {
      realAppDetectionService.stop();
      backgroundTaskService.stopMonitoring();
    };
  }, []);

  const addSessionRecord = useCallback(
    async (session: Session) => {
      await addSession(session);
      setSessions((prev) => [...prev, session]);
    },
    []
  );

  const addDetoxRecord = useCallback(
    async (activity: DetoxActivity) => {
      await addDetoxActivity(activity);
      setDetoxActivities((prev) => [...prev, activity]);
    },
    []
  );

  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      const updated = { ...settings, ...partial };
      await saveSettings(updated);
      setSettings(updated);
    },
    [settings]
  );

  const today = getTodayDateString();
  const todayStats = getPlatformStats(sessions);
  const storedTodayMs = Object.values(todayStats).reduce((sum, s) => sum + (s?.totalMs || 0), 0);
  const currentApp = realAppDetectionService.getCurrentApp();
  const inProgressValidatedMs =
    currentApp?.isShortsApp === true
      ? realAppDetectionService.getValidatedShortsDurationMs()
      : 0;
  const todayWatchMs = storedTodayMs + inProgressValidatedMs;

  return (
    <AppContext.Provider
      value={{
        sessions,
        detoxActivities,
        settings,
        streak,
        todayWatchMs,
        isLoading,
        testMode,
        setTestMode,
        addSessionRecord,
        addDetoxRecord,
        updateSettings,
        refreshData,
        attentionScores,
        scrollMetrics,
        platformStats,
        todayAttentionScore,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

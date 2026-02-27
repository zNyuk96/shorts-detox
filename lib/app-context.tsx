import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type DetoxActivity,
  type Session,
  type UserSettings,
  addDetoxActivity,
  addSession,
  getDailyStats,
  getTodayDateString,
  loadDetoxActivities,
  loadLastActiveDate,
  loadSessions,
  loadSettings,
  loadStreak,
  saveLastActiveDate,
  saveSettings,
  saveStreak,
} from "./store";

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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [detoxActivities, setDetoxActivities] = useState<DetoxActivity[]>([]);
  const [testMode, setTestModeState] = useState(false);

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
  });
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [s, d, cfg, str, lastDate] = await Promise.all([
      loadSessions(),
      loadDetoxActivities(),
      loadSettings(),
      loadStreak(),
      loadLastActiveDate(),
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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
  const todayStats = getDailyStats(sessions, today);

  return (
    <AppContext.Provider
      value={{
        sessions,
        detoxActivities,
        settings,
        streak,
        todayWatchMs: todayStats.totalWatchMs,
        isLoading,
        testMode,
        setTestMode,
        addSessionRecord,
        addDetoxRecord,
        updateSettings,
        refreshData,
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

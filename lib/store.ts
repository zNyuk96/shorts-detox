import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Platform = "youtube" | "tiktok" | "instagram" | "other";

export interface Session {
  id: string;
  platform: Platform;
  startTime: number;
  endTime: number;
  durationMs: number;
  date: string; // YYYY-MM-DD
}

export interface DetoxActivity {
  id: string;
  type: "brain" | "meditation" | "quit";
  gameType?: string;
  durationMs: number;
  score?: number;
  date: string;
  timestamp: number;
}

export interface DailyStats {
  date: string;
  totalWatchMs: number;
  sessionCount: number;
  detoxCount: number;
  savedMs: number;
}

export interface UserSettings {
  dailyGoalMinutes: number;
  alertIntervalMinutes: number;
  alertEnabled: boolean;
  theme: "light" | "dark" | "system";
  onboardingDone: boolean;
}

export interface AppState {
  sessions: Session[];
  detoxActivities: DetoxActivity[];
  settings: UserSettings;
  streak: number;
  lastActiveDate: string;
}

// ─── Default Values ───────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  dailyGoalMinutes: 30,
  alertIntervalMinutes: 15,
  alertEnabled: true,
  theme: "system",
  onboardingDone: false,
};

const STORAGE_KEYS = {
  SESSIONS: "@shorts_detox/sessions",
  DETOX_ACTIVITIES: "@shorts_detox/detox_activities",
  SETTINGS: "@shorts_detox/settings",
  STREAK: "@shorts_detox/streak",
  LAST_ACTIVE: "@shorts_detox/last_active",
};

// ─── Storage Helpers ──────────────────────────────────────────────────────────

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  // Keep only last 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filtered = sessions.filter((s) => s.startTime > cutoff);
  await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
}

export async function addSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  sessions.push(session);
  await saveSessions(sessions);
}

export async function loadDetoxActivities(): Promise<DetoxActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DETOX_ACTIVITIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveDetoxActivities(activities: DetoxActivity[]): Promise<void> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filtered = activities.filter((a) => a.timestamp > cutoff);
  await AsyncStorage.setItem(STORAGE_KEYS.DETOX_ACTIVITIES, JSON.stringify(filtered));
}

export async function addDetoxActivity(activity: DetoxActivity): Promise<void> {
  const activities = await loadDetoxActivities();
  activities.push(activity);
  await saveDetoxActivities(activities);
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.STREAK);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function saveStreak(streak: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.STREAK, String(streak));
}

export async function loadLastActiveDate(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)) ?? "";
  } catch {
    return "";
  }
}

export async function saveLastActiveDate(date: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, date);
}

// ─── Computed Stats ───────────────────────────────────────────────────────────

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDailyStats(sessions: Session[], date: string): DailyStats {
  const daySessions = sessions.filter((s) => s.date === date);
  const totalWatchMs = daySessions.reduce((sum, s) => sum + s.durationMs, 0);
  return {
    date,
    totalWatchMs,
    sessionCount: daySessions.length,
    detoxCount: 0,
    savedMs: 0,
  };
}

export function getWeeklyStats(sessions: Session[]): DailyStats[] {
  const stats: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    stats.push(getDailyStats(sessions, dateStr));
  }
  return stats;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  return `${minutes}분`;
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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
  scrollFrequency?: number; // 초당 스크롤 횟수
  isAutoDetected?: boolean; // 자동 감지 여부
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
  alertThresholdMinutes?: number; // 알람 임계값 (분)
  manualInputEnabled?: boolean; // 수동 입력 활성화
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
  alertThresholdMinutes: 30,
  manualInputEnabled: true,
};

const STORAGE_KEYS = {
  SESSIONS: "@shorts_detox/sessions",
  DETOX_ACTIVITIES: "@shorts_detox/detox_activities",
  SETTINGS: "@shorts_detox/settings",
  STREAK: "@shorts_detox/streak",
  LAST_ACTIVE: "@shorts_detox/last_active",
  SCROLL_METRICS: "@shorts_detox/scroll_metrics",
  ATTENTION_SCORES: "@shorts_detox/attention_scores",
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
    return raw ? parseInt(raw) : 0;
  } catch {
    return 0;
  }
}

export async function saveStreak(streak: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.STREAK, streak.toString());
}

export async function loadLastActiveDate(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    return raw || getTodayDateString();
  } catch {
    return getTodayDateString();
  }
}

export async function saveLastActiveDate(date: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, date);
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export function getWeeklyStats(sessions: Session[]): Array<{ date: string; totalWatchMs: number }> {
  const stats: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split("T")[0];
    stats[dateStr] = 0;
  }

  sessions.forEach((session) => {
    if (stats[session.date] !== undefined) {
      stats[session.date] += session.durationMs;
    }
  });

  return Object.entries(stats).map(([date, totalWatchMs]) => ({ date, totalWatchMs }));
}

export function getPlatformStats(
  sessions: Session[]
): Record<Platform, { totalMs: number; sessionCount: number }> {
  const stats: Record<Platform, { totalMs: number; sessionCount: number }> = {
    youtube: { totalMs: 0, sessionCount: 0 },
    tiktok: { totalMs: 0, sessionCount: 0 },
    instagram: { totalMs: 0, sessionCount: 0 },
    other: { totalMs: 0, sessionCount: 0 },
  };

  sessions.forEach((session) => {
    if (stats[session.platform]) {
      stats[session.platform].totalMs += session.durationMs;
      stats[session.platform].sessionCount += 1;
    }
  });

  return stats;
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

export function formatDuration(ms: number, precision: "hours" | "minutes" | "seconds" = "minutes"): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (precision === "seconds") {
    // 초 단위 정밀도
    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  } else if (precision === "minutes") {
    // 분 단위 정밀도 (기본)
    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
  } else {
    // 시간 단위 정밀도
    if (hours > 0) {
      return `${hours}시간`;
    } else if (minutes > 0) {
      return `${minutes}분`;
    } else {
      return `${seconds}초`;
    }
  }
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

// ─── Scroll Metrics & Attention Scores ─────────────────────────────────────

export interface ScrollMetrics {
  date: string;
  platform: Platform;
  averageScrollFrequency: number; // 초당 스크롤 횟수
  totalScrollCount: number;
  sessionCount: number;
}

export interface AttentionScore {
  date: string;
  watchTimeMinutes: number;
  scrollFrequency: number; // 평균 초당 스크롤
  attentionScore: number; // 0-100 (높을수록 좋음)
  focusLevel: "excellent" | "good" | "fair" | "poor"; // 주의력 수준
  recommendation: string; // 권장사항
}

// ─── Scroll Metrics Storage ───────────────────────────────────────────────

export async function loadScrollMetrics(): Promise<ScrollMetrics[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCROLL_METRICS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveScrollMetrics(metrics: ScrollMetrics[]): Promise<void> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoff).toISOString().split("T")[0];
  const filtered = metrics.filter((m) => m.date >= cutoffDate);
  await AsyncStorage.setItem(STORAGE_KEYS.SCROLL_METRICS, JSON.stringify(filtered));
}

export async function addScrollMetric(metric: ScrollMetrics): Promise<void> {
  const metrics = await loadScrollMetrics();
  const existing = metrics.findIndex((m) => m.date === metric.date && m.platform === metric.platform);
  if (existing >= 0) {
    metrics[existing] = metric;
  } else {
    metrics.push(metric);
  }
  await saveScrollMetrics(metrics);
}

// ─── Attention Scores Storage ─────────────────────────────────────────────

export async function loadAttentionScores(): Promise<AttentionScore[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ATTENTION_SCORES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveAttentionScores(scores: AttentionScore[]): Promise<void> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoff).toISOString().split("T")[0];
  const filtered = scores.filter((s) => s.date >= cutoffDate);
  await AsyncStorage.setItem(STORAGE_KEYS.ATTENTION_SCORES, JSON.stringify(filtered));
}

export async function addAttentionScore(score: AttentionScore): Promise<void> {
  const scores = await loadAttentionScores();
  const existing = scores.findIndex((s) => s.date === score.date);
  if (existing >= 0) {
    scores[existing] = score;
  } else {
    scores.push(score);
  }
  await saveAttentionScores(scores);
}

// ─── Attention Score Calculation ──────────────────────────────────────────

export function calculateAttentionScore(watchTimeMinutes: number, avgScrollFrequency: number): AttentionScore {
  // 시청 시간에 따른 점수 (30분 이상이면 감점)
  let watchScore = Math.max(0, 100 - (watchTimeMinutes / 30) * 50);

  // 스크롤 주기에 따른 점수 (초당 1회 이상이면 감점)
  let scrollScore = Math.max(0, 100 - avgScrollFrequency * 30);

  // 최종 주의력 점수 (평균)
  const attentionScore = Math.round((watchScore + scrollScore) / 2);

  // 주의력 수준 판정
  let focusLevel: "excellent" | "good" | "fair" | "poor";
  if (attentionScore >= 80) {
    focusLevel = "excellent";
  } else if (attentionScore >= 60) {
    focusLevel = "good";
  } else if (attentionScore >= 40) {
    focusLevel = "fair";
  } else {
    focusLevel = "poor";
  }

  // 권장사항
  let recommendation = "";
  if (focusLevel === "excellent") {
    recommendation = "주의력이 매우 좋습니다! 이 상태를 유지하세요.";
  } else if (focusLevel === "good") {
    recommendation = "주의력이 양호합니다. 조금 더 노력하면 더 좋아질 수 있습니다.";
  } else if (focusLevel === "fair") {
    recommendation = "주의력이 저하되고 있습니다. 디톡스 활동을 늘려보세요.";
  } else {
    recommendation = "주의력이 매우 낮습니다. 즉시 휴식을 취하고 명상을 해보세요.";
  }

  return {
    date: getTodayDateString(),
    watchTimeMinutes,
    scrollFrequency: avgScrollFrequency,
    attentionScore,
    focusLevel,
    recommendation,
  };
}

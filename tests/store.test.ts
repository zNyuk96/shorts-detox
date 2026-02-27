import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatMinutes,
  generateId,
  getTodayDateString,
  getDailyStats,
  getWeeklyStats,
} from "../lib/store";

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(30000)).toBe("30초");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(90000)).toBe("1분 30초");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3660000)).toBe("1시간 1분");
  });
  it("returns 0초 for zero", () => {
    expect(formatDuration(0)).toBe("0초");
  });
});

describe("formatMinutes", () => {
  it("formats minutes under 60", () => {
    expect(formatMinutes(30)).toBe("30분");
  });
  it("formats exactly 60 minutes as 1시간", () => {
    expect(formatMinutes(60)).toBe("1시간");
  });
  it("formats 90 minutes as 1시간 30분", () => {
    expect(formatMinutes(90)).toBe("1시간 30분");
  });
});

describe("generateId", () => {
  it("generates unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
  it("generates string IDs", () => {
    expect(typeof generateId()).toBe("string");
  });
});

describe("getTodayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getDailyStats", () => {
  const today = getTodayDateString();
  const sessions = [
    { id: "1", platform: "youtube" as const, startTime: Date.now(), endTime: Date.now() + 60000, durationMs: 60000, date: today },
    { id: "2", platform: "tiktok" as const, startTime: Date.now(), endTime: Date.now() + 30000, durationMs: 30000, date: today },
    { id: "3", platform: "instagram" as const, startTime: Date.now(), endTime: Date.now() + 45000, durationMs: 45000, date: "2024-01-01" },
  ];

  it("calculates total watch time for today", () => {
    const stats = getDailyStats(sessions, today);
    expect(stats.totalWatchMs).toBe(90000);
  });

  it("counts only today sessions", () => {
    const stats = getDailyStats(sessions, today);
    expect(stats.sessionCount).toBe(2);
  });

  it("returns zero for a day with no sessions", () => {
    const stats = getDailyStats(sessions, "2025-01-01");
    expect(stats.totalWatchMs).toBe(0);
    expect(stats.sessionCount).toBe(0);
  });
});

describe("getWeeklyStats", () => {
  it("returns 7 days of stats", () => {
    const stats = getWeeklyStats([]);
    expect(stats).toHaveLength(7);
  });

  it("last item is today", () => {
    const stats = getWeeklyStats([]);
    const today = getTodayDateString();
    expect(stats[6].date).toBe(today);
  });
});

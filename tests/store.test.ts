import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatMinutes,
  generateId,
  getTodayDateString,
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

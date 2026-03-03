import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTodayDateString } from "./store";

const PENDING_DETOX_KEY = "@shorts_detox/pending_detox";

export interface PendingDetox {
  watchMs: number;
  thresholdMs: number;
  at: number;
  date: string;
}

export async function getPendingDetox(): Promise<PendingDetox | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DETOX_KEY);
    if (!raw) return null;
    const data: PendingDetox = JSON.parse(raw);
    // 오늘 날짜 기준으로 만료 — 날짜가 바뀌면 무효
    if (data.date !== getTodayDateString()) {
      await clearPendingDetox();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function setPendingDetox(watchMs: number, thresholdMs: number): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_DETOX_KEY,
    JSON.stringify({ watchMs, thresholdMs, at: Date.now(), date: getTodayDateString() })
  );
}

export async function clearPendingDetox(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_DETOX_KEY);
}

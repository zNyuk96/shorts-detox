import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_DETOX_KEY = "@shorts_detox/pending_detox";
const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1시간

export interface PendingDetox {
  watchMs: number;
  thresholdMs: number;
  at: number;
}

export async function getPendingDetox(): Promise<PendingDetox | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DETOX_KEY);
    if (!raw) return null;
    const data: PendingDetox = JSON.parse(raw);
    if (Date.now() - data.at > PENDING_MAX_AGE_MS) {
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
    JSON.stringify({ watchMs, thresholdMs, at: Date.now() })
  );
}

export async function clearPendingDetox(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_DETOX_KEY);
}

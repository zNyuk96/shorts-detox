import { NativeModules, Platform } from "react-native";
import type { AppDetectorInterface } from "./AppDetector.types";

const stub: AppDetectorInterface = {
  getCurrentApp: async () => null,
  hasUsageStatsPermission: async () => false,
  getUsageStats: async () => ({}),
  getAppName: async (pkg) => pkg,
};

const createAndroidModule = (): AppDetectorInterface => {
  const native = NativeModules.AppDetector;
  if (!native) { if (__DEV__) console.warn("[AppDetector] Native module not found. Run prebuild + dev build."); return stub; }
  return {
    getCurrentApp: () => native.getCurrentApp(),
    hasUsageStatsPermission: () => native.hasUsageStatsPermission(),
    getUsageStats: (minutes: number) => native.getUsageStats(minutes),
    getAppName: (packageName: string) => native.getAppName(packageName),
  };
};

export const AppDetector: AppDetectorInterface =
  Platform.OS === "android" ? createAndroidModule() : stub;

export type { AppDetectorInterface };
export * from "./AppDetector.types";

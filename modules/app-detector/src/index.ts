import { NativeModules, Platform } from "react-native";
import type { AppDetectorInterface } from "./AppDetector.types";

const stub: AppDetectorInterface = {
  getCurrentApp: async () => null,
  hasUsageStatsPermission: async () => false,
  getUsageStats: async () => ({}),
  getAppName: async (pkg) => pkg,
  startBackgroundMonitoring: async () => false,
  stopBackgroundMonitoring: async () => false,
  isBackgroundMonitoringActive: async () => false,
  getPendingSessions: async () => "[]",
  clearPendingSessions: async () => false,
  openUsageStatsSettings: async () => false,
  openAccessibilitySettings: async () => false,
  isAccessibilityServiceEnabled: async () => false,
};

const createAndroidModule = (): AppDetectorInterface => {
  const native = NativeModules.AppDetector;
  if (!native) { if (__DEV__) console.warn("[AppDetector] Native module not found. Run prebuild + dev build."); return stub; }
  return {
    getCurrentApp: () => native.getCurrentApp(),
    hasUsageStatsPermission: () => native.hasUsageStatsPermission(),
    getUsageStats: (minutes: number) => native.getUsageStats(minutes),
    getAppName: (packageName: string) => native.getAppName(packageName),
    startBackgroundMonitoring: () => native.startBackgroundMonitoring(),
    stopBackgroundMonitoring: () => native.stopBackgroundMonitoring(),
    isBackgroundMonitoringActive: () => native.isBackgroundMonitoringActive(),
    getPendingSessions: () => native.getPendingSessions(),
    clearPendingSessions: () => native.clearPendingSessions(),
    openUsageStatsSettings: () => native.openUsageStatsSettings(),
    openAccessibilitySettings: () => native.openAccessibilitySettings(),
    isAccessibilityServiceEnabled: () => native.isAccessibilityServiceEnabled(),
  };
};

export const AppDetector: AppDetectorInterface =
  Platform.OS === "android" ? createAndroidModule() : stub;

export type { AppDetectorInterface };
export * from "./AppDetector.types";

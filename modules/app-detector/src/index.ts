import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
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
  getSessionsByDate: async () => "[]",
  getTotalDurationMs: async () => 0,
  openUsageStatsSettings: async () => false,
  setAlertThreshold: async () => false,
  getLiveSession: async () => null,
  getPermissionDiagnostics: async () => "{}",
  startVpnBlocking: async () => false,
  stopVpnBlocking: async () => false,
  isVpnActive: async () => false,
  getAndClearPendingAlert: async () => null,
};

const createAndroidModule = (): AppDetectorInterface => {
  try {
    const native = requireNativeModule("AppDetector");
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
      getSessionsByDate: (date: string) => native.getSessionsByDate(date),
      getTotalDurationMs: (pkg: string, date: string) => native.getTotalDurationMs(pkg, date),
      openUsageStatsSettings: () => native.openUsageStatsSettings(),
      setAlertThreshold: (minutes: number) => native.setAlertThreshold(minutes),
      getLiveSession: () => native.getLiveSession(),
      getPermissionDiagnostics: () => native.getPermissionDiagnostics(),
      startVpnBlocking: () => native.startVpnBlocking(),
      stopVpnBlocking: () => native.stopVpnBlocking(),
      isVpnActive: () => native.isVpnActive(),
      getAndClearPendingAlert: () => native.getAndClearPendingAlert(),
    };
  } catch (e) {
    if (__DEV__) console.warn("[AppDetector] Native module not found. Run prebuild + dev build.", e);
    return stub;
  }
};

export const AppDetector: AppDetectorInterface =
  Platform.OS === "android" ? createAndroidModule() : stub;

export type { AppDetectorInterface };
export * from "./AppDetector.types";

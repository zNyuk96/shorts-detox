export interface AppDetectorInterface {
  getCurrentApp(): Promise<string | null>;
  hasUsageStatsPermission(): Promise<boolean>;
  getUsageStats(minutes: number): Promise<Record<string, number>>;
  getAppName(packageName: string): Promise<string>;
  startBackgroundMonitoring(): Promise<boolean>;
  stopBackgroundMonitoring(): Promise<boolean>;
  isBackgroundMonitoringActive(): Promise<boolean>;
  getPendingSessions(): Promise<string>;
  clearPendingSessions(): Promise<boolean>;
  openUsageStatsSettings(): Promise<boolean>;
  openAccessibilitySettings(): Promise<boolean>;
  isAccessibilityServiceEnabled(): Promise<boolean>;
}

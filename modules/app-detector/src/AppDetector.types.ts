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
  getSessionsByDate(date: string): Promise<string>;
  getTotalDurationMs(packageName: string, date: string): Promise<number>;
  openUsageStatsSettings(): Promise<boolean>;
  setAlertThreshold(minutes: number): Promise<boolean>;
  getLiveSession(): Promise<string | null>;
  getPermissionDiagnostics(): Promise<string>;
  startVpnBlocking(): Promise<boolean>;
  stopVpnBlocking(): Promise<boolean>;
  isVpnActive(): Promise<boolean>;
  getAndClearPendingAlert(): Promise<string | null>;
}

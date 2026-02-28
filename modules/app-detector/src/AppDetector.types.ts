export interface AppDetectorInterface {
  getCurrentApp(): Promise<string | null>;
  hasUsageStatsPermission(): Promise<boolean>;
  getUsageStats(minutes: number): Promise<Record<string, number>>;
  getAppName(packageName: string): Promise<string>;
}

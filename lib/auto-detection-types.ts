/**
 * 자동 감지 서비스 타입 정의
 * - Android: UsageStatsManager + 가속도계
 * - iOS: 모션 센서 + 앱 포그라운드 감지
 */

export interface ScrollPattern {
  /** 감지된 시간 (밀리초) */
  timestamp: number;
  /** 스크롤 방향 (up, down, left, right) */
  direction: "up" | "down" | "left" | "right";
  /** 가속도 크기 */
  magnitude: number;
  /** 연속 스크롤 횟수 */
  consecutiveCount: number;
}

export interface AppUsageEvent {
  /** 앱 패키지명 (Android) 또는 번들 ID (iOS) */
  appId: string;
  /** 앱 이름 */
  appName: string;
  /** 포그라운드 시간 (밀리초) */
  durationMs: number;
  /** 이벤트 시간 */
  timestamp: number;
  /** 숏츠 앱 여부 */
  isShortsApp: boolean;
}

export interface DetectionSession {
  /** 세션 ID */
  id: string;
  /** 감지된 앱 */
  appId: string;
  /** 감지 시작 시간 */
  startTime: number;
  /** 감지 종료 시간 */
  endTime?: number;
  /** 누적된 시간 (밀리초) */
  accumulatedMs: number;
  /** 감지 방식 */
  detectionMethod: "scroll" | "usage" | "hybrid";
  /** 스크롤 패턴 데이터 */
  scrollPatterns: ScrollPattern[];
  /** 활성 상태 */
  isActive: boolean;
}

export interface DetectionConfig {
  /** 자동 감지 활성화 여부 */
  enabled: boolean;
  /** 감지할 앱 목록 */
  targetApps: string[];
  /** 스크롤 감지 임계값 (가속도 크기) */
  scrollThreshold: number;
  /** 연속 스크롤 감지 횟수 */
  consecutiveScrollCount: number;
  /** 최소 체류 시간 (밀리초) */
  minDurationMs: number;
  /** 최대 체류 시간 (밀리초) */
  maxDurationMs: number;
  /** 센서 샘플링 레이트 (Hz) */
  sensorSamplingRate: number;
  /** 백그라운드 모니터링 활성화 */
  backgroundMonitoring: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enabled: false,
  targetApps: [
    "com.google.android.youtube", // YouTube
    "com.zhiliaoapp.musically", // TikTok (Android)
    "com.instagram.android", // Instagram
    "com.facebook.katana", // Facebook
  ],
  scrollThreshold: 5, // m/s²
  consecutiveScrollCount: 3,
  minDurationMs: 1000, // 1초
  maxDurationMs: 60000, // 1분
  sensorSamplingRate: 50, // 50Hz
  backgroundMonitoring: true,
};

export interface IDetectionService {
  /** 감지 서비스 시작 */
  start(): Promise<void>;
  /** 감지 서비스 중지 */
  stop(): Promise<void>;
  /** 감지 상태 확인 */
  isRunning(): boolean;
  /** 권한 확인 */
  checkPermissions(): Promise<boolean>;
  /** 권한 요청 */
  requestPermissions(): Promise<boolean>;
  /** 현재 세션 조회 */
  getCurrentSession(): DetectionSession | null;
  /** 세션 종료 및 저장 */
  endSession(): Promise<void>;
}

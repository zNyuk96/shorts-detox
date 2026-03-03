# Shorts Detox — 코드 분석 및 개선 사항 정리

> 분석 기준일: 2026-03-03
> 브랜치: `claude/fetch-play-store-qJOkT`
> 분석 범위: 쇼츠 시청 감지, 알림, 포그라운드 서비스 제어 전 레이어

---

## 전체 아키텍처 요약

```
[Android Native Layer]
  AppMonitorService (Foreground Service, 2초 폴링)
    └─ UsageStatsManager → 포그라운드 앱 감지
    └─ SharedPreferences → pendingSessions 저장
  ShortsScrollService (Accessibility Service)
    └─ TYPE_VIEW_SCROLLED 이벤트 → scrollCount 증가

[JavaScript Layer]
  realAppDetectionService
    └─ AppState → active 시 pendingSessions 로드
  backgroundTaskService
    └─ setInterval 5초 → 임계값 체크 → setPendingDetox + 알림
  foregroundService
    └─ AppState 변화 감지 → triggerRecovery 콜백
  notificationService
    └─ Expo Notifications → 즉시 알림 발송

[React UI Layer]
  AppProvider → todayWatchMs, sessions 상태
  HomeScreen → 1분마다 임계값 체크 → /detox 이동
  PendingDetoxHandler → background→active 복귀 시 /detox 이동
```

---

## 1. 쇼츠 감지 (Detection) — 버그 및 개선 포인트

### 1-1. [버그][심각] `todayWatchMs` 계산에 날짜 필터링 누락

**파일:** `lib/app-context.tsx:188-191`

```typescript
// 현재 코드 (문제)
const todayStats = getPlatformStats(sessions); // ← 모든 날짜 합산
const storedTodayMs = Object.values(todayStats).reduce((sum, s) => sum + (s?.totalMs || 0), 0);
const todayWatchMs = storedTodayMs;
```

`getPlatformStats(sessions)`는 날짜 필터 없이 전체 세션을 합산한다.
결과적으로 홈 화면에 표시되는 오늘 시청 시간, 임계값 체크, 원형 그래프가 전부 **누적 합산값**을 표시하게 된다.

**수정 방향:**
```typescript
const todayStats = getPlatformStats(sessions.filter(s => s.date === today));
```

---

### 1-2. [버그][심각] 세션 ID 충돌 가능성

**파일:** `modules/app-detector/android/.../AppMonitorService.kt:133`

```kotlin
put("id", "bg-$start")  // start = sessionStartTime (밀리초)
```

같은 앱을 빠르게 전환하거나 서비스 재시작 시 동일한 `startTime`이 발생하면 ID 중복이 발생한다.
`real-app-detection.ts`의 `addSession()`에서 중복 체크가 없으므로 같은 세션이 2회 저장된다.

**수정 방향:**
- Native: `"bg-${start}-${(Math.random() * 1000).toInt()}"` 또는 UUID 사용
- JS: `addSession()` 진입 시 ID 중복 체크 후 skip

---

### 1-3. [버그][중간] `platform` 분류 로직이 패키지명 부분 일치에 의존

**파일:** `AppMonitorService.kt:125-130`

```kotlin
val platform = when {
    pkg.contains("youtube") -> "youtube"      // ← com.google.android.youtube.creator도 youtube
    pkg.contains("musically") || pkg.contains("tiktok") -> "tiktok"
    pkg.contains("instagram") -> "instagram"
    else -> "other"
}
```

`SHORTS_PACKAGES`가 정확한 패키지를 이미 알고 있음에도 `contains()`로 분류하여 오분류 위험이 있다.
`com.google.android.youtube.creator`, `com.instagram.boomerang` 등이 잘못 분류될 수 있다.

**수정 방향:**
```kotlin
val platform = when (pkg) {
    "com.google.android.youtube" -> "youtube"
    "com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok" -> "tiktok"
    "com.instagram.android" -> "instagram"
    "com.facebook.katana" -> "other"  // Facebook은 Reels라 별도 플랫폼으로 분리 고려
    else -> "other"
}
```

---

### 1-4. [버그][중간] Race Condition — `scrollCount` 초기화 타이밍

**파일:** `AppMonitorService.kt:123-124`

```kotlin
val scrollCount = prefs.getInt(KEY_SCROLL_COUNT, 0)
prefs.edit().putInt(KEY_SCROLL_COUNT, 0).apply()  // ← apply()는 비동기
```

`ShortsScrollService.kt`의 스크롤 이벤트가 `apply()` 완료 전에 새 카운트를 저장하면,
초기화 직후 스크롤이 유실된다.

**수정 방향:**
`commit()` 사용(동기) 또는 원자적 read-and-reset 패턴 적용:
```kotlin
val scrollCount = prefs.getInt(KEY_SCROLL_COUNT, 0)
prefs.edit().putInt(KEY_SCROLL_COUNT, 0).commit()  // 동기 처리
```

---

### 1-5. [버그][중간] `onDestroy()`에서 `scrollCount` 초기화 누락

**파일:** `AppMonitorService.kt:187-195`

```kotlin
override fun onDestroy() {
    super.onDestroy()
    timer?.cancel()
    prefs.edit().putBoolean(KEY_IS_RUNNING, false).apply()
    val now = System.currentTimeMillis()
    currentPkg?.let { pkg ->
        if (sessionStartTime > 0L && isShorts(pkg)) saveSession(pkg, sessionStartTime, now)
        // ↑ scrollCount가 저장되지만 0으로 초기화 안 됨
    }
}
```

서비스 종료 시 `saveSession()` 내부에서 `scrollCount`를 읽고 0으로 초기화하지만,
서비스가 `START_STICKY`로 재시작된 후 이전 scrollCount가 SharedPreferences에 남아 다음 세션에 오염된다.

---

### 1-6. [버그][경미] UsageEvents Fallback이 Stale Data 반환 가능

**파일:** `AppMonitorService.kt:114`

```kotlin
return q(now - 10_000L) ?: q(now - 3 * 60_000L)
```

최근 10초간 이벤트가 없으면 최근 3분으로 fallback한다.
만약 사용자가 3분 전에 YouTube를 잠깐 켰다가 꺼서 현재는 홈 화면에 있을 때,
YouTube가 포그라운드로 잘못 감지되어 세션이 계속 누적된다.

**수정 방향:**
`ACTIVITY_PAUSED` / `MOVE_TO_BACKGROUND` 이벤트도 함께 체크하여 앱이 실제로 포그라운드인지 검증.

---

### 1-7. [개선] 감지 앱 목록이 4곳에 분산

동일한 쇼츠 앱 목록이 4개 파일에 따로 정의되어 있어 한 곳을 수정하면 나머지가 불일치해진다:

| 파일 | 위치 |
|------|------|
| `AppMonitorService.kt:35-41` | Kotlin `SHORTS_PACKAGES` Set |
| `plugins/withAppDetector.js:29-35` | queries targets 배열 |
| `lib/detection-android.ts` | `SHORTS_APPS` 객체 |
| `lib/app-tracking-service.ts` | `SHORTS_APPS` 객체 |

현재 `com.facebook.katana`(Facebook Reels)가 Native는 포함, JS는 `reels`로 별도 분류하여 불일치.

**수정 방향:**
- JS: `constants/shorts-apps.ts` 단일 파일로 통합
- Native: 설정 파일(JSON) 또는 `strings.xml` 기반으로 외부화 검토

---

### 1-8. [개선] `isBackgroundMonitoringActive()`가 실제 서비스 상태를 반영하지 않음

**파일:** `AppDetectorModule.kt:83-89`

```kotlin
val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
promise.resolve(prefs.getBoolean(AppMonitorService.KEY_IS_RUNNING, false))
```

SharedPreferences의 flag를 반환하므로 서비스가 OS에 의해 강제 종료되어도 `true`가 반환된다.
실제로는 `ActivityManager.getRunningServices()`로 서비스 실행 여부를 확인해야 한다.

---

### 1-9. [개선] `ShortsScrollService` 스크롤 방향 미구분

**파일:** `ShortsScrollService.kt:19-27`

모든 `TYPE_VIEW_SCROLLED` 이벤트를 카운트하지만, 숏츠는 세로 스크롤(다음 영상으로 이동)만 의미 있다.
좌우 스크롤(탭 전환)도 카운트되어 `scrollFrequency`가 과도하게 높게 측정된다.

AccessibilityEvent에서 `scrollDeltaX`, `scrollDeltaY`를 비교하여 세로 스크롤만 카운트하도록 개선 가능.

---

### 1-10. [개선] 접근성 서비스 설정 XML 파일 확인 필요

**파일:** `plugins/withAppDetector.js:79`

```javascript
"android:resource": "@xml/shorts_scroll_config"
```

`@xml/shorts_scroll_config` XML 리소스가 실제로 존재하는지 확인 필요.
없을 경우 접근성 서비스 등록 자체가 실패하여 스크롤 카운팅 전체가 동작하지 않는다.

---

### 1-11. [개선] JS 레이어에서 `getRealCurrentApp()`, `getScrollCount()` 등이 stub

**파일:** `lib/real-app-detection.ts:77-81`

```typescript
getCurrentApp(): CurrentAppInfo | null { return null; }  // ← 항상 null
getScrollCount() { return 0; }                            // ← 항상 0
getSessionDuration() { return 0; }                       // ← 항상 0
```

인터페이스에 노출되어 있지만 실제 값을 반환하지 않아 호출하는 쪽이 오해할 수 있다.
미사용 메서드는 제거하거나 `@deprecated` 표시 필요.

---

## 2. 알림 (Notification) — 버그 및 개선 포인트

### 2-1. [버그][심각] `resetDailyAlert()`가 자동으로 호출되지 않음

**파일:** `lib/notification-service.ts:134-141`

`resetDailyAlert()` 메서드가 정의되어 있지만 어디서도 자동 호출되지 않는다.
결과적으로 어제 밤 11:55에 알림을 보냈으면, 오늘 00:00에 앱을 켜도 `lastAlertTime`이 남아있어
5분 미만이면 알림이 발송되지 않는다.

**수정 방향:**
`loadAlertState()` 또는 `checkAndSendAlert()` 진입 시 날짜 변경 감지 후 자동 초기화:
```typescript
const todayStr = getTodayDateString();
if (this.alertState.lastAlertDate !== todayStr) {
  await this.resetDailyAlert();
}
```
`AlertState`에 `lastAlertDate` 필드 추가 필요.

---

### 2-2. [버그][심각] 임계값 체크가 포그라운드 전용 (`index.tsx` 1분 interval)

**파일:** `app/(tabs)/index.tsx:109-125`

```typescript
const checkAlerts = async () => { ... };
checkAlerts();
const interval = setInterval(checkAlerts, 60000);  // 1분마다
```

이 체크는 HomeScreen이 마운트된 동안만 동작한다.
사용자가 Stats 탭이나 Settings 탭에 있으면 이 interval이 실행되지 않는다.
`backgroundTaskService`에서 5초마다 체크하지만 백그라운드 JS 실행 제한이 있다.

**수정 방향:**
임계값 체크 로직을 HomeScreen에서 제거하고 `AppProvider` 레벨의 단일 위치에서 관리.

---

### 2-3. [버그][중간] 임계값 초과 시 즉각 강제 라우팅이 UX 파괴

**파일:** `app/(tabs)/index.tsx:118`

```typescript
router.replace(`/detox?watchMs=${todayWatchMs}` as any);
```

사용자가 Stats 화면을 보거나 게임 중일 때 HomeScreen의 1분 체크가 즉각 `/detox`로 보낸다.
또한 `foregroundService.triggerRecovery()`가 동일한 타이밍에 호출되어 중복 알림 + 중복 라우팅 가능성.

**수정 방향:**
- 강제 이동 대신 Modal 또는 Banner로 사용자에게 선택권 제공
- `triggerRecovery()` 호출은 한 곳에서만 수행

---

### 2-4. [버그][중간] `foregroundService.triggerRecovery()`와 `backgroundTaskService.checkThreshold()`의 중복 detox 트리거

두 경로에서 독립적으로 `setPendingDetox()`, 알림 발송, 라우팅 콜백이 실행된다:

```
HomeScreen useEffect
  → notificationService.checkAndSendAlert()   ← 알림 1
  → foregroundService.triggerRecovery()
      → setPendingDetox()
      → scheduleNotificationAsync()            ← 알림 2
      → onThresholdExceeded()                  ← 라우팅 A

backgroundTaskService.checkThreshold()
  → setPendingDetox()
  → notificationService.checkAndSendAlert()   ← 알림 3 (가능)
  → onThresholdExceeded()                      ← 라우팅 B
```

임계값 초과 시 최대 3개의 알림이 거의 동시에 발송될 수 있다.

**수정 방향:**
- 단일 `detoxOrchestrator` 패턴으로 통합
- 한 번 트리거된 경우 플래그로 중복 방지

---

### 2-5. [버그][중간] `checkAndSendAlert()`와 `checkAndSendExcessAlert()`가 `lastAlertTime` 공유

**파일:** `lib/notification-service.ts:85-187`

두 메서드가 동일한 `this.alertState.lastAlertTime`을 공유한다.
`checkAndSendAlert()`가 알림을 보내면 `checkAndSendExcessAlert()`의 카운트도 리셋되어
초과 시간 반복 알림이 의도대로 동작하지 않는다.

---

### 2-6. [개선] 앱 완전 종료 시 알림 불가

`trigger: null` (즉시 발송)을 사용하므로 앱 프로세스가 완전히 종료되면 알림을 보낼 수 없다.
Android Foreground Service는 살아있지만 JS Notifications 스택은 동작하지 않는다.

**수정 방향:**
- Native `AppMonitorService.kt`에서 임계값 초과 시 직접 Notification API 호출
- 또는 `expo-notifications`의 scheduled trigger를 활용한 예약 알림 (앱 시작 시 예약)

---

### 2-7. [개선] 알림 권한이 앱 시작 시 자동 요청되지 않음

**파일:** `lib/notification-service.ts:72-80`

`requestPermissions()`가 `NotificationService` 생성자에서 호출되지 않는다.
알림 권한 없이 앱을 사용하면 모든 알림이 무음 실패한다.

**수정 방향:**
온보딩 플로우 또는 설정 화면에서 알림 권한 상태 표시 및 요청 유도 추가.

---

## 3. 포그라운드 서비스 제어 — 버그 및 개선 포인트

### 3-1. [버그][심각] `backgroundTaskService`의 `setInterval`이 백그라운드에서 실제로 작동하지 않음

**파일:** `lib/background-task-service.ts:27-29`

```typescript
this.monitoringInterval = setInterval(() => {
  this.monitorShortsUsage();
}, this.checkIntervalMs);  // 5초
```

React Native의 `setInterval`은 앱이 백그라운드 상태일 때:
- **iOS**: 수 초 이내에 실행 중단 (최대 30초 허용 후 suspend)
- **Android**: Doze 모드 진입 시 제한됨

클래스 이름이 `BackgroundTaskService`이지만 실제로는 **포그라운드 전용** 타이머다.

**수정 방향:**
- 진정한 백그라운드 작업은 Android `AppMonitorService`(Kotlin)에서 처리
- JS 레이어는 포그라운드 상태에서만 체크하도록 명시
- `expo-task-manager` + `expo-background-fetch`로 교체 검토

---

### 3-2. [버그][중간] `ForegroundService`의 `startBackgroundCheck()`가 빈 껍데기

**파일:** `lib/foreground-service.ts:84-93`

```typescript
private startBackgroundCheck(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
        // 이 메서드는 백그라운드에서 호출되므로
        // 실제 감지는 detection-service에서 처리
        console.log("[ForegroundService] Background check tick");
    }, 30000);
}
```

30초마다 console.log만 찍는 의미 없는 interval이다.
백그라운드에서는 이 interval 자체도 실행되지 않는다.

---

### 3-3. [버그][중간] `pending-detox`의 1시간 만료 정책이 너무 짧음

**파일:** `lib/pending-detox.ts:4`

```typescript
const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1시간
```

사용자가 임계값을 초과하고 1시간 이상 지나서 앱을 열면 detox 화면이 표시되지 않는다.
특히 밤에 초과하고 다음날 아침에 앱을 켜면 pending이 사라진다.

**수정 방향:**
당일 자정까지 유효 (날짜 기반 만료):
```typescript
const isExpired = data.date !== getTodayDateString(); // date 필드 추가 필요
```

---

### 3-4. [버그][경미] `ForegroundService`와 `backgroundTaskService`의 `onThresholdExceeded` 콜백이 분리

- `foregroundService.start(callback)` → `HomeScreen`에 등록
- `backgroundTaskService.setOnThresholdExceeded(callback)` → 미등록 (현재 앱 컨텍스트에서 설정 안 됨)

`backgroundTaskService`의 콜백이 실제로 등록되지 않아 `checkThreshold()` 내의 콜백 호출이 무효다.

---

### 3-5. [개선] `ForegroundService` 이름 혼동

**파일:** `lib/foreground-service.ts`

`ForegroundService`라는 클래스명은 Android의 Foreground Service(Kotlin `AppMonitorService`)와
같은 개념처럼 보이지만 실제로는 `AppState` 변화를 감지하는 JS 레이어 유틸리티다.

`AppStateMonitor` 또는 `DetoxTriggerService`로 이름 변경을 권장.

---

## 4. 데이터 무결성 및 아키텍처

### 4-1. [버그][심각] 날짜 계산이 UTC 기준 → 한국 시간대 오류

**파일:** `lib/store.ts:163-165`

```typescript
export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];  // ← UTC 기준
}
```

`toISOString()`은 UTC 기준이다.
한국(UTC+9)에서는 **오후 9시~자정** 사이에 날짜가 하루 앞서 표시된다.
오후 9시 이후 시청 기록이 다음날 날짜로 저장된다.

**수정 방향:**
```typescript
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

`AppMonitorService.kt`의 `SimpleDateFormat`은 `Locale.getDefault()` 사용으로 문제없음.
JS와 Kotlin 간 날짜 불일치 가능성도 있음.

---

### 4-2. [버그][중간] `addSession()`에서 중복 ID 체크 없음

**파일:** `lib/store.ts:95-99`

```typescript
export async function addSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  sessions.push(session);  // ← 중복 체크 없음
  await saveSessions(sessions);
}
```

동일한 pending session이 두 번 `loadPendingSessions()` → `addSession()`되면
(예: 포그라운드 복귀 시 두 번 이벤트 발생) 같은 세션이 2배로 기록된다.

**수정 방향:**
```typescript
if (sessions.some(s => s.id === session.id)) return; // 중복 skip
sessions.push(session);
```

---

### 4-3. [버그][중간] `backgroundTaskService.getTodayTotalWatchTime()`이 수동 입력 세션 제외

**파일:** `lib/background-task-service.ts:124-126`

```typescript
const todayMs = sessions
  .filter((s) => s.date === today && s.isAutoDetected)  // ← isAutoDetected만
  .reduce((sum, s) => sum + s.durationMs, 0);
```

사용자가 수동으로 시청 시간을 입력해도 임계값 체크에 포함되지 않는다.
`app-context.tsx`의 `todayWatchMs`는 모든 세션을 포함하므로 표시값과 실제 체크값이 다르다.

---

### 4-4. [개선] `loadSessions()` + `loadSettings()`가 5초마다 AsyncStorage에서 반복 로드

**파일:** `lib/background-task-service.ts:62-76`

5초마다 `monitorShortsUsage()` → `loadSessions()` + `loadSettings()`를 호출한다.
90일치 세션이 쌓이면 AsyncStorage 직렬화/역직렬화 비용이 커진다.

**수정 방향:**
- Context에서 제공하는 메모리 캐시를 활용
- 설정은 변경 시에만 다시 로드 (이벤트 기반)

---

### 4-5. [개선] Streak 계산 로직에 엣지 케이스

**파일:** `lib/app-context.tsx:102-118`

```typescript
} else if (lastDate !== today) {
  newStreak = 1;  // ← 2일 이상 빈 경우에도 1로 초기화 (정상)
  ...
}
```

`lastDate === today`일 때 `streak`를 그대로 유지하는데,
앱을 하루 여러 번 실행하면 streak가 중복 증가하지 않아 정상이다.
단, `lastDate === yesterdayStr`인 경우에만 streak를 +1 하는 로직은
오늘 목표를 달성했는지 여부를 고려하지 않는다. (시청 기록 없어도 streak 증가)

---

### 4-6. [개선] `setPendingDetox()`가 여러 코드 경로에서 동시 호출 가능

```
foregroundService.triggerRecovery() → setPendingDetox()
backgroundTaskService.checkThreshold() → setPendingDetox()
HomeScreen checkAlerts → foregroundService.triggerRecovery() → setPendingDetox()
```

AsyncStorage write가 거의 동시에 발생하면 마지막 write가 이기는 방식이라
데이터 유실은 없지만 불필요한 I/O가 발생한다.

---

## 5. Play Store 배포 요건 (신규)

### 5-1. [필수] 접근성 서비스 사용 정책 준수

**Google Play 정책:** 접근성 서비스(`BIND_ACCESSIBILITY_SERVICE`)는
장애인 접근성 지원 목적 이외 사용 시 앱 심사 거절 또는 게시 중단 대상.

**현재 사용 목적:** 스크롤 카운팅 (`ShortsScrollService.kt`)

**수정 방향:**
- 접근성 서비스 없이도 기본 기능(UsageStats 기반 감지)이 동작하도록 폴백 구현
- Play Store 심사 설명에 장애인 접근성 지원과 관련된 사용 목적 기술 (예: 스크린리더 호환 UI)
- 또는 접근성 서비스 사용을 제거하고 스크롤 카운팅을 포기

---

### 5-2. [필수] `PACKAGE_USAGE_STATS` 권한 심사 통과 요건

민감한 권한(`PACKAGE_USAGE_STATS`)은 Play Store 심사에서 사용 목적을 명확히 기술해야 한다.

**준비 사항:**
- Google Play Console의 "앱 콘텐츠" > "권한" 섹션에 사용 목적 기술
- 선언 내용: "사용자의 쇼츠 앱 사용 시간을 측정하여 디지털 웰빙을 돕기 위함"

---

### 5-3. [필수] 개인정보처리방침 페이지 없음

Play Store 배포 필수 요건: 사용자 데이터를 수집하는 앱은 개인정보처리방침 URL 필요.

현재 수집 데이터:
- 패키지명 (어떤 앱 사용했는지)
- 시청 시간
- 스크롤 횟수

**수정 방향:**
- 개인정보처리방침 웹페이지 또는 인앱 화면 작성
- 수집 항목, 사용 목적, 보존 기간 (현재 90일), 제3자 제공 여부 명시
- `app.json`에 `privacyPolicyUrl` 설정

---

### 5-4. [필수] 앱 내 권한 요청 UX 개선

현재 권한 요청 흐름:
1. PACKAGE_USAGE_STATS → 시스템 설정으로 이동 (AlertDialog)
2. 접근성 서비스 → 시스템 설정으로 이동
3. 알림 권한 → 자동 요청 없음

**수정 방향:**
- 권한별 "왜 필요한지" 설명하는 온보딩 화면 추가
- 권한 거부 시 기능 제한 안내 및 대안 제시
- 알림 권한을 앱 시작 시 명시적으로 요청

---

### 5-5. [권장] 앱 아이콘에 실제 아이콘 적용

**파일:** `AppMonitorService.kt:170,179`

```kotlin
.setSmallIcon(android.R.drawable.ic_menu_recent_history)  // ← 시스템 기본 아이콘
```

알림에 `android.R.drawable` 시스템 아이콘을 사용하고 있다.
Play Store 정책상 문제는 아니지만 브랜딩 측면에서 앱 전용 아이콘으로 교체 필요.

---

### 5-6. [권장] 최소 SDK 버전 및 타겟 SDK 확인

**파일:** `app.config.ts`

```
minSdkVersion: 24  (Android 7.0)
```

2024년 기준 Play Store 신규 앱의 타겟 SDK 최소 요건: **API 34** (Android 14)
`targetSdkVersion`이 설정되어 있는지 확인 필요.

---

## 6. 코드 품질 개선 사항

### 6-1. [개선] `detection-android.ts`의 JavaScript 레이어 감지와 Native Service 중복

`lib/detection-android.ts`는 JS 레이어에서 가속도계 + 5초 interval로 앱 감지를 시도하는데,
이미 `AppMonitorService.kt`(Native Foreground Service)가 같은 역할을 더 정확하게 수행한다.
두 레이어의 역할이 중복되어 불필요한 배터리 소모가 발생한다.

---

### 6-2. [개선] `AttentionScore` 계산의 기준값이 하드코딩

**파일:** `lib/store.ts:336-339`

```typescript
let watchScore = Math.max(0, 100 - (watchTimeMinutes / 30) * 50);  // 30분 기준
let scrollScore = Math.max(0, 100 - avgScrollFrequency * 30);       // 초당 1회 기준
```

사용자의 `dailyGoalMinutes` 설정(기본 30분)이 점수 계산에 반영되지 않는다.
목표가 60분인 사용자도 30분 기준으로 감점된다.

---

### 6-3. [개선] `ForegroundService`에 미사용 `AppState` subscription 중복

`real-app-detection.ts`, `pending-detox-handler.tsx`, `foreground-service.ts`가
각각 독립적인 `AppState.addEventListener`를 등록한다.
하나의 `AppState` 매니저에서 이벤트를 분배하는 패턴으로 통합 권장.

---

### 6-4. [개선] console.log/warn/error가 프로덕션 빌드에 포함

서비스 파일 전반에 `console.log("[BackgroundTask] ...")`, `console.warn("...")` 등이 다수 존재.
프로덕션 빌드에서는 제거하거나 로그 레벨로 조건부 처리 필요.

---

## 우선순위 요약

| 우선순위 | 항목 | 영향 |
|---------|------|------|
| 🔴 P0 | 1-1. `todayWatchMs` 날짜 필터 누락 | 홈 화면 전체 데이터 오류 |
| 🔴 P0 | 4-1. UTC 날짜 계산 오류 | 오후 9시 이후 날짜 오표시 |
| 🔴 P0 | 5-1. 접근성 서비스 Play Store 정책 | 앱 심사 거절 위험 |
| 🔴 P0 | 5-3. 개인정보처리방침 없음 | Play Store 게시 불가 |
| 🟠 P1 | 1-2. 세션 ID 중복 | 데이터 중복 저장 |
| 🟠 P1 | 2-1. 알림 일일 초기화 미작동 | 알림 미발송 |
| 🟠 P1 | 2-4. 중복 알림 트리거 | 알림 폭탄 |
| 🟠 P1 | 3-1. `setInterval` 백그라운드 미작동 | 백그라운드 체크 무의미 |
| 🟡 P2 | 1-3. platform 분류 오류 | 통계 오분류 |
| 🟡 P2 | 1-4. scrollCount race condition | 스크롤 데이터 부정확 |
| 🟡 P2 | 2-2. 임계값 체크 포그라운드 전용 | 백그라운드 미감지 |
| 🟡 P2 | 4-2. 세션 중복 저장 | 통계 2배 과대 계산 |
| 🟡 P2 | 4-3. 수동 입력 세션 임계값 제외 | 알림 미발송 |
| 🟢 P3 | 1-7. 앱 목록 분산 | 유지보수성 저하 |
| 🟢 P3 | 3-5. ForegroundService 이름 혼동 | 코드 가독성 |
| 🟢 P3 | 6-1. JS/Native 감지 중복 | 배터리 낭비 |
| 🟢 P3 | 6-4. console.log 프로덕션 포함 | 성능 및 보안 |

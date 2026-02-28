# 네이티브 스크롤 연동 가이드 (Android)

다른 앱(유튜브, 인스타, 틱톡 등)에서의 **위아래 스윕(스크롤)** 을 감지해 JS로 전달하려면 Android 네이티브 모듈이 필요합니다.

## 제한 사항

- **iOS**: 다른 앱의 스크롤/제스처를 감지하는 공개 API가 없습니다. 스토어 정책상 불가에 가깝습니다.
- **Android**: `AccessibilityService`로 일부 스크롤 이벤트를 받을 수 있으나, **접근성 목적이 아닌 사용은 Play 정책 위반 소지**가 있어 주의가 필요합니다. 본 프로젝트에는 기본으로 포함하지 않습니다.

## JS 쪽에서 이미 준비된 것

- `realAppDetectionService.recordScrollFromNative(timestamp?: number)`  
  → 네이티브에서 **이 메서드가 호출되도록** 하거나, 아래 이벤트를 보내면 됩니다.
- **네이티브 이벤트 구독**: `ScrollDataModule`이 있으면 다음 이벤트를 자동 구독합니다.
  - 이벤트 이름: `onShortsScroll` 또는 `onScroll`
  - payload: `{ timestamp: number }` (밀리초, 선택)

즉, **Android 네이티브에서 위 이벤트만 보내주면** 1초~1분 간격 스크롤 패턴·유효 시청 시간·임계값 알람이 그대로 동작합니다.

## Android 네이티브 모듈 인터페이스

React Native 브릿치용으로 다음 중 하나를 구현하면 됩니다.

### 1) 이벤트 발송 (권장)

네이티브에서 **스크롤이 감지될 때마다** 이벤트를 한 번 보냅니다.

- **모듈 이름**: `ScrollDataModule` (기존 코드에서 이미 참조 중)
- **이벤트 이름**: `onShortsScroll` 또는 `onScroll`
- **payload**: `{ timestamp: number }` (선택, 없으면 JS에서 `Date.now()` 사용)

예시 (Kotlin, React Native 브릿지):

```kotlin
// 스크롤 감지 시 (예: AccessibilityService 콜백 내부)
val params = Arguments.createMap().apply {
  putDouble("timestamp", System.currentTimeMillis().toDouble())
}
sendEvent(reactContext, "onShortsScroll", params)
```

`sendEvent`는 `RCTDeviceEventEmitter` 또는 해당 모듈의 `ReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onShortsScroll", params)` 등으로 구현하면 됩니다.

### 2) JS에서 호출하는 메서드

네이티브에서 “스크롤 한 번 발생”을 기록만 하고, JS는 폴링하지 않는 방식이라면:

- 메서드 이름 예: `addScrollTimestamp`
- 인자: `timestampMs: Double` (밀리초)

JS에서 주기적으로 `ScrollDataModule.addScrollTimestamp(Date.now())`를 호출하는 방식은 **다른 앱 화면**에서는 불가능하므로, 실제로는 **네이티브에서 감지 → 이벤트 발송**이 맞습니다.

## 테스트용: 스크롤 시뮬레이션 (네이티브 없이)

네이티브 모듈 없이 **유효 시청 시간·임계값·디톡스 플로우**만 검증하려면:

1. 로그인 화면에서 **테스트 모드로 시작**
2. **설정** 탭에서 **스크롤 시뮬레이션** 켜기  
   → 5~15초 간격으로 가짜 스크롤이 들어가며, 1s~1분 패턴으로 누적됩니다.
3. 설정한 **알람 임계값**(예: 30분)까지 기다리면 알림 + 디톡스 페이지가 뜨는지 확인할 수 있습니다.

실기기에서 “다른 앱에서 스크롤”을 흉내 내지 않고도, 로직만 검증할 때 유용합니다.

## 요약

| 항목 | 내용 |
|------|------|
| iOS | 다른 앱 스크롤 감지 불가 (정책·API 제한) |
| Android | `ScrollDataModule`에서 `onShortsScroll` / `onScroll` 이벤트로 `{ timestamp }` 전달하면 JS가 자동 연동 |
| 테스트 | 테스트 모드 + 설정의 “스크롤 시뮬레이션”으로 네이티브 없이 동작 검증 가능 |

네이티브 연동이 어렵다면, **스크롤 시뮬레이션**으로 플로우를 확인하고, 실제 서비스에서는 **포그라운드 앱 + 체류 시간**만으로 누적하는 현재 방식만 사용해도 됩니다.

import { Platform, Linking } from "react-native";

const APP_NAME = "숏츠 디톡스";

/**
 * Android: 접근성 설정 화면으로 이동 (설정 > 접근성 목록)
 * 사용자가 목록에서 '숏츠 디톡스'를 찾아 사용 설정을 켤 수 있음
 * iOS: 접근성으로 다른 앱 스크롤 감지 불가 → 앱 설정으로 이동
 */
export async function openAccessibilitySettings(): Promise<boolean> {
  if (Platform.OS === "android") {
    try {
      const { startActivityAsync, ActivityAction } = await import("expo-intent-launcher");
      await startActivityAsync(ActivityAction.ACCESSIBILITY_SETTINGS);
      return true;
    } catch (e) {
      console.warn("[AccessibilitySettings] Failed to open:", e);
      return false;
    }
  }
  if (Platform.OS === "ios") {
    try {
      await Linking.openURL("app-settings:");
      return true;
    } catch (e) {
      console.warn("[AccessibilitySettings] Failed to open iOS settings:", e);
      return false;
    }
  }
  return false;
}

/** 자동 감지 켤 때 보여줄 접근성 안내 문구 (설정 화면으로 보낼 때) */
export const ACCESSIBILITY_PROMPT_MESSAGE = [
  `자동 감지를 사용하려면 접근성 권한이 필요해요.`,
  ``,
  `다음 화면에서 '${APP_NAME}'을(를) 찾아 사용 설정을 켜주세요.`,
  ``,
  `🔒 개인정보 안내:`,
  `• 스크롤·시청 기록은 서버나 외부로 전송되지 않아요.`,
  `• 모든 데이터는 이 기기에만 저장됩니다.`,
].join("\n");

/** 설정 > 자동 감지 섹션에 항상 보여줄 로컬 전용 안내 (짧은 버전) */
export const PRIVACY_NOTICE_LOCAL_ONLY =
  "스크롤·시청 기록은 서버에 전송되지 않으며, 이 기기에만 저장됩니다.";

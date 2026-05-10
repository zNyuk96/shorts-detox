import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { getPendingDetox, clearPendingDetox } from "@/lib/pending-detox";
import { AppDetector } from "@/modules/app-detector/src";

/**
 * 앱이 포그라운드로 돌아올 때 pending detox가 있으면 디톡스 페이지로 이동
 * - AsyncStorage pending (JS 측 설정)
 * - 네이티브 SharedPreferences pending (임계값 초과 시 서비스가 설정)
 */
export function PendingDetoxHandler() {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const checkAndNavigate = async () => {
    // 1. 네이티브 서비스가 설정한 alert 확인 (우선순위 높음)
    if (Platform.OS === "android") {
      try {
        const alertJson = await AppDetector.getAndClearPendingAlert();
        if (alertJson) {
          const { totalMs } = JSON.parse(alertJson);
          router.replace(`/detox?watchMs=${totalMs}` as any);
          return;
        }
      } catch {}
    }
    // 2. JS 측 pending detox 확인
    const pending = await getPendingDetox();
    if (pending) {
      await clearPendingDetox();
      router.replace(`/detox?watchMs=${pending.watchMs}` as any);
    }
  };

  useEffect(() => {
    checkAndNavigate();

    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (appState.current === "background" && nextState === "active") {
        await checkAndNavigate();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

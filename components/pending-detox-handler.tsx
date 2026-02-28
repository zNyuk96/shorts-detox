import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getPendingDetox, clearPendingDetox } from "@/lib/pending-detox";

/**
 * 앱이 포그라운드로 돌아올 때 pending detox가 있으면 디톡스 페이지로 이동
 */
export function PendingDetoxHandler() {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (appState.current === "background" && nextState === "active") {
        const pending = await getPendingDetox();
        if (pending) {
          await clearPendingDetox();
          router.replace(`/detox?watchMs=${pending.watchMs}` as any);
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

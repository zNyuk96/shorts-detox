import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { ScreenContainer } from "@/components/screen-container";
import { formatMinutes } from "@/lib/store";
import { debugLogger } from "@/lib/debug-logger";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { AppDetector } from "@/modules/app-detector/src";
import { Platform } from "react-native";

const GOAL_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings } = useAppContext();
  const { user, logout } = useAuth();
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [hasUsagePermission, setHasUsagePermission] = useState(false);
  const waitingForPerm = useRef(false);
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [debugLogs, setDebugLogs] = useState("");

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if (Platform.OS !== "android") return;
    try {
      const [usage, isRunning] = await Promise.all([
        AppDetector.hasUsageStatsPermission(),
        AppDetector.isBackgroundMonitoringActive(),
      ]);
      setHasUsagePermission(usage);
      setAutoDetectionEnabled(isRunning || !!settings.autoDetectionEnabled);
      debugLogger.log("PERM", `설정화면 mount → 권한: ${usage}, 서비스: ${isRunning}`);

      // 자동 진단 실행
      await runDiagnostics();
    } catch (e) {
      debugLogger.log("PERM", `설정화면 mount 에러: ${e}`);
    }
  };

  const runDiagnostics = async () => {
    if (Platform.OS !== "android") return;
    try {
      const diagJson = await AppDetector.getPermissionDiagnostics();
      const diag = JSON.parse(diagJson);
      debugLogger.log("DIAG", "=== 진단 시작 ===");
      debugLogger.log("DIAG", `reactContext: ${diag.reactContextNull ? "NULL!" : "OK"}`);
      debugLogger.log("DIAG", `pkg: ${diag.packageName}`);
      debugLogger.log("DIAG", `SDK: ${diag.sdkVersion}, ${diag.manufacturer} ${diag.model}`);
      debugLogger.log("DIAG", `activity: ${diag.currentActivityNull ? "NULL!" : `OK (${diag.activityClass})`}`);
      debugLogger.log("DIAG", `AppOps mode: ${diag.appOpsModeLabel} (raw=${diag.appOpsMode}), uid=${diag.uid}`);
      debugLogger.log("DIAG", `UsageStats: null=${diag.usageStatsNull}, count=${diag.usageStatsCount}`);
      if (diag.usageStatsSample) debugLogger.log("DIAG", `  sample: ${diag.usageStatsSample}`);
      if (diag.usageStatsError) debugLogger.log("DIAG", `  ERROR: ${diag.usageStatsError}`);
      debugLogger.log("DIAG", `recentEvents(1min): ${diag.recentEventsCount ?? diag.recentEventsError}`);
      debugLogger.log("DIAG", `hasPermResult: ${diag.hasPermResult}`);
      debugLogger.log("DIAG", `svc running: ${diag.svcRunning}, pkg: ${diag.svcPkg}`);
      debugLogger.log("DIAG", `settings resolvable: ${diag.settingsResolvable}`);
      if (diag.settingsTarget) debugLogger.log("DIAG", `  target: ${diag.settingsTarget}`);
      if (diag.settingsResolveError) debugLogger.log("DIAG", `  ERROR: ${diag.settingsResolveError}`);
      if (diag.appOpsError) debugLogger.log("DIAG", `AppOps ERROR: ${diag.appOpsError}`);
      if (diag.fatalError) debugLogger.log("DIAG", `FATAL: ${diag.fatalError}`);
      debugLogger.log("DIAG", "=== 진단 완료 ===");
    } catch (e) {
      debugLogger.log("DIAG", `진단 실패: ${e}`);
    }
  };

  // 앱 포그라운드 복귀 시 항상 권한 상태 갱신 + 대기 중이면 자동 시작
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;
      try {
        let hasUsage = await AppDetector.hasUsageStatsPermission();
        debugLogger.log("PERM", `설정화면 active → 권한: ${hasUsage}`);
        setHasUsagePermission(hasUsage);

        if (waitingForPerm.current) {
          // Fix 4: 타이밍 이슈 - 설정 직후 빠른 복귀 시 권한 반영 지연
          if (!hasUsage) {
            debugLogger.log("RETRY", "설정화면 500ms 후 권한 재확인");
            await new Promise((r) => setTimeout(r, 500));
            hasUsage = await AppDetector.hasUsageStatsPermission();
            debugLogger.log("RETRY", `설정화면 재시도 결과: ${hasUsage}`);
            setHasUsagePermission(hasUsage);
          }
          waitingForPerm.current = false;
          if (hasUsage) {
            const started = await AppDetector.startBackgroundMonitoring();
            debugLogger.log("SVC", `설정화면 서비스 시작: ${started}`);
            if (started) {
              setAutoDetectionEnabled(true);
              await updateSettings({ autoDetectionEnabled: true });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        }
      } catch (e) {
        debugLogger.log("PERM", `설정화면 active 에러: ${e}`);
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUsageSettings = async () => {
    waitingForPerm.current = true;
    debugLogger.log("PERM", "설정 앱 열기 시도");
    const success = await AppDetector.openUsageStatsSettings();
    debugLogger.log("PERM", `설정 앱 열기 결과: ${success}`);
    if (!success) {
      waitingForPerm.current = false;
      Alert.alert(
        "설정을 열 수 없습니다",
        "직접 '설정 → 앱 → 사용 정보 접근 허용'에서 숏츠 디톡스를 허용해주세요."
      );
    }
  };

  const handleAutoDetectionToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!autoDetectionEnabled) {
      const hasUsage = await AppDetector.hasUsageStatsPermission();
      debugLogger.log("PERM", `자동감지 토글 ON → 권한: ${hasUsage}`);
      if (!hasUsage) {
        Alert.alert(
          "사용 앱 접근 권한 필요",
          "쇼츠 시청량 파악을 위해 사용 앱 접근이 필요합니다.\n쇼츠 시청량 파악 외에는 활용되지 않습니다.\n\n설정이 열리면 '숏츠 디톡스'를 찾아 허용해주세요.",
          [
            { text: "취소", style: "cancel" },
            { text: "설정 열기", onPress: openUsageSettings },
          ]
        );
        return;
      }
      await startMonitoring();
    } else {
      // ── 자동 감지 끄기 ──
      await AppDetector.stopBackgroundMonitoring();
      setAutoDetectionEnabled(false);
      await updateSettings({ autoDetectionEnabled: false });
      debugLogger.log("SVC", "자동감지 OFF → 서비스 중지");
    }
  };

  const startMonitoring = async () => {
    const started = await AppDetector.startBackgroundMonitoring();
    debugLogger.log("SVC", `startMonitoring 결과: ${started}`);
    if (started) {
      setAutoDetectionEnabled(true);
      await updateSettings({ autoDetectionEnabled: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("오류", "자동 감지를 시작할 수 없습니다.\n사용 앱 접근 권한을 다시 확인해주세요.");
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const openDebugModal = () => {
    setDebugLogs(debugLogger.getLogs());
    setDebugModalVisible(true);
  };

  const copyDebugLogs = async () => {
    await Clipboard.setStringAsync(debugLogs);
    Alert.alert("복사 완료", "디버그 로그가 클립보드에 복사되었습니다.");
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>설정</Text>

        {/* Profile */}
        {user && (
          <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "30" }]}>
              <Text style={styles.avatarText}>
                {(user.name ?? user.email ?? "U")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {user.name ?? "사용자"}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.muted }]}>
                {user.email ?? ""}
              </Text>
            </View>
          </View>
        )}

        {/* Daily Goal */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🎯 일일 목표 시간</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>
            현재: {formatMinutes(settings.dailyGoalMinutes)}
          </Text>
          <View style={styles.optionGrid}>
            {GOAL_OPTIONS.map((min) => (
              <Pressable
                key={min}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ dailyGoalMinutes: min });
                }}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor:
                      settings.dailyGoalMinutes === min ? colors.primary : colors.background,
                    borderColor:
                      settings.dailyGoalMinutes === min ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: settings.dailyGoalMinutes === min ? "#fff" : colors.muted },
                  ]}
                >
                  {formatMinutes(min)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Auto Detection */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionLabelGroup}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🤖 자동 감지</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                백그라운드에서 쇼츠 시청 자동 추적
              </Text>
            </View>
            <Pressable
              onPress={handleAutoDetectionToggle}
              style={[
                styles.toggle,
                { backgroundColor: autoDetectionEnabled ? colors.primary : colors.border },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: autoDetectionEnabled ? 18 : 2 }] },
                ]}
              />
            </Pressable>
          </View>

          {/* 권한 상태 표시 */}
          {Platform.OS === "android" && (
            <View style={styles.permissionStatus}>
              <PermissionRow
                label="사용 앱 접근 (필수)"
                granted={hasUsagePermission}
                onPress={openUsageSettings}
                colors={colors}
              />
            </View>
          )}

          <View style={[styles.privacyNotice, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.privacyNoticeText, { color: colors.muted }]}>
              🔒 모든 데이터는 기기에만 저장됩니다. 외부 전송 없음.
            </Text>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionLabelGroup}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🔔 알림 설정</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                시청 시간 초과 시 알림을 받아요
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                updateSettings({ alertEnabled: !settings.alertEnabled });
              }}
              style={[
                styles.toggle,
                { backgroundColor: settings.alertEnabled ? colors.primary : colors.border },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: settings.alertEnabled ? 18 : 2 }] },
                ]}
              />
            </Pressable>
          </View>
        </View>

        {/* App Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ℹ️ 앱 정보</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>버전</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>개발</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>숏츠 디톡스 팀</Text>
          </View>
        </View>

        {/* Debug Buttons */}
        <View style={styles.debugBtnRow}>
          <Pressable
            onPress={openDebugModal}
            style={({ pressed }) => [
              styles.debugBtn,
              { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.debugBtnText, { color: colors.muted }]}>🔧 디버그 로그</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await runDiagnostics();
              openDebugModal();
            }}
            style={({ pressed }) => [
              styles.debugBtn,
              { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.debugBtnText, { color: colors.muted }]}>🔍 진단 실행</Text>
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            { borderColor: colors.error + "60", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.logoutText, { color: colors.error }]}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      {/* Debug Modal */}
      <Modal visible={debugModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.debugModal, { backgroundColor: colors.background }]}>
          <View style={styles.debugHeader}>
            <Text style={[styles.debugTitle, { color: colors.foreground }]}>디버그 로그</Text>
            <View style={styles.debugActions}>
              <Pressable onPress={copyDebugLogs} style={[styles.debugActionBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.debugActionText}>복사</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  debugLogger.clear();
                  setDebugLogs("(로그 없음)");
                }}
                style={[styles.debugActionBtn, { backgroundColor: colors.warning }]}
              >
                <Text style={styles.debugActionText}>초기화</Text>
              </Pressable>
              <Pressable onPress={() => setDebugModalVisible(false)} style={[styles.debugActionBtn, { backgroundColor: colors.muted }]}>
                <Text style={styles.debugActionText}>닫기</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.debugLogScroll} contentContainerStyle={styles.debugLogContent}>
            <Text style={[styles.debugLogText, { color: colors.foreground }]} selectable>
              {debugLogs}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function PermissionRow({
  label,
  granted,
  onPress,
  colors,
}: {
  label: string;
  granted: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable onPress={granted ? undefined : onPress} style={styles.permissionRow}>
      <View
        style={[
          styles.permissionDot,
          { backgroundColor: granted ? "#4CAF82" : colors.error },
        ]}
      />
      <Text style={[styles.permissionLabel, { color: colors.muted }]}>{label}</Text>
      {!granted && (
        <Text style={[styles.permissionAction, { color: colors.primary }]}>설정 열기 →</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6C63FF",
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
  },
  profileEmail: {
    fontSize: 13,
  },
  section: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabelGroup: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionDesc: {
    fontSize: 13,
  },
  permissionStatus: {
    gap: 6,
    paddingTop: 4,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  permissionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  permissionLabel: {
    fontSize: 13,
    flex: 1,
  },
  permissionAction: {
    fontSize: 12,
    fontWeight: "600",
  },
  privacyNotice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
  },
  debugBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  debugBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  debugBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  logoutBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
  },
  debugModal: {
    flex: 1,
    paddingTop: 16,
  },
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  debugActions: {
    flexDirection: "row",
    gap: 8,
  },
  debugActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  debugLogScroll: {
    flex: 1,
  },
  debugLogContent: {
    padding: 16,
  },
  debugLogText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 18,
  },
});

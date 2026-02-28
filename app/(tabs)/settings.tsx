import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { ScreenContainer } from "@/components/screen-container";
import { formatMinutes } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AppDetector } from "@/modules/app-detector/src";
import { Platform } from "react-native";

const GOAL_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings } = useAppContext();
  const { user, logout } = useAuth();
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [hasUsagePermission, setHasUsagePermission] = useState(false);
  const [hasAccessibility, setHasAccessibility] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if (Platform.OS !== "android") return;
    try {
      const [usage, accessibility, isRunning] = await Promise.all([
        AppDetector.hasUsageStatsPermission(),
        AppDetector.isAccessibilityServiceEnabled(),
        AppDetector.isBackgroundMonitoringActive(),
      ]);
      setHasUsagePermission(usage);
      setHasAccessibility(accessibility);
      setAutoDetectionEnabled(isRunning || !!settings.autoDetectionEnabled);
    } catch (e) {}
  };

  const handleAutoDetectionToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!autoDetectionEnabled) {
      // ── Step 1: 사용량 접근 권한 확인 ──
      const hasUsage = await AppDetector.hasUsageStatsPermission();
      if (!hasUsage) {
        Alert.alert(
          "사용량 접근 권한 필요",
          "어떤 앱을 사용하는지 파악하기 위해 '사용량 접근' 권한이 필요합니다.\n\n설정이 열리면 '숏츠 디톡스'를 찾아 허용해주세요.",
          [
            { text: "취소", style: "cancel" },
            {
              text: "설정 열기",
              onPress: async () => {
                await AppDetector.openUsageStatsSettings();
                setTimeout(checkPermissionStatus, 1500);
              },
            },
          ]
        );
        return;
      }

      // ── Step 2: 백그라운드 모니터링 시작 ──
      const started = await AppDetector.startBackgroundMonitoring();
      if (started) {
        setAutoDetectionEnabled(true);
        await updateSettings({ autoDetectionEnabled: true });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // ── Step 3: 접근성 권한 안내 (스크롤 감지, 선택사항) ──
        const hasAcc = await AppDetector.isAccessibilityServiceEnabled();
        setHasAccessibility(hasAcc);
        if (!hasAcc) {
          Alert.alert(
            "스크롤 감지 권한 (선택사항)",
            "더 정확한 쇼츠 감지를 위해 접근성 권한을 허용하면 스크롤 패턴도 분석할 수 있어요.\n\n설정이 열리면 '설치된 앱' > '숏츠 디톡스'를 활성화해주세요.",
            [
              { text: "나중에", style: "cancel" },
              {
                text: "설정 열기",
                onPress: async () => {
                  await AppDetector.openAccessibilitySettings();
                  setTimeout(checkPermissionStatus, 1500);
                },
              },
            ]
          );
        }
      } else {
        Alert.alert("오류", "자동 감지를 시작할 수 없습니다. 권한을 다시 확인해주세요.");
      }
    } else {
      // ── 자동 감지 끄기 ──
      await AppDetector.stopBackgroundMonitoring();
      setAutoDetectionEnabled(false);
      await updateSettings({ autoDetectionEnabled: false });
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
                label="사용량 접근 (필수)"
                granted={hasUsagePermission}
                onPress={() =>
                  AppDetector.openUsageStatsSettings().then(() =>
                    setTimeout(checkPermissionStatus, 1500)
                  )
                }
                colors={colors}
              />
              <PermissionRow
                label="스크롤 감지 (선택)"
                granted={hasAccessibility}
                onPress={() =>
                  AppDetector.openAccessibilitySettings().then(() =>
                    setTimeout(checkPermissionStatus, 1500)
                  )
                }
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
});

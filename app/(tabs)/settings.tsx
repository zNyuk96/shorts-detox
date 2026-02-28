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
import { detectionService } from "@/lib/detection-service";
import { realAppDetectionService } from "@/lib/real-app-detection";
import {
  openAccessibilitySettings,
  ACCESSIBILITY_PROMPT_MESSAGE,
  PRIVACY_NOTICE_LOCAL_ONLY,
} from "@/lib/accessibility-settings";
import { Platform } from "react-native";

const GOAL_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings, testMode } = useAppContext();
  const { user, logout } = useAuth();
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(false);
  const [detectionPermissionGranted, setDetectionPermissionGranted] = useState(false);
  const [scrollSimulationOn, setScrollSimulationOn] = useState(false);

  useEffect(() => {
    checkDetectionStatus();
  }, []);

  useEffect(() => {
    setScrollSimulationOn(realAppDetectionService.isScrollSimulationActive());
  }, [testMode]);

  const checkDetectionStatus = async () => {
    const hasPermission = await detectionService.checkPermissions();
    setDetectionPermissionGranted(hasPermission);
    setAutoDetectionEnabled(detectionService.isRunning());
  };

  const handleAutoDetectionToggle = async () => {
    if (!autoDetectionEnabled) {
      // Android: 접근성 권한 안내 후 설정으로 이동 → 자동 감지 시작
      if (Platform.OS === "android") {
        Alert.alert(
          "접근성 권한 필요",
          ACCESSIBILITY_PROMPT_MESSAGE,
          [
            { text: "취소", style: "cancel" },
            {
              text: "설정 열기",
              onPress: async () => {
                const opened = await openAccessibilitySettings();
                if (opened) {
                  await detectionService.start();
                  setAutoDetectionEnabled(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Alert.alert("안내", "설정을 열 수 없어요. 설정 > 접근성에서 '숏츠 디톡스'를 켜주세요.");
                }
              },
            },
          ]
        );
        return;
      }
      // iOS 등: 기존 권한 플로우
      const hasPermission = await detectionService.checkPermissions();
      if (!hasPermission) {
        const granted = await detectionService.requestPermissions();
        if (!granted) {
          Alert.alert(
            "권한 필요",
            "자동 감지 기능을 사용하려면 기기 센서 접근 권한이 필요합니다."
          );
          return;
        }
      }
      await detectionService.start();
      setAutoDetectionEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await detectionService.stop();
      setAutoDetectionEnabled(false);
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
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🤖 자동 감지</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                스크롤 패턴으로 시간 자동 기록
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
          <View style={[styles.privacyNotice, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.privacyNoticeText, { color: colors.muted }]}>
              🔒 {PRIVACY_NOTICE_LOCAL_ONLY}
            </Text>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🔔 알림 설정</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                시청 중 주기적으로 알림을 받아요
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

        {/* Scroll simulation (test mode only) */}
        {testMode && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🧪 스크롤 시뮬레이션</Text>
                <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                  네이티브 없이 5~15초 간격 스크롤을 흉내 내 유효 시청·임계값 동작을 테스트해요
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (scrollSimulationOn) {
                    realAppDetectionService.stopScrollSimulation();
                    setScrollSimulationOn(false);
                  } else {
                    realAppDetectionService.startScrollSimulation();
                    setScrollSimulationOn(true);
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.toggle,
                  { backgroundColor: scrollSimulationOn ? colors.primary : colors.border },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    { transform: [{ translateX: scrollSimulationOn ? 18 : 2 }] },
                  ]}
                />
              </Pressable>
            </View>
          </View>
        )}

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionDesc: {
    fontSize: 13,
    marginTop: -4,
  },
  privacyNotice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
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

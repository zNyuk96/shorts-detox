import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { type Platform, formatDuration, generateId, getTodayDateString } from "@/lib/store";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

const PLATFORMS: { id: Platform; label: string; emoji: string; color: string }[] = [
  { id: "youtube", label: "YouTube Shorts", emoji: "▶️", color: "#FF0000" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", color: "#010101" },
  { id: "instagram", label: "Instagram Reels", emoji: "📸", color: "#E1306C" },
  { id: "other", label: "기타", emoji: "📱", color: "#7B7B9A" },
];

const QUICK_DURATIONS = [5, 10, 15, 20, 30]; // 분 단위

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export default function TrackerScreen() {
  const colors = useColors();
  const { sessions, settings, addSessionRecord, updateSettings } = useAppContext();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("youtube");
  const [manualMinutes, setManualMinutes] = useState("");
  const [alertThresholdInput, setAlertThresholdInput] = useState(String(settings.alertThresholdMinutes || 30));

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Notification permission not granted");
    }
  };

  const addManualSession = async (durationMinutes: number) => {
    if (durationMinutes <= 0) {
      Alert.alert("오류", "0분 이상의 시간을 입력해주세요");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = Date.now();
    const durationMs = durationMinutes * 60 * 1000;
    const session = {
      id: generateId(),
      platform: selectedPlatform,
      startTime: now - durationMs,
      endTime: now,
      durationMs,
      date: getTodayDateString(),
      isAutoDetected: false,
    };

    await addSessionRecord(session);
    setManualMinutes("");

    Alert.alert("성공", `${durationMinutes}분 시청 기록이 저장되었습니다`);
  };

  const addQuickDuration = (minutes: number) => {
    addManualSession(minutes);
  };

  const handleManualInput = () => {
    const minutes = parseInt(manualMinutes, 10);
    if (isNaN(minutes)) {
      Alert.alert("오류", "숫자를 입력해주세요");
      return;
    }
    addManualSession(minutes);
  };

  const updateAlertThreshold = () => {
    const threshold = parseInt(alertThresholdInput, 10);
    if (isNaN(threshold) || threshold <= 0) {
      Alert.alert("오류", "0분 이상의 숫자를 입력해주세요");
      return;
    }
    updateSettings({ alertThresholdMinutes: threshold });
    Alert.alert("성공", `알람 임계값이 ${threshold}분으로 설정되었습니다`);
  };

  const todaySessions = sessions.filter((s) => s.date === getTodayDateString());
  const totalTodayMs = todaySessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalTodayMinutes = Math.floor(totalTodayMs / 60000);

  return (
    <ScreenContainer>
      <FlatList
        data={todaySessions.slice().reverse()}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>숏츠 추적</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              시청 시간을 수동으로 기록하세요
            </Text>

            {/* Today Stats */}
            <View style={[styles.statsCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>오늘 총 시청</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {formatDuration(totalTodayMs)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>세션 수</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {todaySessions.length}
                </Text>
              </View>
            </View>

            {/* Platform Selector */}
            <View style={styles.platformGrid}>
              {PLATFORMS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setSelectedPlatform(p.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.platformBtn,
                    {
                      backgroundColor:
                        selectedPlatform === p.id ? colors.primary + "20" : colors.surface,
                      borderColor:
                        selectedPlatform === p.id ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={styles.platformEmoji}>{p.emoji}</Text>
                  <Text
                    style={[
                      styles.platformLabel,
                      { color: selectedPlatform === p.id ? colors.primary : colors.muted },
                    ]}
                    numberOfLines={1}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Quick Duration Buttons */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>⚡ 빠른 기록</Text>
              <View style={styles.quickButtonsRow}>
                {QUICK_DURATIONS.map((min) => (
                  <Pressable
                    key={min}
                    onPress={() => addQuickDuration(min)}
                    style={({ pressed }) => [
                      styles.quickBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.quickBtnText}>{min}분</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Manual Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>📝 직접 입력</Text>
              <View style={styles.manualInputRow}>
                <TextInput
                  style={[
                    styles.manualInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="분 수 입력"
                  placeholderTextColor={colors.muted}
                  value={manualMinutes}
                  onChangeText={setManualMinutes}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleManualInput}
                />
                <Pressable
                  onPress={handleManualInput}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={styles.submitBtnText}>저장</Text>
                </Pressable>
              </View>
            </View>

            {/* Alert Settings */}
            <View style={[styles.alertSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.alertHeader}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]}>🔔 알람 임계값</Text>
              </View>
              <Text style={[styles.alertDescription, { color: colors.muted }]}>
                이 시간 이상 시청하면 알람을 받습니다
              </Text>
              <View style={styles.thresholdRow}>
                <TextInput
                  style={[
                    styles.thresholdInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="분 수"
                  placeholderTextColor={colors.muted}
                  value={alertThresholdInput}
                  onChangeText={setAlertThresholdInput}
                  keyboardType="number-pad"
                />
                <Pressable
                  onPress={updateAlertThreshold}
                  style={({ pressed }) => [
                    styles.updateBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={styles.updateBtnText}>설정</Text>
                </Pressable>
              </View>
            </View>

            {/* Sessions Header */}
            {todaySessions.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                오늘의 세션 ({todaySessions.length})
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const platform = PLATFORMS.find((p) => p.id === item.platform);
          return (
            <View
              style={[styles.sessionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={styles.sessionEmoji}>{platform?.emoji ?? "📱"}</Text>
              <View style={styles.sessionInfo}>
                <Text style={[styles.sessionPlatform, { color: colors.foreground }]}>
                  {platform?.label ?? "기타"}
                </Text>
                <Text style={[styles.sessionTime, { color: colors.muted }]}>
                  {new Date(item.startTime).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <View style={styles.sessionRight}>
                <Text style={[styles.sessionDuration, { color: colors.primary }]}>
                  {formatDuration(item.durationMs)}
                </Text>
                {item.isAutoDetected && (
                  <Text style={[styles.autoTag, { color: colors.warning }]}>자동</Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              아직 오늘의 세션이 없어요{"\n"}시청 시간을 기록해보세요
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40,
  },
  headerContent: {
    padding: 20,
    gap: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: -8,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: "46%",
    flex: 1,
  },
  platformEmoji: {
    fontSize: 16,
  },
  platformLabel: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  quickButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  quickBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  manualInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
  },
  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  alertSection: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  alertDescription: {
    fontSize: 13,
  },
  thresholdRow: {
    flexDirection: "row",
    gap: 8,
  },
  thresholdInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
  },
  updateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
  },
  updateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  sessionEmoji: {
    fontSize: 24,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionPlatform: {
    fontSize: 15,
    fontWeight: "600",
  },
  sessionTime: {
    fontSize: 13,
  },
  sessionRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  sessionDuration: {
    fontSize: 15,
    fontWeight: "700",
  },
  autoTag: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

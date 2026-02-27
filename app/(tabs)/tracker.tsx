import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { formatDuration, getTodayDateString } from "@/lib/store";
import { useState } from "react";
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

const PLATFORMS = [
  { id: "youtube", label: "YouTube Shorts", emoji: "▶️" },
  { id: "tiktok", label: "TikTok", emoji: "🎵" },
  { id: "instagram", label: "Instagram Reels", emoji: "📸" },
  { id: "other", label: "기타", emoji: "📱" },
];

export default function TrackerScreen() {
  const colors = useColors();
  const { sessions, settings, updateSettings } = useAppContext();
  const [alertThresholdInput, setAlertThresholdInput] = useState(
    String(settings.alertThresholdMinutes || 30)
  );

  const updateAlertThreshold = () => {
    const threshold = parseInt(alertThresholdInput, 10);
    if (isNaN(threshold) || threshold <= 0) {
      Alert.alert("오류", "0분 이상의 숫자를 입력해주세요");
      return;
    }
    updateSettings({ alertThresholdMinutes: threshold });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("성공", `알람 임계값이 ${threshold}분으로 설정되었습니다`);
  };

  const todaySessions = sessions.filter((s) => s.date === getTodayDateString());
  const totalTodayMs = todaySessions.reduce((sum, s) => sum + s.durationMs, 0);

  return (
    <ScreenContainer>
      <FlatList
        data={todaySessions.slice().reverse()}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>자동 추적</Text>
            <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
              백그라운드에서 자동으로 시청 시간을 추적합니다
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

            {/* Alert Settings */}
            <View style={[styles.alertSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.alertHeader}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]}>🔔 알람 임계값</Text>
                <Text style={[styles.alertBadge, { backgroundColor: colors.primary, color: "#fff" }]}>
                  {alertThresholdInput}분
                </Text>
              </View>
              <Text style={[styles.alertDescription, { color: colors.muted }]}>
                이 시간 이상 시청하면 주의력 향상 페이지가 나타납니다
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

            {/* Info Section */}
            <View style={[styles.infoSection, { backgroundColor: colors.success + "15", borderColor: colors.success }]}>
              <Text style={styles.infoEmoji}>ℹ️</Text>
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: colors.foreground }]}>자동 추적 방식</Text>
                <Text style={[styles.infoText, { color: colors.muted }]}>
                  • 백그라운드에서 실행 중인 앱 감지{"\n"}
                  • 스크롤 패턴 분석{"\n"}
                  • 시청 시간 자동 누적{"\n"}
                  • 임계값 초과 시 주의력 향상 페이지 표시
                </Text>
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
              아직 오늘의 세션이 없어요{"\n"}앱을 백그라운드에서 실행하면{"\n"}자동으로 추적됩니다
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
  alertBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: "700",
  },
  alertDescription: {
    fontSize: 13,
    lineHeight: 18,
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
  infoSection: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  infoEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
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

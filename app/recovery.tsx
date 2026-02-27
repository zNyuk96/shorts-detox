import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { formatDuration, getTodayDateString } from "@/lib/store";
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

const RECOVERY_ACTIVITIES = [
  {
    id: "brain-info",
    title: "정보 학습",
    emoji: "📚",
    description: "새로운 정보를 학습하며 뇌를 깨워보세요",
    color: "#4F46E5",
  },
  {
    id: "brain-math",
    title: "수학 게임",
    emoji: "🔢",
    description: "수학 문제를 풀며 집중력을 높이세요",
    color: "#7C3AED",
  },
  {
    id: "brain-logic",
    title: "논리 게임",
    emoji: "🧩",
    description: "논리적 사고력을 단련하세요",
    color: "#2563EB",
  },
  {
    id: "meditation",
    title: "명상",
    emoji: "🧘",
    description: "마음을 진정시키고 집중력을 회복하세요",
    color: "#06B6D4",
  },
  {
    id: "reading",
    title: "정보 독해",
    emoji: "📖",
    description: "깊이 있는 글을 읽으며 사고력을 키우세요",
    color: "#059669",
  },
];

export default function RecoveryScreen() {
  const colors = useColors();
  const { todayWatchMs, settings, todayAttentionScore, sessions } = useAppContext();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const todaySessions = sessions.filter((s) => s.date === getTodayDateString());
  const totalWatchMs = todaySessions.reduce((sum, s) => sum + s.durationMs, 0);
  const watchMinutes = Math.floor(totalWatchMs / 60000);
  const thresholdMinutes = settings.alertThresholdMinutes || 30;
  const excessMinutes = Math.max(0, watchMinutes - thresholdMinutes);

  const handleActivitySelect = async (activityId: string) => {
    setSelectedActivity(activityId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 활동 타입 결정
    let activityType: "brain" | "meditation" | "reading" = "brain";
    if (activityId === "meditation") {
      activityType = "meditation";
    } else if (activityId === "reading") {
      activityType = "reading";
    }

    // 해당 활동 페이지로 이동
    setTimeout(() => {
      if (activityId === "brain-info") {
        router.push("/(tabs)/brain" as any);
      } else if (activityId === "brain-math") {
        router.push("/(tabs)/brain" as any);
      } else if (activityId === "brain-logic") {
        router.push("/(tabs)/brain" as any);
      } else if (activityId === "meditation") {
        router.push("/meditation" as any);
      } else if (activityId === "reading") {
        router.push("/(tabs)/brain" as any);
      }
    }, 300);
  };

  const handleQuit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "그냥끄기",
      "주의력 향상 활동을 건너뛰시겠습니까?",
      [
        {
          text: "취소",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "끄기",
          onPress: () => {
            router.back();
          },
          style: "destructive",
        },
      ]
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Alert */}
        <View style={[styles.alertBanner, { backgroundColor: "#FF6B6B" + "20", borderColor: "#FF6B6B" }]}>
          <Text style={styles.alertEmoji}>⚠️</Text>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: "#FF6B6B" }]}>시청 시간 초과!</Text>
            <Text style={[styles.alertMessage, { color: colors.foreground }]}>
              {excessMinutes}분을 초과했습니다
            </Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View style={[styles.statsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>오늘 시청</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{watchMinutes}분</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>목표</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{thresholdMinutes}분</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>초과</Text>
              <Text style={[styles.statValue, { color: "#FF6B6B" }]}>+{excessMinutes}분</Text>
            </View>
          </View>
        </View>

        {/* Attention Score */}
        {todayAttentionScore && (
          <View
            style={[
              styles.attentionBox,
              {
                backgroundColor:
                  todayAttentionScore.focusLevel === "excellent"
                    ? colors.success + "15"
                    : todayAttentionScore.focusLevel === "good"
                    ? colors.primary + "15"
                    : todayAttentionScore.focusLevel === "fair"
                    ? colors.warning + "15"
                    : colors.error + "15",
                borderColor:
                  todayAttentionScore.focusLevel === "excellent"
                    ? colors.success
                    : todayAttentionScore.focusLevel === "good"
                    ? colors.primary
                    : todayAttentionScore.focusLevel === "fair"
                    ? colors.warning
                    : colors.error,
              },
            ]}
          >
            <View style={styles.attentionHeader}>
              <Text style={styles.attentionEmoji}>🧠</Text>
              <View>
                <Text style={[styles.attentionLabel, { color: colors.muted }]}>주의력 손상도</Text>
                <Text
                  style={[
                    styles.attentionScore,
                    {
                      color:
                        todayAttentionScore.focusLevel === "excellent"
                          ? colors.success
                          : todayAttentionScore.focusLevel === "good"
                          ? colors.primary
                          : todayAttentionScore.focusLevel === "fair"
                          ? colors.warning
                          : colors.error,
                    },
                  ]}
                >
                  {todayAttentionScore.attentionScore}/100
                </Text>
              </View>
            </View>
            <Text style={[styles.recommendation, { color: colors.muted }]}>
              {todayAttentionScore.recommendation}
            </Text>
          </View>
        )}

        {/* Recovery Title */}
        <View style={styles.recoveryHeader}>
          <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>🧠 Recovery</Text>
          <Text style={[styles.recoverySubtitle, { color: colors.muted }]}>
            주의력을 향상시키는 활동을 선택하세요
          </Text>
        </View>

        {/* Recovery Activities */}
        <View style={styles.activitiesGrid}>
          {RECOVERY_ACTIVITIES.map((activity) => (
            <Pressable
              key={activity.id}
              onPress={() => handleActivitySelect(activity.id)}
              style={({ pressed }) => [
                styles.activityCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: selectedActivity === activity.id ? activity.color : colors.border,
                  borderWidth: selectedActivity === activity.id ? 2 : 1,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={styles.activityEmoji}>{activity.emoji}</Text>
              <Text style={[styles.activityTitle, { color: colors.foreground }]}>
                {activity.title}
              </Text>
              <Text style={[styles.activityDescription, { color: colors.muted }]}>
                {activity.description}
              </Text>
              {selectedActivity === activity.id && (
                <View style={[styles.selectedBadge, { backgroundColor: activity.color }]}>
                  <Text style={styles.selectedText}>선택됨</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleQuit}
            style={({ pressed }) => [
              styles.quitBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.quitBtnText, { color: colors.muted }]}>그냥끄기</Text>
          </Pressable>
        </View>
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
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  alertEmoji: {
    fontSize: 28,
  },
  alertContent: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  alertMessage: {
    fontSize: 13,
  },
  statsContainer: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
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
  attentionBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  attentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  attentionEmoji: {
    fontSize: 28,
  },
  attentionLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  attentionScore: {
    fontSize: 20,
    fontWeight: "700",
  },
  recommendation: {
    fontSize: 13,
    lineHeight: 18,
  },
  recoveryHeader: {
    gap: 4,
    marginTop: 8,
  },
  recoveryTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  recoverySubtitle: {
    fontSize: 14,
  },
  activitiesGrid: {
    gap: 12,
  },
  activityCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
    alignItems: "center",
  },
  activityEmoji: {
    fontSize: 32,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  activityDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  quitBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  quitBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

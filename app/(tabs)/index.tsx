import { useAppContext } from "@/lib/app-context";
import { formatDuration, formatMinutes, getTodayDateString } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { notificationService } from "@/lib/notification-service";
import { foregroundService } from "@/lib/foreground-service";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CircularProgress({
  progress,
  size = 180,
  strokeWidth = 14,
  color,
  bgColor,
  children,
}: {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: Math.min(progress, 1),
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>{children}</View>
    </View>
  );
}

const MOTIVATIONAL_MESSAGES = [
  "오늘도 뇌를 깨워보세요! 🧠",
  "숏츠보다 당신의 뇌가 더 흥미롭습니다 ✨",
  "3분의 명상이 30분의 스크롤보다 낫습니다 🧘",
  "지금 이 순간, 진짜 삶이 기다리고 있어요 🌱",
  "스크롤을 멈추면 세상이 보입니다 👀",
];

export default function HomeScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { todayWatchMs, settings, streak, detoxActivities, sessions, testMode } = useAppContext();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !testMode) {
      router.replace("/login");
    }
  }, [isAuthenticated, authLoading, testMode]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // 알람 체크 및 Recovery 페이지 트리거
  useEffect(() => {
    const checkAlerts = async () => {
      const thresholdMinutes = settings.alertThresholdMinutes || 30;
      const thresholdMs = thresholdMinutes * 60 * 1000;
      const watchMinutes = Math.floor(todayWatchMs / 60000);

      if (watchMinutes >= thresholdMinutes) {
        await notificationService.checkAndSendAlert(todayWatchMs, thresholdMinutes);
        await foregroundService.triggerRecovery(todayWatchMs, thresholdMs);
        router.push("/recovery" as any);
      }
    };

    checkAlerts();

    // 1분마다 알람 체크
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [todayWatchMs, settings.alertThresholdMinutes]);

  // Foreground 서비스 초기화
  useEffect(() => {
    foregroundService.start((watchMs, thresholdMs) => {
      router.push("/recovery" as any);
    });
    return () => {
      foregroundService.stop();
    };
  }, []);

  const goalMs = settings.dailyGoalMinutes * 60 * 1000;
  const progress = goalMs > 0 ? todayWatchMs / goalMs : 0;
  const todayStr = getTodayDateString();
  const todayDetox = detoxActivities.filter((a) => a.date === todayStr).length;
  const todaySessions = sessions.filter((s) => s.date === todayStr).length;
  const msgIndex = new Date().getDate() % MOTIVATIONAL_MESSAGES.length;
  const progressColor = progress >= 1 ? colors.error : progress >= 0.7 ? colors.warning : colors.primary;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.muted }]}>안녕하세요 👋</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>오늘의 현황</Text>
            </View>
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "44" }]}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={[styles.streakText, { color: colors.warning }]}>{streak}일</Text>
              </View>
            )}
          </View>

          {/* Circular Progress */}
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CircularProgress
              progress={progress}
              size={180}
              strokeWidth={14}
              color={progressColor}
              bgColor={colors.border}
            >
              <Text style={[styles.progressTime, { color: colors.foreground }]}>
                {formatDuration(todayWatchMs)}
              </Text>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>
                목표 {formatMinutes(settings.dailyGoalMinutes)}
              </Text>
            </CircularProgress>

            <Text style={[styles.progressStatus, { color: progress >= 1 ? colors.error : colors.muted }]}>
              {progress >= 1
                ? "⚠️ 오늘 목표를 초과했어요"
                : progress >= 0.7
                ? `목표까지 ${formatDuration(goalMs - todayWatchMs)} 남았어요`
                : "잘 하고 있어요! 계속 유지하세요"}
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>📱</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{todaySessions}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>오늘 세션</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>🧠</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{todayDetox}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>디톡스 완료</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>연속 달성</Text>
            </View>
          </View>

          {/* Motivational Message */}
          <View style={[styles.messageCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
            <Text style={[styles.messageText, { color: colors.primary }]}>
              {MOTIVATIONAL_MESSAGES[msgIndex]}
            </Text>
          </View>

          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>빠른 시작</Text>
          <View style={styles.actionsGrid}>
            <Pressable
              onPress={() => router.push("/detox" as any)}
              style={({ pressed }) => [
                styles.actionCard,
                styles.actionCardPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.actionEmoji}>🛑</Text>
              <Text style={[styles.actionTitle, { color: "#fff" }]}>지금 디톡스</Text>
              <Text style={[styles.actionDesc, { color: "rgba(255,255,255,0.75)" }]}>숏츠 시청 중단하기</Text>
            </Pressable>

            <View style={styles.actionColumn}>
              <Pressable
                onPress={() => router.push("/(tabs)/brain" as any)}
                style={({ pressed }) => [
                  styles.actionCardSmall,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.actionEmojiSmall}>🧠</Text>
                <Text style={[styles.actionTitleSmall, { color: colors.foreground }]}>뇌 활동</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/meditation" as any)}
                style={({ pressed }) => [
                  styles.actionCardSmall,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.actionEmojiSmall}>🧘</Text>
                <Text style={[styles.actionTitleSmall, { color: colors.foreground }]}>명상</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  streakFire: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  progressTime: {
    fontSize: 24,
    fontWeight: "700",
  },
  progressLabel: {
    fontSize: 13,
  },
  progressStatus: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  statEmoji: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  messageCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  actionCardPrimary: {
    justifyContent: "center",
  },
  actionEmoji: {
    fontSize: 32,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  actionDesc: {
    fontSize: 12,
    textAlign: "center",
  },
  actionColumn: {
    gap: 12,
  },
  actionCardSmall: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  actionEmojiSmall: {
    fontSize: 24,
  },
  actionTitleSmall: {
    fontSize: 13,
    fontWeight: "700",
  },
});

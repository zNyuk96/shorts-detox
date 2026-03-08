import { useAppContext } from "@/lib/app-context";
import { formatDuration, formatMinutes, getTodayDateString } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { notificationService } from "@/lib/notification-service";
import { foregroundService } from "@/lib/foreground-service";
import { scrollDetectionService } from "@/lib/scroll-detection-service";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppDetector } from "@/modules/app-detector/src";
import { debugLogger } from "@/lib/debug-logger";
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
  const { todayWatchMs, settings, streak, detoxActivities, sessions, testMode, updateSettings } = useAppContext();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const waitingForPerm = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !testMode) {
      router.replace("/login");
    }
  }, [isAuthenticated, authLoading, testMode]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // 앱 시작 시 진단 로그 자동 기록
  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const diagJson = await AppDetector.getPermissionDiagnostics();
        const d = JSON.parse(diagJson);
        debugLogger.log("DIAG", `[홈] ctx=${d.reactContextNull ? "NULL" : "OK"} activity=${d.currentActivityNull ? "NULL" : "OK"} appOps=${d.appOpsModeLabel} usageCount=${d.usageStatsCount} perm=${d.hasPermResult} svc=${d.svcRunning} settingsOK=${d.settingsResolvable}`);
      } catch (e) {
        debugLogger.log("DIAG", `[홈] 진단 실패: ${e}`);
      }
    })();
  }, []);

  // 첫 실행 시 권한 요청
  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const prompted = await AsyncStorage.getItem("@shorts_detox/perm_v1");
        if (prompted) {
          debugLogger.log("PERM", "첫 실행 프롬프트 이미 완료, 스킵");
          return;
        }
        await AsyncStorage.setItem("@shorts_detox/perm_v1", "1");
        const hasUsage = await AppDetector.hasUsageStatsPermission();
        debugLogger.log("PERM", `첫 실행 권한 확인: ${hasUsage}`);
        if (!hasUsage) {
          Alert.alert(
            "자동 감지 설정",
            "숏츠 시청량을 자동 추적하려면 '사용 앱 접근' 권한이 필요합니다.\n\n설정에서 '숏츠 디톡스'를 허용해주세요.",
            [
              { text: "나중에", style: "cancel" },
              {
                text: "설정 열기",
                onPress: () => {
                  waitingForPerm.current = true;
                  AppDetector.openUsageStatsSettings();
                },
              },
            ]
          );
        } else {
          const running = await AppDetector.isBackgroundMonitoringActive();
          debugLogger.log("SVC", `첫 실행 서비스 상태: running=${running}`);
          if (!running) {
            const started = await AppDetector.startBackgroundMonitoring();
            debugLogger.log("SVC", `첫 실행 서비스 시작: ${started}`);
            if (started) await updateSettings({ autoDetectionEnabled: true });
          }
        }
      } catch (e) {
        debugLogger.log("PERM", `첫 실행 에러: ${e}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 앱 포그라운드 복귀 시 항상 권한 체크 + 서비스 자동 시작 (Fix 1+3)
  // waitingForPerm 의존 제거 → "나중에" 후 수동 권한 설정도 감지
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;
      try {
        let hasUsage = await AppDetector.hasUsageStatsPermission();
        debugLogger.log("PERM", `홈 active 복귀 → 권한: ${hasUsage}`);

        // Fix 4: 타이밍 이슈 - 설정 직후 빠른 복귀 시 권한 반영 지연 대응
        if (!hasUsage && waitingForPerm.current) {
          debugLogger.log("RETRY", "500ms 후 권한 재확인 시도");
          await new Promise((r) => setTimeout(r, 500));
          hasUsage = await AppDetector.hasUsageStatsPermission();
          debugLogger.log("RETRY", `재시도 결과: ${hasUsage}`);
        }
        waitingForPerm.current = false;

        if (hasUsage) {
          const running = await AppDetector.isBackgroundMonitoringActive();
          if (!running) {
            const started = await AppDetector.startBackgroundMonitoring();
            debugLogger.log("SVC", `홈 active → 서비스 자동시작: ${started}`);
            if (started) await updateSettings({ autoDetectionEnabled: true });
          }
        }
      } catch (e) {
        debugLogger.log("PERM", `홈 active 에러: ${e}`);
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 알람 체크: 임계값 초과 시 알림 발송 + 디톡스 페이지 표시
  // 알림은 notificationService 단일 경로로만 발송 (5분 중복 방지 내장)
  useEffect(() => {
    const checkAlerts = async () => {
      const thresholdMinutes = settings.alertThresholdMinutes || 30;
      const thresholdMs = thresholdMinutes * 60 * 1000;
      const watchMinutes = Math.floor(todayWatchMs / 60000);

      if (watchMinutes >= thresholdMinutes) {
        await notificationService.checkAndSendAlert(todayWatchMs, thresholdMinutes);
        await foregroundService.triggerRecovery(todayWatchMs, thresholdMs);
        router.replace(`/detox?watchMs=${todayWatchMs}` as any);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [todayWatchMs, settings.alertThresholdMinutes]);

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
        onScroll={(event) => scrollDetectionService.handleScroll(event)}
        scrollEventThrottle={100}
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

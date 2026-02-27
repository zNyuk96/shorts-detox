import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { type Platform, formatDuration, generateId, getTodayDateString } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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

const ALERT_INTERVALS = [5, 10, 15, 20, 30];

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
  const [isTracking, setIsTracking] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (notifIntervalRef.current) clearInterval(notifIntervalRef.current);
    };
  }, []);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Notification permission not granted");
    }
  };

  const scheduleAlertNotification = (intervalMinutes: number) => {
    if (notifIntervalRef.current) clearInterval(notifIntervalRef.current);
    notifIntervalRef.current = setInterval(async () => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🛑 숏츠 디톡스 알림",
          body: `${intervalMinutes}분째 시청 중입니다. 잠깐 쉬어가세요!`,
          sound: true,
        },
        trigger: null,
      });
    }, intervalMinutes * 60 * 1000);
  };

  const startTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setIsTracking(true);

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);

    if (settings.alertEnabled) {
      scheduleAlertNotification(settings.alertIntervalMinutes);
    }
  };

  const stopTracking = async () => {
    if (!isTracking) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (notifIntervalRef.current) clearInterval(notifIntervalRef.current);

    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;
    setIsTracking(false);

    if (duration > 5000) {
      const session = {
        id: generateId(),
        platform: selectedPlatform,
        startTime: startTimeRef.current,
        endTime,
        durationMs: duration,
        date: getTodayDateString(),
      };
      await addSessionRecord(session);
    }
    setElapsedMs(0);
  };

  const toggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const toggleAlertInterval = (minutes: number) => {
    updateSettings({ alertIntervalMinutes: minutes });
  };

  const todaySessions = sessions.filter((s) => s.date === getTodayDateString());

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
              시청 시작 시 타이머를 눌러주세요
            </Text>

            {/* Platform Selector */}
            <View style={styles.platformGrid}>
              {PLATFORMS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    if (!isTracking) {
                      setSelectedPlatform(p.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
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

            {/* Timer */}
            <View
              style={[
                styles.timerCard,
                {
                  backgroundColor: isTracking ? colors.primary + "12" : colors.surface,
                  borderColor: isTracking ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.timerDisplay, { color: isTracking ? colors.primary : colors.foreground }]}>
                {formatDuration(elapsedMs)}
              </Text>
              {isTracking && (
                <View style={styles.liveIndicator}>
                  <View style={[styles.liveDot, { backgroundColor: colors.error }]} />
                  <Text style={[styles.liveText, { color: colors.error }]}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Start/Stop Button */}
            <Pressable
              onPress={toggleTracking}
              style={({ pressed }) => [
                styles.mainBtn,
                {
                  backgroundColor: isTracking ? colors.error : colors.primary,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={styles.mainBtnText}>
                {isTracking ? "⏹ 시청 종료" : "▶ 시청 시작"}
              </Text>
            </Pressable>

            {/* Alert Settings */}
            <View style={[styles.alertSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.alertHeader}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]}>⏰ 알림 간격</Text>
                <Pressable
                  onPress={() => updateSettings({ alertEnabled: !settings.alertEnabled })}
                  style={[
                    styles.toggleBtn,
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
              <View style={styles.intervalRow}>
                {ALERT_INTERVALS.map((min) => (
                  <Pressable
                    key={min}
                    onPress={() => toggleAlertInterval(min)}
                    style={[
                      styles.intervalBtn,
                      {
                        backgroundColor:
                          settings.alertIntervalMinutes === min ? colors.primary : colors.background,
                        borderColor:
                          settings.alertIntervalMinutes === min ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.intervalText,
                        {
                          color:
                            settings.alertIntervalMinutes === min ? "#fff" : colors.muted,
                        },
                      ]}
                    >
                      {min}분
                    </Text>
                  </Pressable>
                ))}
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
              <Text style={[styles.sessionDuration, { color: colors.primary }]}>
                {formatDuration(item.durationMs)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              아직 오늘의 세션이 없어요{"\n"}시청 시작 버튼을 눌러보세요
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
  timerCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 8,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  mainBtn: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  mainBtnText: {
    color: "#fff",
    fontSize: 18,
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
  toggleBtn: {
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
  intervalRow: {
    flexDirection: "row",
    gap: 8,
  },
  intervalBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  intervalText: {
    fontSize: 13,
    fontWeight: "600",
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
  sessionDuration: {
    fontSize: 15,
    fontWeight: "700",
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

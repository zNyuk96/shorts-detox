import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { generateId, getTodayDateString } from "@/lib/store";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const MOTIVATIONAL_QUOTES = [
  "지금 이 순간, 당신의 뇌는 더 나은 것을 원합니다.",
  "숏츠 1분 = 집중력 20분 손실. 지금 멈추세요.",
  "진짜 삶은 스크린 밖에 있습니다.",
  "당신의 주의력은 소중합니다. 지키세요.",
  "3분의 뇌 활동이 30분의 숏츠보다 가치 있습니다.",
];

const DETOX_OPTIONS = [
  {
    id: "brain" as const,
    emoji: "🧠",
    title: "뇌 인지 개선",
    desc: "기억력, 집중력, 반응속도 게임",
    color: "#6C63FF",
    bgColor: "#6C63FF15",
  },
  {
    id: "meditation" as const,
    emoji: "🧘",
    title: "명상하기",
    desc: "호흡 가이드와 함께 마음을 리셋",
    color: "#4CAF82",
    bgColor: "#4CAF8215",
  },
  {
    id: "quit" as const,
    emoji: "✕",
    title: "그냥 끄기",
    desc: "숏츠 앱을 닫고 다른 일 하기",
    color: "#7B7B9A",
    bgColor: "#7B7B9A15",
  },
];

export default function DetoxScreen() {
  const colors = useColors();
  const { addDetoxRecord } = useAppContext();
  const params = useLocalSearchParams<{ watchMs?: string }>();
  const watchMs = parseInt(params.watchMs ?? "0", 10);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const quoteIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleChoice = async (type: "brain" | "meditation" | "quit") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const activity = {
      id: generateId(),
      type,
      durationMs: 0,
      date: getTodayDateString(),
      timestamp: Date.now(),
    };
    await addDetoxRecord(activity);

    if (type === "brain") {
      router.replace("/(tabs)/brain" as any);
    } else if (type === "meditation") {
      router.replace("/meditation" as any);
    } else {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace("/(tabs)");
    }
  };

  const formatWatchTime = (ms: number) => {
    if (ms <= 0) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) return `${minutes}분 ${seconds}초`;
    return `${seconds}초`;
  };

  const watchTimeStr = formatWatchTime(watchMs);

  return (
    <ScreenContainer
      edges={["top", "bottom", "left", "right"]}
      containerClassName="bg-background"
    >
      <Animated.View
        style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stopEmoji}>🛑</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>잠깐, 멈춰요!</Text>
          {watchTimeStr && (
            <View style={[styles.watchTimeBadge, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" }]}>
              <Text style={[styles.watchTimeText, { color: colors.warning }]}>
                {watchTimeStr} 동안 시청했어요
              </Text>
            </View>
          )}
          <Text style={[styles.quote, { color: colors.muted }]}>
            {MOTIVATIONAL_QUOTES[quoteIndex]}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.options}>
          <Text style={[styles.optionsLabel, { color: colors.muted }]}>지금 무엇을 할까요?</Text>
          {DETOX_OPTIONS.map((option, i) => (
            <Animated.View
              key={option.id}
              style={{
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20 + i * 10, 0],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                onPress={() => handleChoice(option.id)}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: option.bgColor,
                    borderColor: option.color + "40",
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.optionIconBg, { backgroundColor: option.color + "25" }]}>
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: option.color }]}>{option.title}</Text>
                  <Text style={[styles.optionDesc, { color: colors.muted }]}>{option.desc}</Text>
                </View>
                <Text style={[styles.optionArrow, { color: option.color }]}>›</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Brain Fact */}
        <View style={[styles.factCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.factText, { color: colors.muted }]}>
            💡 숏츠를 볼 때마다 뇌의 보상 회로가 활성화되어 더 많은 자극을 원하게 됩니다. 지금 멈추는 것이 뇌 건강에 도움이 됩니다.
          </Text>
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  stopEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  watchTimeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  watchTimeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  quote: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  options: {
    gap: 12,
  },
  optionsLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  optionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionEmoji: {
    fontSize: 26,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  optionDesc: {
    fontSize: 13,
  },
  optionArrow: {
    fontSize: 24,
    fontWeight: "300",
  },
  factCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  factText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});

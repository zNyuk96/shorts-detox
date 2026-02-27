import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { generateId, getTodayDateString } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const { width: SW, height: SH } = Dimensions.get("window");
const TARGET_SIZE = 72;
const TOTAL_ROUNDS = 10;

type GameState = "ready" | "waiting" | "show" | "done";

export default function ReactionGameScreen() {
  const colors = useColors();
  const { addDetoxRecord } = useAppContext();
  const [gameState, setGameState] = useState<GameState>("ready");
  const [round, setRound] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [showTime, setShowTime] = useState<number>(0);
  const [isTooEarly, setIsTooEarly] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getRandomPos = () => ({
    x: Math.random() * (SW - TARGET_SIZE - 48) + 24,
    y: Math.random() * (SH * 0.4 - TARGET_SIZE) + SH * 0.15,
  });

  const startRound = () => {
    setIsTooEarly(false);
    setGameState("waiting");
    const delay = 1000 + Math.random() * 2000;
    timeoutRef.current = setTimeout(() => {
      const pos = getRandomPos();
      setTargetPos(pos);
      setShowTime(Date.now());
      setGameState("show");
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }).start();
    }, delay);
  };

  const handleStart = () => {
    setRound(0);
    setReactionTimes([]);
    startTimeRef.current = Date.now();
    startRound();
  };

  const handleTap = () => {
    if (gameState === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsTooEarly(true);
      setGameState("ready");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (gameState !== "show") return;

    const reactionMs = Date.now() - showTime;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scaleAnim.setValue(0);

    const newTimes = [...reactionTimes, reactionMs];
    setReactionTimes(newTimes);

    const nextRound = round + 1;
    setRound(nextRound);

    if (nextRound >= TOTAL_ROUNDS) {
      setGameState("done");
      handleComplete(newTimes);
    } else {
      setGameState("waiting");
      const delay = 800 + Math.random() * 1500;
      timeoutRef.current = setTimeout(() => {
        const pos = getRandomPos();
        setTargetPos(pos);
        setShowTime(Date.now());
        setGameState("show");
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }).start();
      }, delay);
    }
  };

  const handleComplete = async (times: number[]) => {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const duration = Date.now() - startTimeRef.current;
    await addDetoxRecord({
      id: generateId(),
      type: "brain",
      gameType: "reaction",
      durationMs: duration,
      score: Math.round(1000 - avg),
      date: getTodayDateString(),
      timestamp: Date.now(),
    });
  };

  const avgTime = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  const getSpeedLabel = (ms: number) => {
    if (ms < 200) return { label: "번개 같은 반응!", color: colors.primary };
    if (ms < 300) return { label: "매우 빠름!", color: colors.success };
    if (ms < 400) return { label: "보통", color: colors.warning };
    return { label: "조금 느림", color: colors.muted };
  };

  if (gameState === "ready" || gameState === "waiting") {
    return (
      <ScreenContainer>
        <Pressable
          style={[styles.fullScreen, { backgroundColor: colors.background }]}
          onPress={gameState === "waiting" ? handleTap : undefined}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.muted }]}>‹ 뒤로</Text>
          </Pressable>

          <View style={styles.centerContent}>
            {gameState === "ready" ? (
              <>
                <Text style={styles.readyEmoji}>⚡</Text>
                <Text style={[styles.readyTitle, { color: colors.foreground }]}>반응속도 게임</Text>
                <Text style={[styles.readyDesc, { color: colors.muted }]}>
                  화면에 나타나는 원을 최대한{"\n"}빠르게 탭하세요!
                </Text>
                {isTooEarly && (
                  <View style={[styles.earlyWarning, { backgroundColor: colors.error + "20", borderColor: colors.error + "40" }]}>
                    <Text style={[styles.earlyText, { color: colors.error }]}>너무 일찍 눌렀어요!</Text>
                  </View>
                )}
                <Text style={[styles.roundInfo, { color: colors.muted }]}>
                  {TOTAL_ROUNDS}라운드 · 현재 {round}/{TOTAL_ROUNDS}
                </Text>
                <Pressable
                  onPress={handleStart}
                  style={[styles.startBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.startBtnText}>
                    {round === 0 ? "시작하기" : "계속하기"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.waitEmoji}>👀</Text>
                <Text style={[styles.waitText, { color: colors.foreground }]}>
                  원이 나타나면 탭하세요...
                </Text>
                <Text style={[styles.waitSubText, { color: colors.muted }]}>
                  {round}/{TOTAL_ROUNDS} 라운드
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (gameState === "show") {
    return (
      <ScreenContainer>
        <Pressable
          style={[styles.fullScreen, { backgroundColor: colors.background }]}
          onPress={handleTap}
        >
          <Text style={[styles.roundCounter, { color: colors.muted }]}>
            {round + 1}/{TOTAL_ROUNDS}
          </Text>
          <Animated.View
            style={[
              styles.target,
              {
                position: "absolute",
                left: targetPos.x,
                top: targetPos.y,
                backgroundColor: colors.primary,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          />
        </Pressable>
      </ScreenContainer>
    );
  }

  // Done
  const speedInfo = getSpeedLabel(avgTime);
  return (
    <ScreenContainer>
      <View style={styles.doneContainer}>
        <Text style={styles.doneEmoji}>⚡</Text>
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>완료!</Text>
        <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.avgTime, { color: colors.primary }]}>{avgTime}ms</Text>
          <Text style={[styles.avgLabel, { color: colors.muted }]}>평균 반응 시간</Text>
          <View style={[styles.speedBadge, { backgroundColor: speedInfo.color + "20" }]}>
            <Text style={[styles.speedText, { color: speedInfo.color }]}>{speedInfo.label}</Text>
          </View>
        </View>
        <View style={[styles.timesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.timesTitle, { color: colors.foreground }]}>라운드별 기록</Text>
          <View style={styles.timesGrid}>
            {reactionTimes.map((t, i) => (
              <View key={i} style={[styles.timeChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.timeChipLabel, { color: colors.muted }]}>{i + 1}</Text>
                <Text style={[styles.timeChipValue, { color: t < 300 ? colors.success : colors.foreground }]}>
                  {t}ms
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          onPress={handleStart}
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.startBtnText}>다시 하기</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtnFull, { borderColor: colors.border }]}
        >
          <Text style={[styles.backBtnText, { color: colors.muted }]}>돌아가기</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 4,
  },
  backText: {
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  readyEmoji: {
    fontSize: 64,
  },
  readyTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  readyDesc: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  earlyWarning: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  earlyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  roundInfo: {
    fontSize: 14,
  },
  startBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  startBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  waitEmoji: {
    fontSize: 64,
  },
  waitText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  waitSubText: {
    fontSize: 15,
  },
  roundCounter: {
    position: "absolute",
    top: 20,
    right: 20,
    fontSize: 16,
    fontWeight: "600",
  },
  target: {
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
  },
  doneContainer: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  doneEmoji: {
    fontSize: 64,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  resultCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  avgTime: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
  },
  avgLabel: {
    fontSize: 15,
  },
  speedBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  speedText: {
    fontSize: 15,
    fontWeight: "700",
  },
  timesCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  timesTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  timesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 56,
  },
  timeChipLabel: {
    fontSize: 11,
  },
  timeChipValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  backBtnFull: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

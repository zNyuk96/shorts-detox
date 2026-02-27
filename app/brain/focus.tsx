import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { generateId, getTodayDateString } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const COLOR_OPTIONS = [
  { label: "빨강", value: "#FF6B6B" },
  { label: "파랑", value: "#6B9FFF" },
  { label: "초록", value: "#4CAF82" },
  { label: "노랑", value: "#FFD93D" },
];

const GAME_DURATION = 60; // seconds

function generateQuestion() {
  const wordIdx = Math.floor(Math.random() * COLOR_OPTIONS.length);
  let colorIdx = Math.floor(Math.random() * COLOR_OPTIONS.length);
  // 50% chance of mismatch
  if (Math.random() > 0.5) {
    while (colorIdx === wordIdx) {
      colorIdx = Math.floor(Math.random() * COLOR_OPTIONS.length);
    }
  }
  return {
    word: COLOR_OPTIONS[wordIdx].label,
    wordColor: COLOR_OPTIONS[colorIdx].value,
    correctAnswer: COLOR_OPTIONS[colorIdx].label,
  };
}

export default function FocusGameScreen() {
  const colors = useColors();
  const { addDetoxRecord } = useAppContext();
  const [gameState, setGameState] = useState<"ready" | "playing" | "done">("ready");
  const [question, setQuestion] = useState(generateQuestion());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(GAME_DURATION);
    setQuestion(generateQuestion());
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameState("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleAnswer = (answer: string) => {
    if (gameState !== "playing") return;
    const isCorrect = answer === question.correctAnswer;

    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => {
        const next = s + 1;
        setMaxStreak((m) => Math.max(m, next));
        return next;
      });
      setFeedback("correct");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      setFeedback("wrong");
    }

    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      setQuestion(generateQuestion());
      setFeedback(null);
    }, 200);
  };

  const handleDone = async () => {
    const duration = Date.now() - startTimeRef.current;
    await addDetoxRecord({
      id: generateId(),
      type: "brain",
      gameType: "focus",
      durationMs: duration,
      score,
      date: getTodayDateString(),
      timestamp: Date.now(),
    });
  };

  useEffect(() => {
    if (gameState === "done") {
      handleDone();
    }
  }, [gameState]);

  const timerColor = timeLeft <= 10 ? colors.error : timeLeft <= 20 ? colors.warning : colors.primary;

  if (gameState === "ready") {
    return (
      <ScreenContainer>
        <View style={styles.readyContainer}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.muted }]}>‹ 뒤로</Text>
          </Pressable>
          <Text style={styles.readyEmoji}>🎯</Text>
          <Text style={[styles.readyTitle, { color: colors.foreground }]}>집중력 게임</Text>
          <Text style={[styles.readyDesc, { color: colors.muted }]}>
            화면에 표시된 단어의{"\n"}
            <Text style={{ fontWeight: "700", color: colors.foreground }}>글자 색상</Text>을 선택하세요.{"\n"}
            단어의 의미가 아닌 색상에 집중!
          </Text>
          <View style={[styles.exampleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#4CAF82" }}>빨강</Text>
            <Text style={[styles.exampleHint, { color: colors.muted }]}>→ 정답: 초록 (글자 색상)</Text>
          </View>
          <Text style={[styles.readyTimer, { color: colors.muted }]}>⏱ {GAME_DURATION}초 제한</Text>
          <Pressable
            onPress={startGame}
            style={[styles.startBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.startBtnText}>시작하기</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (gameState === "done") {
    return (
      <ScreenContainer>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎯</Text>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>게임 종료!</Text>
          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>{score}</Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>점수</Text>
              </View>
              <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>{maxStreak}</Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>최고 연속</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={startGame} style={[styles.startBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.startBtnText}>다시 하기</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.backBtnFull, { borderColor: colors.border }]}>
            <Text style={[styles.backBtnText, { color: colors.muted }]}>돌아가기</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.playContainer}>
        {/* Header */}
        <View style={styles.playHeader}>
          <View style={[styles.timerBadge, { backgroundColor: timerColor + "20", borderColor: timerColor + "40" }]}>
            <Text style={[styles.timerText, { color: timerColor }]}>⏱ {timeLeft}초</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.scoreText, { color: colors.foreground }]}>🏆 {score}</Text>
          </View>
          {streak > 1 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" }]}>
              <Text style={[styles.streakText, { color: colors.warning }]}>🔥 {streak}연속</Text>
            </View>
          )}
        </View>

        {/* Question */}
        <Animated.View
          style={[
            styles.questionCard,
            {
              backgroundColor:
                feedback === "correct"
                  ? colors.success + "20"
                  : feedback === "wrong"
                  ? colors.error + "20"
                  : colors.surface,
              borderColor:
                feedback === "correct"
                  ? colors.success
                  : feedback === "wrong"
                  ? colors.error
                  : colors.border,
              transform: [{ scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
            },
          ]}
        >
          <Text style={[styles.instruction, { color: colors.muted }]}>글자 색상을 선택하세요</Text>
          <Text style={[styles.questionWord, { color: question.wordColor }]}>{question.word}</Text>
        </Animated.View>

        {/* Answer Buttons */}
        <View style={styles.answerGrid}>
          {COLOR_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => handleAnswer(opt.label)}
              style={({ pressed }) => [
                styles.answerBtn,
                {
                  backgroundColor: opt.value + "25",
                  borderColor: opt.value + "60",
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <View style={[styles.colorDot, { backgroundColor: opt.value }]} />
              <Text style={[styles.answerText, { color: opt.value }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  readyContainer: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  backBtn: {
    alignSelf: "flex-start",
    position: "absolute",
    top: 20,
    left: 24,
  },
  backText: {
    fontSize: 16,
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
  exampleCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  exampleHint: {
    fontSize: 14,
  },
  readyTimer: {
    fontSize: 15,
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
  scoreCard: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  scoreLabel: {
    fontSize: 13,
  },
  scoreDivider: {
    width: 1,
    height: 40,
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
  playContainer: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  playHeader: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  timerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 15,
    fontWeight: "700",
  },
  scoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: "700",
  },
  streakBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  streakText: {
    fontSize: 15,
    fontWeight: "700",
  },
  questionCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  instruction: {
    fontSize: 15,
    fontWeight: "500",
  },
  questionWord: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1,
  },
  answerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  answerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    width: "47%",
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  answerText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

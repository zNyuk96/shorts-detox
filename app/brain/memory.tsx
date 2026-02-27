import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { generateId, getTodayDateString } from "@/lib/store";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const CARD_EMOJIS = ["🌸", "🦋", "🌙", "⭐", "🎯", "🧩", "🎵", "🌈"];

interface Card {
  id: string;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function generateCards(): Card[] {
  const pairs = [...CARD_EMOJIS, ...CARD_EMOJIS];
  const shuffled = pairs.sort(() => Math.random() - 0.5);
  return shuffled.map((emoji, i) => ({
    id: `card-${i}`,
    emoji,
    isFlipped: false,
    isMatched: false,
  }));
}

function CardItem({
  card,
  onPress,
  size,
  colors,
}: {
  card: Card;
  onPress: () => void;
  size: number;
  colors: any;
}) {
  const flipAnim = useRef(new Animated.Value(card.isFlipped || card.isMatched ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: card.isFlipped || card.isMatched ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [card.isFlipped, card.isMatched]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <Pressable
      onPress={onPress}
      style={[styles.cardWrapper, { width: size, height: size }]}
      disabled={card.isFlipped || card.isMatched}
    >
      {/* Back (hidden) */}
      <Animated.View
        style={[
          styles.cardFace,
          {
            width: size - 4,
            height: size - 4,
            backgroundColor: card.isMatched ? colors.success + "30" : colors.primary + "20",
            borderColor: card.isMatched ? colors.success : colors.primary + "60",
            transform: [{ rotateY: frontRotate }],
            backfaceVisibility: "hidden",
          },
        ]}
      >
        <Text style={styles.cardBack}>?</Text>
      </Animated.View>
      {/* Front (emoji) */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardFront,
          {
            width: size - 4,
            height: size - 4,
            backgroundColor: card.isMatched ? colors.success + "20" : colors.surface,
            borderColor: card.isMatched ? colors.success : colors.border,
            transform: [{ rotateY: backRotate }],
            backfaceVisibility: "hidden",
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.4 }}>{card.emoji}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function MemoryGameScreen() {
  const colors = useColors();
  const { addDetoxRecord } = useAppContext();
  const [cards, setCards] = useState<Card[]>(generateCards);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isComplete && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isComplete]);

  const handleCardPress = useCallback(
    (cardId: string) => {
      if (isChecking || flippedIds.length >= 2) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newFlipped = [...flippedIds, cardId];
      setFlippedIds(newFlipped);
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
      );

      if (newFlipped.length === 2) {
        setIsChecking(true);
        setMoves((m) => m + 1);
        const [id1, id2] = newFlipped;
        const card1 = cards.find((c) => c.id === id1)!;
        const card2 = cards.find((c) => c.id === id2)!;

        if (card1.emoji === card2.emoji) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === id1 || c.id === id2 ? { ...c, isMatched: true, isFlipped: false } : c
              )
            );
            setFlippedIds([]);
            setIsChecking(false);
            setCards((prev) => {
              const allMatched = prev.every((c) => c.isMatched || c.id === id1 || c.id === id2);
              if (allMatched) setIsComplete(true);
              return prev;
            });
          }, 400);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === id1 || c.id === id2 ? { ...c, isFlipped: false } : c
              )
            );
            setFlippedIds([]);
            setIsChecking(false);
          }, 800);
        }
      }
    },
    [cards, flippedIds, isChecking]
  );

  useEffect(() => {
    const allMatched = cards.every((c) => c.isMatched);
    if (allMatched && cards.length > 0 && !isComplete) {
      setIsComplete(true);
      handleComplete();
    }
  }, [cards]);

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const duration = Date.now() - startTime;
    await addDetoxRecord({
      id: generateId(),
      type: "brain",
      gameType: "memory",
      durationMs: duration,
      score: Math.max(100 - moves * 2, 10),
      date: getTodayDateString(),
      timestamp: Date.now(),
    });
  };

  const resetGame = () => {
    setCards(generateCards());
    setFlippedIds([]);
    setMoves(0);
    setElapsedSeconds(0);
    setIsComplete(false);
    setIsChecking(false);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const CARD_SIZE = 72;

  if (isComplete) {
    const score = Math.max(100 - moves * 2, 10);
    return (
      <ScreenContainer>
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={[styles.completeTitle, { color: colors.foreground }]}>완료!</Text>
          <Text style={[styles.completeSubtitle, { color: colors.muted }]}>
            기억력 게임을 완료했어요
          </Text>
          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>{score}</Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>점수</Text>
              </View>
              <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>{moves}</Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>시도</Text>
              </View>
              <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreValue, { color: colors.primary }]}>{formatTime(elapsedSeconds)}</Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>시간</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={resetGame}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.btnText}>다시 하기</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={[styles.btnOutline, { borderColor: colors.border }]}
          >
            <Text style={[styles.btnOutlineText, { color: colors.muted }]}>돌아가기</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.gameContainer}>
        {/* Header */}
        <View style={styles.gameHeader}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.muted }]}>‹ 뒤로</Text>
          </Pressable>
          <Text style={[styles.gameTitle, { color: colors.foreground }]}>기억력 게임</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statChipText, { color: colors.foreground }]}>⏱ {formatTime(elapsedSeconds)}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statChipText, { color: colors.foreground }]}>🎯 {moves}회</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statChipText, { color: colors.foreground }]}>
              ✓ {cards.filter((c) => c.isMatched).length / 2}/{CARD_EMOJIS.length}
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, row) => (
            <View key={row} style={styles.gridRow}>
              {cards.slice(row * 4, row * 4 + 4).map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onPress={() => handleCardPress(card.id)}
                  size={CARD_SIZE}
                  colors={colors}
                />
              ))}
            </View>
          ))}
        </View>

        <Pressable
          onPress={resetGame}
          style={[styles.resetBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.resetText, { color: colors.muted }]}>↺ 초기화</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gameContainer: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    fontSize: 16,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  statChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  cardWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardFace: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFront: {
    position: "absolute",
  },
  cardBack: {
    fontSize: 24,
    fontWeight: "700",
    color: "#6C63FF",
  },
  resetBtn: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetText: {
    fontSize: 14,
    fontWeight: "600",
  },
  completeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  completeEmoji: {
    fontSize: 64,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: "800",
  },
  completeSubtitle: {
    fontSize: 16,
    textAlign: "center",
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
    fontSize: 24,
    fontWeight: "700",
  },
  scoreLabel: {
    fontSize: 13,
  },
  scoreDivider: {
    width: 1,
    height: 40,
  },
  btn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnOutline: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  btnOutlineText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

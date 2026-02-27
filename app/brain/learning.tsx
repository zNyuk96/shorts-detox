import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { LearningQuestion, GameRanking } from "@/lib/learning-game-types";
import { LEARNING_QUESTIONS, RANKING_LABELS } from "@/lib/learning-game-types";
import { saveGameScore, calculateRanking } from "@/lib/store-ranking";

export default function LearningGameScreen() {
  const colors = useColors();
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [ranking, setRanking] = useState<GameRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameComplete, setGameComplete] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = async () => {
    // 문제 무작위 선택 (5개)
    const shuffled = [...LEARNING_QUESTIONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    setQuestions(shuffled);
    setLoading(false);
  };

  const handleSelectAnswer = (index: number) => {
    if (answered) return;
    setSelectedAnswer(index);
    setAnswered(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 정답 확인
    const isCorrect = index === questions[currentIndex].correctAnswerIndex;
    if (isCorrect) {
      setScore((prev) => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      // 게임 완료
      await completeGame();
    }
  };

  const completeGame = async () => {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const accuracy = Math.round((score / questions.length) * 100);

    // 점수 저장
    await saveGameScore({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      gameType: "learning",
      score,
      maxScore: questions.length,
      accuracy,
      durationMs,
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
    });

    // 랭킹 계산
    const newRanking = await calculateRanking("learning");
    setRanking(newRanking);
    setGameComplete(true);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            문제 로딩 중...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (gameComplete && ranking) {
    return (
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 결과 헤더 */}
          <View style={styles.resultHeader}>
            <Text
              style={[styles.resultTitle, { color: colors.foreground }]}
            >
              🎓 학습 완료!
            </Text>
            <Text
              style={[styles.resultSubtitle, { color: colors.muted }]}
            >
              정보를 학습하고 문제를 풀었어요
            </Text>
          </View>

          {/* 점수 카드 */}
          <View
            style={[
              styles.scoreCard,
              { backgroundColor: colors.primary + "15", borderColor: colors.primary },
            ]}
          >
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>
                  정답률
                </Text>
                <Text
                  style={[
                    styles.scoreValue,
                    { color: colors.primary },
                  ]}
                >
                  {ranking.averageScore}%
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>
                  정답 수
                </Text>
                <Text
                  style={[
                    styles.scoreValue,
                    { color: colors.primary },
                  ]}
                >
                  {score}/{questions.length}
                </Text>
              </View>
            </View>
          </View>

          {/* 랭킹 정보 */}
          <View
            style={[
              styles.rankingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rankingTitle, { color: colors.foreground }]}>
              📊 당신의 순위
            </Text>

            <View style={styles.rankingBadge}>
              <Text style={styles.rankingLevelText}>
                {ranking.rankingLevel}
              </Text>
              <Text
                style={[
                  styles.rankingLevelLabel,
                  { color: colors.foreground },
                ]}
              >
                {RANKING_LABELS[ranking.rankingLevel]}
              </Text>
            </View>

            <View style={styles.rankingStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  상위 순위
                </Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {ranking.topPercentage}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  플레이 횟수
                </Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {ranking.playCount}회
                </Text>
              </View>
            </View>
          </View>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={() => {
                setCurrentIndex(0);
                setSelectedAnswer(null);
                setAnswered(false);
                setScore(0);
                setGameComplete(false);
                initializeGame();
              }}
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={styles.retryBtnText}>다시 풀기</Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backBtn,
                {
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.backBtnText, { color: colors.foreground }]}>
                돌아가기
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (questions.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            문제를 불러올 수 없습니다
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isCorrect =
    answered &&
    selectedAnswer === currentQuestion.correctAnswerIndex;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 진행률 */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.muted }]}>
            {currentIndex + 1} / {questions.length}
          </Text>
        </View>

        {/* 정보 콘텐츠 */}
        <View
          style={[
            styles.contentCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.categoryBadge,
              { backgroundColor: colors.primary + "20", color: colors.primary },
            ]}
          >
            {currentQuestion.category}
          </Text>
          <Text
            style={[
              styles.contentText,
              { color: colors.foreground },
            ]}
          >
            {currentQuestion.content}
          </Text>
        </View>

        {/* 문제 */}
        <View
          style={[
            styles.questionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.questionText,
              { color: colors.foreground },
            ]}
          >
            {currentQuestion.question}
          </Text>
        </View>

        {/* 선택지 */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrectOption =
              index === currentQuestion.correctAnswerIndex;

            let backgroundColor = colors.surface;
            let borderColor = colors.border;

            if (answered) {
              if (isCorrectOption) {
                backgroundColor = colors.success + "20";
                borderColor = colors.success;
              } else if (isSelected && !isCorrect) {
                backgroundColor = colors.error + "20";
                borderColor = colors.error;
              }
            } else if (isSelected) {
              backgroundColor = colors.primary + "20";
              borderColor = colors.primary;
            }

            return (
              <Pressable
                key={index}
                onPress={() => handleSelectAnswer(index)}
                disabled={answered}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor,
                    borderColor,
                  },
                ]}
              >
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.optionCircle,
                      {
                        borderColor,
                        backgroundColor: isSelected
                          ? colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionNumber,
                        {
                          color: isSelected ? "#fff" : colors.muted,
                        },
                      ]}
                    >
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.foreground },
                    ]}
                  >
                    {option}
                  </Text>
                </View>

                {answered && isCorrectOption && (
                  <Text style={styles.correctBadge}>✓</Text>
                )}
                {answered && isSelected && !isCorrect && (
                  <Text style={styles.incorrectBadge}>✗</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* 설명 (답변 후) */}
        {answered && (
          <View
            style={[
              styles.explanationCard,
              {
                backgroundColor: isCorrect
                  ? colors.success + "15"
                  : colors.error + "15",
                borderColor: isCorrect ? colors.success : colors.error,
              },
            ]}
          >
            <Text
              style={[
                styles.explanationTitle,
                { color: isCorrect ? colors.success : colors.error },
              ]}
            >
              {isCorrect ? "✓ 정답입니다!" : "✗ 틀렸습니다"}
            </Text>
            <Text
              style={[
                styles.explanationText,
                { color: colors.foreground },
              ]}
            >
              {currentQuestion.explanation}
            </Text>
          </View>
        )}

        {/* 다음 버튼 */}
        {answered && (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={styles.nextBtnText}>
              {currentIndex === questions.length - 1
                ? "결과 보기"
                : "다음 문제"}
            </Text>
          </Pressable>
        )}
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
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "500",
  },
  contentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  contentText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
  },
  questionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  optionNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  correctBadge: {
    fontSize: 18,
    color: "#22C55E",
    fontWeight: "700",
  },
  incorrectBadge: {
    fontSize: 18,
    color: "#EF4444",
    fontWeight: "700",
  },
  explanationCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },
  nextBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "500",
  },
  resultHeader: {
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  resultSubtitle: {
    fontSize: 14,
  },
  scoreCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  scoreLabel: {
    fontSize: 13,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  rankingCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  rankingTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  rankingBadge: {
    alignItems: "center",
    gap: 4,
  },
  rankingLevelText: {
    fontSize: 48,
    fontWeight: "700",
  },
  rankingLevelLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  rankingStats: {
    flexDirection: "row",
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  retryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  backBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

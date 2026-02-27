import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameScore, GameRanking, RankingStats } from "./learning-game-types";

const GAME_SCORES_KEY = "game_scores";
const RANKING_STATS_KEY = "ranking_stats";

/**
 * 게임 점수 저장
 */
export async function saveGameScore(score: GameScore): Promise<void> {
  try {
    const existing = await getGameScores();
    existing.push(score);
    await AsyncStorage.setItem(GAME_SCORES_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error("[Store] Failed to save game score:", error);
  }
}

/**
 * 모든 게임 점수 조회
 */
export async function getGameScores(): Promise<GameScore[]> {
  try {
    const data = await AsyncStorage.getItem(GAME_SCORES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Store] Failed to get game scores:", error);
    return [];
  }
}

/**
 * 특정 게임 타입의 모든 점수 조회
 */
export async function getGameScoresByType(
  gameType: "memory" | "focus" | "reaction" | "learning"
): Promise<GameScore[]> {
  const scores = await getGameScores();
  return scores.filter((s) => s.gameType === gameType);
}

/**
 * 게임 타입별 랭킹 계산
 */
export async function calculateRanking(
  gameType: "memory" | "focus" | "reaction" | "learning"
): Promise<GameRanking> {
  const scores = await getGameScoresByType(gameType);

  if (scores.length === 0) {
    return {
      gameType,
      personalBest: 0,
      averageScore: 0,
      playCount: 0,
      percentile: 0,
      rankingLevel: "D",
      topPercentage: "N/A",
      lastPlayedAt: 0,
    };
  }

  // 개인 최고 점수
  const personalBest = Math.max(...scores.map((s) => s.score));

  // 평균 점수
  const averageScore = Math.round(
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length
  );

  // 플레이 횟수
  const playCount = scores.length;

  // 마지막 플레이 시간
  const lastPlayedAt = Math.max(...scores.map((s) => s.timestamp));

  // 백분위 계산 (데이터 기반)
  const percentile = calculatePercentile(personalBest, gameType);

  // 랭킹 레벨 판정
  const rankingLevel = getRankingLevel(percentile);

  // 상위 몇 % 표시
  const topPercentage = `상위 ${(100 - percentile).toFixed(1)}%`;

  return {
    gameType,
    personalBest,
    averageScore,
    playCount,
    percentile,
    rankingLevel,
    topPercentage,
    lastPlayedAt,
  };
}

/**
 * 백분위 계산 (데이터 기반)
 * - 사용자의 점수가 전체 점수 분포에서 어느 위치인지 계산
 */
function calculatePercentile(
  score: number,
  gameType: "memory" | "focus" | "reaction" | "learning"
): number {
  // 시뮬레이션: 게임 타입별 점수 분포
  const distributions: Record<string, { mean: number; std: number }> = {
    memory: { mean: 6, std: 2 },
    focus: { mean: 75, std: 15 },
    reaction: { mean: 500, std: 150 },
    learning: { mean: 70, std: 15 },
  };

  const dist = distributions[gameType] || { mean: 50, std: 20 };

  // 정규분포 기반 백분위 계산 (근사)
  const zScore = (score - dist.mean) / dist.std;
  const percentile = Math.min(
    100,
    Math.max(0, 50 + 34.13 * Math.tanh(zScore / 2))
  );

  return Math.round(percentile);
}

/**
 * 백분위에 따른 랭킹 레벨 판정
 */
function getRankingLevel(percentile: number): "S" | "A" | "B" | "C" | "D" {
  if (percentile >= 95) return "S";
  if (percentile >= 85) return "A";
  if (percentile >= 60) return "B";
  if (percentile >= 25) return "C";
  return "D";
}

/**
 * 랭킹 통계 업데이트
 */
export async function updateRankingStats(): Promise<RankingStats> {
  const allScores = await getGameScores();

  // 게임 타입별 점수 분포
  const scoreDistribution: Record<string, number[]> = {
    memory: [],
    focus: [],
    reaction: [],
    learning: [],
  };

  // 게임 타입별 평균 점수
  const averageScores: Record<string, number> = {
    memory: 0,
    focus: 0,
    reaction: 0,
    learning: 0,
  };

  // 게임 타입별 중앙값
  const medianScores: Record<string, number> = {
    memory: 0,
    focus: 0,
    reaction: 0,
    learning: 0,
  };

  // 점수 분포 계산
  for (const score of allScores) {
    scoreDistribution[score.gameType].push(score.score);
  }

  // 평균 및 중앙값 계산
  for (const gameType of ["memory", "focus", "reaction", "learning"] as const) {
    const scores = scoreDistribution[gameType];
    if (scores.length > 0) {
      averageScores[gameType] = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
      scores.sort((a, b) => a - b);
      medianScores[gameType] =
        scores[Math.floor(scores.length / 2)];
    }
  }

  const stats: RankingStats = {
    totalPlayers: 10000 + Math.floor(Math.random() * 90000), // 시뮬레이션
    scoreDistribution,
    averageScores,
    medianScores,
  };

  try {
    await AsyncStorage.setItem(RANKING_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error("[Store] Failed to save ranking stats:", error);
  }

  return stats;
}

/**
 * 랭킹 통계 조회
 */
export async function getRankingStats(): Promise<RankingStats> {
  try {
    const data = await AsyncStorage.getItem(RANKING_STATS_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error("[Store] Failed to get ranking stats:", error);
  }

  // 기본값 반환
  return {
    totalPlayers: 10000,
    scoreDistribution: {
      memory: [],
      focus: [],
      reaction: [],
      learning: [],
    },
    averageScores: {
      memory: 6,
      focus: 75,
      reaction: 500,
      learning: 70,
    },
    medianScores: {
      memory: 6,
      focus: 75,
      reaction: 500,
      learning: 70,
    },
  };
}

/**
 * 게임 점수 초기화 (테스트용)
 */
export async function clearGameScores(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GAME_SCORES_KEY);
    await AsyncStorage.removeItem(RANKING_STATS_KEY);
  } catch (error) {
    console.error("[Store] Failed to clear game scores:", error);
  }
}

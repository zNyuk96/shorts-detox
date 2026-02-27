/**
 * 정보 학습 게임 타입 정의
 * - 유익한 정보 전달 + 객관식 문제
 * - 모든 게임에 적용되는 랭킹 시스템
 */

export interface LearningQuestion {
  /** 문제 ID */
  id: string;
  /** 카테고리 (뇌과학, 심리학, 건강, 역사 등) */
  category: string;
  /** 정보 전달 글 (200~1000자) */
  content: string;
  /** 문제 텍스트 */
  question: string;
  /** 선택지 (4개) */
  options: string[];
  /** 정답 인덱스 (0-3) */
  correctAnswerIndex: number;
  /** 정답 설명 */
  explanation: string;
  /** 난이도 (1-5) */
  difficulty: number;
  /** 생성 날짜 */
  createdAt: number;
}

export interface GameScore {
  /** 점수 ID */
  id: string;
  /** 게임 타입 (memory, focus, reaction, learning) */
  gameType: "memory" | "focus" | "reaction" | "learning";
  /** 사용자 점수 */
  score: number;
  /** 최대 점수 */
  maxScore: number;
  /** 정답률 (%) - 객관식 게임용 */
  accuracy?: number;
  /** 소요 시간 (밀리초) */
  durationMs: number;
  /** 게임 날짜 */
  date: string;
  /** 기록 시간 */
  timestamp: number;
}

export interface GameRanking {
  /** 게임 타입 */
  gameType: "memory" | "focus" | "reaction" | "learning";
  /** 사용자의 최고 점수 */
  personalBest: number;
  /** 평균 점수 */
  averageScore: number;
  /** 플레이 횟수 */
  playCount: number;
  /** 백분위 순위 (0-100) */
  percentile: number;
  /** 랭킹 레벨 */
  rankingLevel: "S" | "A" | "B" | "C" | "D";
  /** 상위 몇 % */
  topPercentage: string;
  /** 마지막 플레이 날짜 */
  lastPlayedAt: number;
}

export interface RankingStats {
  /** 전체 플레이어 수 (시뮬레이션용) */
  totalPlayers: number;
  /** 게임별 점수 분포 */
  scoreDistribution: Record<string, number[]>;
  /** 게임별 평균 점수 */
  averageScores: Record<string, number>;
  /** 게임별 중앙값 */
  medianScores: Record<string, number>;
}

/**
 * 랭킹 레벨 판정 기준
 * - S: 상위 5% (매우 우수)
 * - A: 상위 5~15% (우수)
 * - B: 상위 15~40% (양호)
 * - C: 상위 40~75% (보통)
 * - D: 상위 75~100% (노력 필요)
 */
export const RANKING_THRESHOLDS = {
  S: 95,
  A: 85,
  B: 60,
  C: 25,
  D: 0,
};

export const RANKING_LABELS = {
  S: "🏆 매우 우수",
  A: "⭐ 우수",
  B: "👍 양호",
  C: "📈 보통",
  D: "💪 노력 중",
};

/**
 * 학습 게임 문제 데이터베이스 (초기 데이터)
 */
export const LEARNING_QUESTIONS: LearningQuestion[] = [
  {
    id: "q1",
    category: "뇌과학",
    content:
      "인간의 뇌는 약 860억 개의 신경세포(뉴런)로 이루어져 있습니다. 이 신경세포들은 시냅스라는 연결고리를 통해 서로 통신합니다. 흥미로운 점은 우리가 새로운 것을 배울 때마다 뇌의 신경망이 재구성된다는 것입니다. 이를 '신경가소성(neuroplasticity)'이라고 부르며, 이는 뇌가 평생 학습하고 적응할 수 있다는 증거입니다. 숏츠 같은 반복적인 자극은 뇌의 도파민 회로를 과도하게 자극하여 집중력 저하를 초래합니다.",
    question: "신경가소성(neuroplasticity)의 의미는?",
    options: [
      "뇌의 신경세포가 고정되어 변하지 않는 성질",
      "새로운 학습에 따라 뇌의 신경망이 재구성되는 능력",
      "뇌의 신경세포 수가 시간에 따라 증가하는 현상",
      "나이가 들수록 뇌의 기능이 완전히 상실되는 과정",
    ],
    correctAnswerIndex: 1,
    explanation:
      "신경가소성은 뇌가 학습과 경험을 통해 신경망을 재구성할 수 있는 능력입니다. 이는 뇌가 평생 학습하고 적응할 수 있다는 증거입니다.",
    difficulty: 3,
    createdAt: Date.now(),
  },
  {
    id: "q2",
    category: "심리학",
    content:
      "도파민은 뇌의 보상 시스템과 관련된 신경전달물질입니다. 우리가 즐거운 경험을 할 때 도파민이 분비되어 그 행동을 반복하도록 유도합니다. 그러나 과도한 도파민 자극은 '도파민 내성'을 유발하여, 같은 수준의 자극으로는 만족감을 느끼지 못하게 됩니다. 숏츠 플랫폼은 이 도파민 중독 메커니즘을 최대한 활용하여 사용자의 시간을 빼앗습니다.",
    question: "도파민 내성이란 무엇인가요?",
    options: [
      "도파민이 뇌에서 완전히 사라지는 현상",
      "같은 수준의 자극으로는 만족감을 느끼지 못하게 되는 현상",
      "도파민 분비가 과도하게 증가하는 상태",
      "뇌가 도파민을 거부하는 면역 반응",
    ],
    correctAnswerIndex: 1,
    explanation:
      "도파민 내성은 반복적인 자극으로 인해 같은 수준의 자극으로는 더 이상 만족감을 느끼지 못하는 현상입니다. 이는 중독 메커니즘의 핵심입니다.",
    difficulty: 3,
    createdAt: Date.now(),
  },
  {
    id: "q3",
    category: "건강",
    content:
      "수면은 뇌의 기억 통합과 독소 제거에 필수적입니다. 특히 REM 수면 중에 뇌는 하루 동안 습득한 정보를 장기 기억으로 변환합니다. 수면 부족은 집중력 저하, 기억력 감퇴, 감정 조절 능력 감소를 초래합니다. 자기 전 1시간 동안 스마트폰 사용을 피하는 것이 중요한데, 이는 블루라이트가 수면 호르몬인 멜라토닌 분비를 억제하기 때문입니다.",
    question: "REM 수면의 주요 기능은?",
    options: [
      "신체의 물리적 회복",
      "뇌의 기억 통합과 정보 처리",
      "심장 박동 조절",
      "체온 유지",
    ],
    correctAnswerIndex: 1,
    explanation:
      "REM 수면은 뇌가 하루 동안 습득한 정보를 장기 기억으로 변환하는 시간입니다. 이 단계에서 뇌는 중요한 기억 통합 작업을 수행합니다.",
    difficulty: 2,
    createdAt: Date.now(),
  },
  {
    id: "q4",
    category: "심리학",
    content:
      "주의력 결핍은 '주의 자원 고갈(attention resource depletion)' 현상으로 설명할 수 있습니다. 인간의 주의력은 제한된 자원이며, 반복적인 자극에 노출되면 이 자원이 빠르게 소진됩니다. 숏츠와 같은 짧은 형식의 콘텐츠에 지속적으로 노출되면 뇌는 깊이 있는 사고를 하기 위한 주의력을 잃게 됩니다. 이를 회복하려면 의도적인 집중 연습과 휴식이 필요합니다.",
    question: "주의 자원 고갈이란?",
    options: [
      "뇌의 산소 부족으로 인한 현상",
      "제한된 주의력 자원이 반복적 자극으로 소진되는 현상",
      "나이가 들면서 자동으로 발생하는 현상",
      "특정 질병으로 인한 증상",
    ],
    correctAnswerIndex: 1,
    explanation:
      "주의 자원 고갈은 제한된 주의력이 반복적인 자극에 노출되어 소진되는 현상입니다. 이는 깊이 있는 사고 능력을 감소시킵니다.",
    difficulty: 4,
    createdAt: Date.now(),
  },
  {
    id: "q5",
    category: "뇌과학",
    content:
      "전전두피질(prefrontal cortex)은 인간의 고차 인지 기능을 담당하는 뇌 영역입니다. 이 영역은 계획, 의사결정, 충동 억제, 장기 목표 설정 등을 관장합니다. 청소년기와 초기 성인기(약 25세까지)에 전전두피질이 완전히 발달합니다. 반복적인 숏츠 시청은 이 영역의 활성화를 방해하여 충동 조절 능력을 저하시킵니다.",
    question: "전전두피질의 주요 기능은?",
    options: [
      "신체의 운동 조절",
      "감정 인식",
      "계획, 의사결정, 충동 억제 등 고차 인지 기능",
      "음식 섭취 조절",
    ],
    correctAnswerIndex: 2,
    explanation:
      "전전두피질은 계획, 의사결정, 충동 억제, 장기 목표 설정 등 인간의 고차 인지 기능을 담당합니다.",
    difficulty: 3,
    createdAt: Date.now(),
  },
];

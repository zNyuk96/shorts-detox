import { View, Text, StyleSheet } from "react-native";
import type { GameRanking } from "@/lib/learning-game-types";
import { RANKING_LABELS } from "@/lib/learning-game-types";

interface RankingBadgeProps {
  ranking: GameRanking;
  size?: "small" | "medium" | "large";
}

export function RankingBadge({ ranking, size = "medium" }: RankingBadgeProps) {
  const styles_map = {
    small: {
      container: styles.containerSmall,
      level: styles.levelSmall,
      label: styles.labelSmall,
    },
    medium: {
      container: styles.containerMedium,
      level: styles.levelMedium,
      label: styles.labelMedium,
    },
    large: {
      container: styles.containerLarge,
      level: styles.levelLarge,
      label: styles.labelLarge,
    },
  };

  const style_set = styles_map[size];

  // 랭킹 레벨별 색상
  const levelColors = {
    S: "#FFD700",
    A: "#FF8C00",
    B: "#4169E1",
    C: "#32CD32",
    D: "#A9A9A9",
  };

  const bgColors = {
    S: "#FFD70020",
    A: "#FF8C0020",
    B: "#4169E120",
    C: "#32CD3220",
    D: "#A9A9A920",
  };

  return (
    <View
      style={[
        style_set.container,
        { backgroundColor: bgColors[ranking.rankingLevel] },
      ]}
    >
      <Text
        style={[
          style_set.level,
          { color: levelColors[ranking.rankingLevel] },
        ]}
      >
        {ranking.rankingLevel}
      </Text>
      <View>
        <Text
          style={[
            style_set.label,
            { color: levelColors[ranking.rankingLevel] },
          ]}
        >
          {RANKING_LABELS[ranking.rankingLevel]}
        </Text>
        <Text style={styles.percentage}>
          {ranking.topPercentage}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  containerMedium: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  containerLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  levelSmall: {
    fontSize: 18,
    fontWeight: "700",
  },
  levelMedium: {
    fontSize: 24,
    fontWeight: "700",
  },
  levelLarge: {
    fontSize: 32,
    fontWeight: "700",
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: "600",
  },
  labelMedium: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelLarge: {
    fontSize: 15,
    fontWeight: "600",
  },
  percentage: {
    fontSize: 11,
    fontWeight: "400",
    color: "#666",
    marginTop: 2,
  },
});

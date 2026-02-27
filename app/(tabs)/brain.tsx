import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const GAMES = [
  {
    id: "memory",
    title: "기억력 게임",
    desc: "카드를 뒤집어 같은 쌍을 찾으세요",
    emoji: "🃏",
    color: "#6C63FF",
    benefit: "단기 기억력 강화",
  },
  {
    id: "focus",
    title: "집중력 게임",
    desc: "색상과 단어가 일치하는지 판단하세요",
    emoji: "🎯",
    color: "#FF6B9D",
    benefit: "선택적 주의력 향상",
  },
  {
    id: "reaction",
    title: "반응속도 게임",
    desc: "화면에 나타나는 타겟을 빠르게 탭하세요",
    emoji: "⚡",
    color: "#FF9F43",
    benefit: "처리 속도 개선",
  },
  {
    id: "learning",
    title: "정보 학습",
    desc: "유익한 정보를 읽고 객관식 문제를 풀어요",
    emoji: "🎓",
    color: "#00D4FF",
    benefit: "비판적 사고력 강화",
  },
];

export default function BrainTabScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>뇌 인지 개선</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
          숏츠 대신 뇌를 깨우는 게임을 해보세요
        </Text>

        {/* Benefits Banner */}
        <View style={[styles.banner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Text style={styles.bannerEmoji}>🧠</Text>
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: colors.primary }]}>왜 뇌 활동인가요?</Text>
            <Text style={[styles.bannerDesc, { color: colors.muted }]}>
              숏츠는 도파민 루프를 만들어 집중력을 저하시킵니다. 인지 게임은 전두엽을 활성화해 집중력을 회복시킵니다.
            </Text>
          </View>
        </View>

        {/* Game Cards */}
        <View style={styles.gamesGrid}>
          {GAMES.map((game) => (
            <Pressable
              key={game.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/brain/${game.id}` as any);
              }}
              style={({ pressed }) => [
                styles.gameCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.gameIconBg, { backgroundColor: game.color + "20" }]}>
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
              </View>
              <View style={styles.gameInfo}>
                <Text style={[styles.gameTitle, { color: colors.foreground }]}>{game.title}</Text>
                <Text style={[styles.gameDesc, { color: colors.muted }]}>{game.desc}</Text>
                <View style={[styles.benefitTag, { backgroundColor: game.color + "15" }]}>
                  <Text style={[styles.benefitText, { color: game.color }]}>✓ {game.benefit}</Text>
                </View>
              </View>
              <Text style={[styles.arrowIcon, { color: colors.muted }]}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Quick Start */}
        <View style={[styles.quickStartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.quickStartTitle, { color: colors.foreground }]}>⏱ 소요 시간</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Text style={[styles.timeValue, { color: colors.primary }]}>3분</Text>
              <Text style={[styles.timeLabel, { color: colors.muted }]}>기억력</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
            <View style={styles.timeItem}>
              <Text style={[styles.timeValue, { color: colors.accent }]}>2분</Text>
              <Text style={[styles.timeLabel, { color: colors.muted }]}>집중력</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
            <View style={styles.timeItem}>
              <Text style={[styles.timeValue, { color: colors.warning }]}>1분</Text>
              <Text style={[styles.timeLabel, { color: colors.muted }]}>반응속도</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
            <View style={styles.timeItem}>
              <Text style={[styles.timeValue, { color: "#00D4FF" }]}>5분</Text>
              <Text style={[styles.timeLabel, { color: colors.muted }]}>학습</Text>
            </View>
          </View>
        </View>
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
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: -8,
  },
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  bannerEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  gamesGrid: {
    gap: 12,
  },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  gameIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  gameEmoji: {
    fontSize: 28,
  },
  gameInfo: {
    flex: 1,
    gap: 4,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  gameDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  benefitTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: "600",
  },
  arrowIcon: {
    fontSize: 24,
    fontWeight: "300",
  },
  quickStartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  quickStartTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  timeLabel: {
    fontSize: 12,
  },
  timeDivider: {
    width: 1,
    height: 32,
  },
});

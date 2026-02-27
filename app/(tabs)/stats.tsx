import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { formatDuration, getWeeklyStats } from "@/lib/store";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function StatsScreen() {
  const colors = useColors();
  const { sessions, detoxActivities } = useAppContext();
  const weeklyStats = getWeeklyStats(sessions);

  const maxMs = Math.max(...weeklyStats.map((s) => s.totalWatchMs), 1);
  const totalWatchMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalDetox = detoxActivities.length;
  const brainGames = detoxActivities.filter((a) => a.type === "brain").length;
  const meditations = detoxActivities.filter((a) => a.type === "meditation").length;

  const today = new Date();
  const todayDayIndex = today.getDay();

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>통계</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>나의 디지털 웰빙 현황</Text>

        {/* Weekly Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>주간 시청 시간</Text>
          <View style={styles.barChart}>
            {weeklyStats.map((stat, i) => {
              const barHeight = maxMs > 0 ? (stat.totalWatchMs / maxMs) * 100 : 0;
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - (6 - i));
              const dayLabel = DAY_LABELS[dayDate.getDay()];
              const isToday = i === 6;
              return (
                <View key={i} style={styles.barWrapper}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(barHeight, stat.totalWatchMs > 0 ? 4 : 0),
                          backgroundColor: isToday ? colors.primary : colors.primary + "60",
                          borderRadius: 6,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      { color: isToday ? colors.primary : colors.muted, fontWeight: isToday ? "700" : "400" },
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <Text style={[styles.legendText, { color: colors.muted }]}>
              이번 주 총 {formatDuration(weeklyStats.reduce((s, d) => s + d.totalWatchMs, 0))}
            </Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.summaryEmoji}>📱</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {formatDuration(totalWatchMs)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>총 시청 시간</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.summaryEmoji}>🛑</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{totalDetox}회</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>디톡스 완료</Text>
          </View>
        </View>

        {/* Activity Breakdown */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>디톡스 활동 분류</Text>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownItem, { borderColor: colors.border }]}>
              <Text style={styles.breakdownEmoji}>🧠</Text>
              <Text style={[styles.breakdownValue, { color: colors.primary }]}>{brainGames}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>뇌 활동</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.breakdownItem, { borderColor: colors.border }]}>
              <Text style={styles.breakdownEmoji}>🧘</Text>
              <Text style={[styles.breakdownValue, { color: colors.primary }]}>{meditations}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>명상</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.breakdownItem, { borderColor: colors.border }]}>
              <Text style={styles.breakdownEmoji}>✕</Text>
              <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                {detoxActivities.filter((a) => a.type === "quit").length}
              </Text>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>그냥 끄기</Text>
            </View>
          </View>
        </View>

        {/* Tip */}
        <View style={[styles.tipCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
          <Text style={styles.tipEmoji}>💡</Text>
          <Text style={[styles.tipText, { color: colors.success }]}>
            디톡스 활동을 꾸준히 하면 도파민 수용체가 회복되어 집중력이 향상됩니다.
          </Text>
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
  chartCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    height: "100%",
    justifyContent: "flex-end",
  },
  barContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    minHeight: 0,
  },
  barLabel: {
    fontSize: 12,
  },
  chartLegend: {
    alignItems: "center",
  },
  legendText: {
    fontSize: 13,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  summaryEmoji: {
    fontSize: 28,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  breakdownCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  breakdownEmoji: {
    fontSize: 28,
  },
  breakdownValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownDivider: {
    width: 1,
    height: 48,
  },
  tipCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  tipEmoji: {
    fontSize: 20,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});

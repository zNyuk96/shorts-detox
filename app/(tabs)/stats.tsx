import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { formatDuration, getWeeklyStats, getTodayDateString, getPlatformStats } from "@/lib/store";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const PLATFORMS = [
  { id: "youtube", label: "YouTube", emoji: "▶️", color: "#FF0000" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", color: "#010101" },
  { id: "instagram", label: "Instagram", emoji: "📸", color: "#E1306C" },
  { id: "other", label: "기타", emoji: "📱", color: "#7B7B9A" },
];

export default function StatsScreen() {
  const colors = useColors();
  const { sessions, detoxActivities, platformStats, todayAttentionScore } = useAppContext();
  const weeklyStats = getWeeklyStats(sessions);

  const maxMs = Math.max(...weeklyStats.map((s) => s.totalWatchMs), 1);
  const totalWatchMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalDetox = detoxActivities.length;
  const brainGames = detoxActivities.filter((a) => a.type === "brain").length;
  const meditations = detoxActivities.filter((a) => a.type === "meditation").length;

  const today = getTodayDateString();
  const todayStats = platformStats;

  // 앱별 시청 시간 계산
  const appStats = [
    { ...PLATFORMS[0], watchMs: todayStats.youtube?.totalMs || 0 },
    { ...PLATFORMS[1], watchMs: todayStats.tiktok?.totalMs || 0 },
    { ...PLATFORMS[2], watchMs: todayStats.instagram?.totalMs || 0 },
    { ...PLATFORMS[3], watchMs: todayStats.other?.totalMs || 0 },
  ].filter((s) => s.watchMs > 0);

  const totalTodayMs = Object.values(todayStats).reduce((sum, s) => sum + (s?.totalMs || 0), 0);

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
              이번 주 총 {formatDuration(weeklyStats.reduce((s, d) => s + d.totalWatchMs, 0), "minutes")}
            </Text>
          </View>
        </View>

        {/* Today's App Breakdown */}
        {appStats.length > 0 && (
          <View style={[styles.appBreakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>📊 오늘 앱별 시청 시간</Text>
            <View style={styles.appStatsContainer}>
              {appStats.map((app) => {
                const percentage = totalTodayMs > 0 ? (app.watchMs / totalTodayMs) * 100 : 0;
                return (
                  <View key={app.id} style={styles.appStatItem}>
                    <View style={styles.appStatHeader}>
                      <Text style={styles.appEmoji}>{app.emoji}</Text>
                      <Text style={[styles.appLabel, { color: colors.foreground }]}>{app.label}</Text>
                      <Text style={[styles.appTime, { color: colors.primary }]}>
                        {formatDuration(app.watchMs, "seconds")}
                      </Text>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${percentage}%`,
                            backgroundColor: app.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.percentage, { color: colors.muted }]}>
                      {percentage.toFixed(0)}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Attention Score */}
        {todayAttentionScore && (
          <View
            style={[
              styles.attentionCard,
              {
                backgroundColor:
                  todayAttentionScore.focusLevel === "excellent"
                    ? colors.success + "15"
                    : todayAttentionScore.focusLevel === "good"
                    ? colors.primary + "15"
                    : todayAttentionScore.focusLevel === "fair"
                    ? colors.warning + "15"
                    : colors.error + "15",
                borderColor:
                  todayAttentionScore.focusLevel === "excellent"
                    ? colors.success
                    : todayAttentionScore.focusLevel === "good"
                    ? colors.primary
                    : todayAttentionScore.focusLevel === "fair"
                    ? colors.warning
                    : colors.error,
              },
            ]}
          >
            <View style={styles.attentionHeader}>
              <Text style={styles.attentionEmoji}>🧠</Text>
              <View style={styles.attentionInfo}>
                <Text style={[styles.attentionTitle, { color: colors.foreground }]}>주의력 분석</Text>
                <Text
                  style={[
                    styles.attentionScore,
                    {
                      color:
                        todayAttentionScore.focusLevel === "excellent"
                          ? colors.success
                          : todayAttentionScore.focusLevel === "good"
                          ? colors.primary
                          : todayAttentionScore.focusLevel === "fair"
                          ? colors.warning
                          : colors.error,
                    },
                  ]}
                >
                  {todayAttentionScore.attentionScore}/100
                </Text>
              </View>
            </View>
            <View style={styles.attentionDetails}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>시청 시간:</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {todayAttentionScore.watchTimeMinutes}분
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>스크롤 주기:</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {todayAttentionScore.scrollFrequency.toFixed(2)}/초
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>수준:</Text>
                <Text
                  style={[
                    styles.detailValue,
                    {
                      color:
                        todayAttentionScore.focusLevel === "excellent"
                          ? colors.success
                          : todayAttentionScore.focusLevel === "good"
                          ? colors.primary
                          : todayAttentionScore.focusLevel === "fair"
                          ? colors.warning
                          : colors.error,
                    },
                  ]}
                >
                  {todayAttentionScore.focusLevel === "excellent"
                    ? "우수"
                    : todayAttentionScore.focusLevel === "good"
                    ? "양호"
                    : todayAttentionScore.focusLevel === "fair"
                    ? "보통"
                    : "낮음"}
                </Text>
              </View>
            </View>
            <Text style={[styles.recommendation, { color: colors.muted }]}>
              💡 {todayAttentionScore.recommendation}
            </Text>
          </View>
        )}

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
  appBreakdownCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  appStatsContainer: {
    gap: 12,
  },
  appStatItem: {
    gap: 6,
  },
  appStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appEmoji: {
    fontSize: 18,
  },
  appLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  appTime: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    textAlign: "right",
  },
  attentionCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  attentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  attentionEmoji: {
    fontSize: 28,
  },
  attentionInfo: {
    flex: 1,
    gap: 2,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  attentionScore: {
    fontSize: 20,
    fontWeight: "700",
  },
  attentionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  recommendation: {
    fontSize: 13,
    lineHeight: 18,
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

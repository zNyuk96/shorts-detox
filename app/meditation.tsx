import { useAppContext } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { generateId, getTodayDateString } from "@/lib/store";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

const BREATHING_TYPES = [
  {
    id: "478",
    label: "4-7-8 호흡",
    desc: "긴장 완화에 효과적",
    inhale: 4,
    hold: 7,
    exhale: 8,
    color: "#6C63FF",
  },
  {
    id: "box",
    label: "박스 호흡",
    desc: "집중력 향상에 효과적",
    inhale: 4,
    hold: 4,
    exhale: 4,
    color: "#4CAF82",
  },
  {
    id: "free",
    label: "자유 호흡",
    desc: "편안한 자연 호흡",
    inhale: 4,
    hold: 0,
    exhale: 4,
    color: "#FF9F43",
  },
];

const DURATIONS = [
  { label: "1분", seconds: 60 },
  { label: "3분", seconds: 180 },
  { label: "5분", seconds: 300 },
  { label: "10분", seconds: 600 },
];

type MeditationPhase = "inhale" | "hold" | "exhale";

export default function MeditationScreen() {
  useKeepAwake();
  const colors = useColors();
  const { addDetoxRecord } = useAppContext();

  const [selectedType, setSelectedType] = useState(BREATHING_TYPES[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[1]);
  const [isActive, setIsActive] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<MeditationPhase>("inhale");
  const [phaseCount, setPhaseCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  const breathAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    };
  }, []);

  const runBreathCycle = (type: typeof BREATHING_TYPES[0], currentPhase: MeditationPhase, count: number) => {
    const phaseDuration = currentPhase === "inhale"
      ? type.inhale
      : currentPhase === "hold"
      ? type.hold
      : type.exhale;

    if (currentPhase === "inhale") {
      Animated.parallel([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: type.inhale * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: type.inhale * 1000,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (currentPhase === "exhale") {
      Animated.parallel([
        Animated.timing(breathAnim, {
          toValue: 0.3,
          duration: type.exhale * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: type.exhale * 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }

    breathTimerRef.current = setTimeout(() => {
      let nextPhase: MeditationPhase;
      let nextCount = count + 1;

      if (currentPhase === "inhale") {
        nextPhase = type.hold > 0 ? "hold" : "exhale";
      } else if (currentPhase === "hold") {
        nextPhase = "exhale";
      } else {
        nextPhase = "inhale";
        setCycleCount((c) => c + 1);
      }

      setPhase(nextPhase);
      setPhaseCount(nextCount);
      runBreathCycle(type, nextPhase, nextCount);
    }, phaseDuration * 1000);
  };

  const startMeditation = () => {
    setIsActive(true);
    setIsDone(false);
    setTimeLeft(selectedDuration.seconds);
    setPhase("inhale");
    setPhaseCount(0);
    setCycleCount(0);
    startTimeRef.current = Date.now();

    breathAnim.setValue(0.3);
    opacityAnim.setValue(0.4);
    runBreathCycle(selectedType, "inhale", 0);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
          setIsActive(false);
          setIsDone(true);
          handleComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const stopMeditation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    breathAnim.setValue(0.3);
    opacityAnim.setValue(0.4);
    setIsActive(false);
    setPhase("inhale");
  };

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const duration = Date.now() - startTimeRef.current;
    await addDetoxRecord({
      id: generateId(),
      type: "meditation",
      durationMs: duration,
      date: getTodayDateString(),
      timestamp: Date.now(),
    });
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const getPhaseLabel = () => {
    if (phase === "inhale") return "들이쉬기";
    if (phase === "hold") return "참기";
    return "내쉬기";
  };

  const getPhaseEmoji = () => {
    if (phase === "inhale") return "🌬️";
    if (phase === "hold") return "✋";
    return "💨";
  };

  if (isDone) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🧘</Text>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>명상 완료!</Text>
          <Text style={[styles.doneSubtitle, { color: colors.muted }]}>
            {selectedDuration.label} 동안 {cycleCount}번의 호흡 사이클을 완료했어요
          </Text>
          <View style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.doneCardText, { color: colors.foreground }]}>
              명상은 스트레스 호르몬(코르티솔)을 낮추고 전두엽 활성화를 도와 집중력을 회복시킵니다. 잘 하셨어요! 🌟
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setIsDone(false);
              setIsActive(false);
            }}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.btnText}>다시 명상하기</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            style={[styles.btnOutline, { borderColor: colors.border }]}
          >
            <Text style={[styles.btnOutlineText, { color: colors.muted }]}>홈으로</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (isActive) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
        <View style={[styles.activeContainer, { backgroundColor: colors.background }]}>
          {/* Timer */}
          <View style={styles.activeHeader}>
            <Text style={[styles.activeTimer, { color: colors.foreground }]}>{formatTime(timeLeft)}</Text>
            <Text style={[styles.activeCycles, { color: colors.muted }]}>{cycleCount}번 완료</Text>
          </View>

          {/* Breathing Circle */}
          <View style={styles.breathWrapper}>
            <Animated.View
              style={[
                styles.breathOuter,
                {
                  backgroundColor: selectedType.color + "15",
                  transform: [{ scale: breathAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.6, 1.1] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.breathMiddle,
                {
                  backgroundColor: selectedType.color + "30",
                  transform: [{ scale: breathAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.7, 1] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.breathInner,
                {
                  backgroundColor: selectedType.color,
                  opacity: opacityAnim,
                  transform: [{ scale: breathAnim }],
                },
              ]}
            />
            <View style={styles.breathCenter}>
              <Text style={styles.phaseEmoji}>{getPhaseEmoji()}</Text>
              <Text style={[styles.phaseLabel, { color: "#fff" }]}>{getPhaseLabel()}</Text>
            </View>
          </View>

          {/* Type Label */}
          <View style={styles.typeInfo}>
            <Text style={[styles.typeName, { color: selectedType.color }]}>{selectedType.label}</Text>
            <Text style={[styles.typeDesc, { color: colors.muted }]}>{selectedType.desc}</Text>
          </View>

          {/* Stop Button */}
          <Pressable
            onPress={stopMeditation}
            style={({ pressed }) => [
              styles.stopBtn,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.stopText, { color: colors.muted }]}>⏹ 중단하기</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Setup Screen
  return (
    <ScreenContainer>
      <View style={styles.setupContainer}>
        <View style={styles.setupHeader}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.muted }]}>‹ 뒤로</Text>
          </Pressable>
          <Text style={[styles.setupTitle, { color: colors.foreground }]}>명상 가이드</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Breathing Type */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>호흡 방식</Text>
        <View style={styles.typeGrid}>
          {BREATHING_TYPES.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedType(type);
              }}
              style={[
                styles.typeCard,
                {
                  backgroundColor:
                    selectedType.id === type.id ? type.color + "15" : colors.surface,
                  borderColor:
                    selectedType.id === type.id ? type.color : colors.border,
                },
              ]}
            >
              <Text style={[styles.typeCardName, { color: selectedType.id === type.id ? type.color : colors.foreground }]}>
                {type.label}
              </Text>
              <Text style={[styles.typeCardDesc, { color: colors.muted }]}>{type.desc}</Text>
              <Text style={[styles.typeCardRhythm, { color: type.color }]}>
                {type.inhale}초 들숨
                {type.hold > 0 ? ` · ${type.hold}초 참기` : ""}
                {` · ${type.exhale}초 날숨`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Duration */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>시간 선택</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => (
            <Pressable
              key={d.seconds}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedDuration(d);
              }}
              style={[
                styles.durationBtn,
                {
                  backgroundColor:
                    selectedDuration.seconds === d.seconds ? colors.primary : colors.surface,
                  borderColor:
                    selectedDuration.seconds === d.seconds ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.durationText,
                  { color: selectedDuration.seconds === d.seconds ? "#fff" : colors.muted },
                ]}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Start Button */}
        <Pressable
          onPress={startMeditation}
          style={({ pressed }) => [
            styles.startBtn,
            { backgroundColor: selectedType.color, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={styles.startBtnText}>🧘 명상 시작</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  setupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    fontSize: 16,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeGrid: {
    gap: 10,
  },
  typeCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  typeCardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  typeCardDesc: {
    fontSize: 13,
  },
  typeCardRhythm: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  durationText: {
    fontSize: 14,
    fontWeight: "600",
  },
  startBtn: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  // Active state
  activeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    paddingVertical: 40,
  },
  activeHeader: {
    alignItems: "center",
    gap: 4,
  },
  activeTimer: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
  },
  activeCycles: {
    fontSize: 14,
  },
  breathWrapper: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  breathOuter: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  breathMiddle: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  breathInner: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  breathCenter: {
    position: "absolute",
    alignItems: "center",
    gap: 6,
  },
  phaseEmoji: {
    fontSize: 28,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  typeInfo: {
    alignItems: "center",
    gap: 4,
  },
  typeName: {
    fontSize: 18,
    fontWeight: "700",
  },
  typeDesc: {
    fontSize: 14,
  },
  stopBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  stopText: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Done state
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
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  doneSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  doneCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  doneCardText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
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

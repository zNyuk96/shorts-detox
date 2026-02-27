import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useAppContext } from "@/lib/app-context";
import { startOAuthLogin } from "@/constants/oauth";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_SLIDES = [
  {
    emoji: "📱",
    title: "숏츠, 얼마나 보고 있나요?",
    desc: "유튜브 숏츠, 틱톡, 릴스... 하루에 얼마나 소비하는지 알고 계신가요? 숏츠 디톡스가 당신의 시청 패턴을 추적합니다.",
  },
  {
    emoji: "🧠",
    title: "뇌를 깨우는 미니게임",
    desc: "숏츠 대신 기억력, 집중력, 반응속도 게임으로 뇌를 자극하세요. 단 3분으로 인지 능력을 개선할 수 있습니다.",
  },
  {
    emoji: "🧘",
    title: "명상으로 마음을 리셋",
    desc: "호흡 가이드와 함께 잠깐 멈춰보세요. 짧은 명상이 스크롤 중독에서 벗어나는 가장 효과적인 방법입니다.",
  },
];

export default function LoginScreen() {
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();
  const { setTestMode } = useAppContext();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showTestMode, setShowTestMode] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(idx);
  };

  const handleTestModeStart = async () => {
    // 전역 테스트 모드 활성화 (AsyncStorage에 저장) 후 홈 화면으로 이동
    setTestMode(true);
    // AsyncStorage 저장이 완료될 때까지 약간 대기
    await new Promise((resolve) => setTimeout(resolve, 100));
    router.replace("/(tabs)");
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await startOAuthLogin();
    } catch {
      // ignore
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const CARD_WIDTH = SCREEN_WIDTH - 64;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Test Mode Toggle */}
      <Pressable
        onPress={() => setShowTestMode(!showTestMode)}
        style={({ pressed }) => [styles.testModeButton, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.testModeText, { color: colors.foreground }]}>
          {showTestMode ? "🔧 TEST" : "🔒 PROD"}
        </Text>
      </Pressable>

      {/* Logo */}
      <Animated.View
        style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: colors.foreground }]}>숏츠 디톡스</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>
          스크롤을 멈추고, 뇌를 깨우세요
        </Text>
      </Animated.View>

      {/* Onboarding Card - single card at a time, full width */}
      <Animated.View style={[styles.cardArea, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScroll}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 16}
          snapToAlignment="center"
          contentContainerStyle={{ paddingHorizontal: 32 }}
        >
          {ONBOARDING_SLIDES.map((slide, i) => (
            <View key={i} style={{ width: CARD_WIDTH, marginRight: i < ONBOARDING_SLIDES.length - 1 ? 16 : 0 }}>
              <View style={[styles.slideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.slideEmoji}>{slide.emoji}</Text>
                <Text style={[styles.slideTitle, { color: colors.foreground }]}>{slide.title}</Text>
                <Text style={[styles.slideDesc, { color: colors.muted }]}>{slide.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentSlide ? colors.primary : colors.border,
                  width: i === currentSlide ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Login Buttons */}
      <Animated.View style={[styles.loginSection, { opacity: fadeAnim }]}>
        {showTestMode ? (
          <Pressable
            onPress={handleTestModeStart}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.primaryBtnIcon}>⚡</Text>
            <Text style={styles.primaryBtnText}>테스트 모드로 시작</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleLogin}
            disabled={isLoggingIn}
            style={({ pressed }) => [
              styles.googleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {isLoggingIn ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                  Google로 계속하기
                </Text>
              </>
            )}
          </Pressable>
        )}

        <Text style={[styles.terms, { color: colors.muted }]}>
          {showTestMode
            ? "🔧 테스트 모드: 로그인 없이 앱을 사용할 수 있습니다"
            : "계속 진행하면 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다."}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  testModeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    zIndex: 10,
  },
  testModeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    textAlign: "center",
  },
  cardArea: {
    flex: 1,
    justifyContent: "center",
  },
  slideCard: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  slideEmoji: {
    fontSize: 52,
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  slideDesc: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  loginSection: {
    gap: 16,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryBtnIcon: {
    fontSize: 18,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  terms: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

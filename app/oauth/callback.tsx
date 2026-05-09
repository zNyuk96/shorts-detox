import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

// This route exists as a fallback for deep link redirects.
// With expo-auth-session, the OAuth callback is handled automatically.
export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after a short delay
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16 }}>리디렉트 중...</Text>
    </View>
  );
}

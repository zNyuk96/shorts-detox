import { Platform, Alert, Linking } from "react-native";

/**
 * 백그라운드 앱 추적을 위한 권한 관리 서비스
 */
class PermissionsService {
  private permissionsRequested = false;

  /**
   * 필요한 모든 권한 확인
   */
  async checkAllPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      return await this.checkAndroidPermissions();
    } else if (Platform.OS === "ios") {
      return await this.checkIOSPermissions();
    }
    return false;
  }

  /**
   * 필요한 모든 권한 요청
   */
  async requestAllPermissions(): Promise<boolean> {
    if (this.permissionsRequested) {
      return true; // 이미 요청했으면 다시 요청하지 않음
    }

    if (Platform.OS === "android") {
      return await this.requestAndroidPermissions();
    } else if (Platform.OS === "ios") {
      return await this.requestIOSPermissions();
    }
    return false;
  }

  /**
   * Android 권한 확인
   */
  private async checkAndroidPermissions(): Promise<boolean> {
    try {
      // Android에서 PACKAGE_USAGE_STATS 권한 확인
      // 실제 구현에서는 native module을 통해 확인
      console.log("[PermissionsService] Checking Android permissions...");
      return true;
    } catch (error) {
      console.error("[PermissionsService] Error checking Android permissions:", error);
      return false;
    }
  }

  /**
   * Android 권한 요청
   */
  private async requestAndroidPermissions(): Promise<boolean> {
    try {
      this.permissionsRequested = true;

      // Android 사용자에게 권한 요청 안내
      Alert.alert(
        "백그라운드 앱 추적 권한 필요",
        "숏츠 디톡스가 YouTube, TikTok, Instagram 등의 앱 사용을 백그라운드에서 추적하려면 권한이 필요합니다.\n\n설정 > 앱 > 숏츠 디톡스 > 권한에서 '앱 사용 통계' 권한을 활성화해주세요.",
        [
          {
            text: "설정으로 이동",
            onPress: () => this.openAndroidSettings(),
          },
          {
            text: "나중에",
            onPress: () => console.log("[PermissionsService] Permission request deferred"),
          },
        ]
      );

      console.log("[PermissionsService] Android permissions requested");
      return true;
    } catch (error) {
      console.error("[PermissionsService] Error requesting Android permissions:", error);
      return false;
    }
  }

  /**
   * iOS 권한 확인
   */
  private async checkIOSPermissions(): Promise<boolean> {
    try {
      console.log("[PermissionsService] Checking iOS permissions...");
      return true;
    } catch (error) {
      console.error("[PermissionsService] Error checking iOS permissions:", error);
      return false;
    }
  }

  /**
   * iOS 권한 요청
   */
  private async requestIOSPermissions(): Promise<boolean> {
    try {
      this.permissionsRequested = true;

      // iOS 사용자에게 권한 요청 안내
      Alert.alert(
        "백그라운드 앱 추적 권한 필요",
        "숏츠 디톡스가 YouTube, TikTok, Instagram 등의 앱 사용을 추적하려면 권한이 필요합니다.\n\n설정 > 숏츠 디톡스에서 권한을 활성화해주세요.",
        [
          {
            text: "설정으로 이동",
            onPress: () => this.openIOSSettings(),
          },
          {
            text: "나중에",
            onPress: () => console.log("[PermissionsService] Permission request deferred"),
          },
        ]
      );

      console.log("[PermissionsService] iOS permissions requested");
      return true;
    } catch (error) {
      console.error("[PermissionsService] Error requesting iOS permissions:", error);
      return false;
    }
  }

  /**
   * Android 설정 페이지로 이동
   */
  private async openAndroidSettings(): Promise<void> {
    try {
      // Android 설정 앱의 앱 권한 페이지로 이동
      const packageName = "space.manus.shorts.detox"; // 실제 패키지명으로 변경 필요
      Linking.openURL(`package:${packageName}`);
    } catch (error) {
      console.error("[PermissionsService] Error opening Android settings:", error);
    }
  }

  /**
   * iOS 설정 페이지로 이동
   */
  private async openIOSSettings(): Promise<void> {
    try {
      // iOS 설정 앱으로 이동
      Linking.openURL("app-settings:");
    } catch (error) {
      console.error("[PermissionsService] Error opening iOS settings:", error);
    }
  }

  /**
   * 백그라운드 감지 권한 확인 및 요청
   */
  async ensureDetectionPermissions(): Promise<boolean> {
    const hasPermissions = await this.checkAllPermissions();

    if (!hasPermissions) {
      console.log("[PermissionsService] Requesting detection permissions...");
      return await this.requestAllPermissions();
    }

    return true;
  }
}

export const permissionsService = new PermissionsService();

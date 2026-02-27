import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { realAppDetectionService } from "./real-app-detection";

/**
 * 스크롤 감지 서비스
 * - ScrollView, FlatList 등에서 스크롤 이벤트 감지
 * - 상하좌우 스크롤 모두 감지
 */
class ScrollDetectionService {
  private lastScrollTime = 0;
  private scrollThrottleMs = 100; // 100ms 이내의 스크롤은 무시

  /**
   * 스크롤 이벤트 처리
   * ScrollView, FlatList의 onScroll 이벤트에서 호출
   */
  handleScroll(event: any): void {
    const now = Date.now();

    // 스크롤 throttle - 100ms 이내의 중복 스크롤 무시
    if (now - this.lastScrollTime < this.scrollThrottleMs) {
      return;
    }

    this.lastScrollTime = now;

    // 실제 앱 감지 서비스에 스크롤 기록
    realAppDetectionService.recordScroll();
  }

  /**
   * Gesture Handler를 사용한 스크롤 감지
   * 더 정밀한 스크롤 감지가 필요할 때 사용
   */
  createScrollGesture() {
    return Gesture.Pan()
      .onUpdate(() => {
        this.handleScroll({});
      });
  }

  /**
   * 스크롤 throttle 시간 설정
   */
  setScrollThrottle(ms: number): void {
    this.scrollThrottleMs = ms;
  }
}

export const scrollDetectionService = new ScrollDetectionService();

import { Platform } from "react-native";
import { AppDetector } from "@/modules/app-detector/src";

export async function startVpnBlocking(): Promise<"started" | "needs_permission" | "unsupported"> {
  if (Platform.OS !== "android") return "unsupported";
  try {
    const started = await AppDetector.startVpnBlocking();
    return started ? "started" : "needs_permission";
  } catch {
    return "unsupported";
  }
}

export async function stopVpnBlocking(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await AppDetector.stopVpnBlocking();
  } catch {}
}

export async function isVpnActive(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    return await AppDetector.isVpnActive();
  } catch {
    return false;
  }
}

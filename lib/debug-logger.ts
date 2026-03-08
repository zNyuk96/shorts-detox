interface LogEntry {
  timestamp: string;
  tag: string;
  message: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 200;

  log(tag: string, message: string) {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const entry: LogEntry = { timestamp, tag, message };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    // 동시에 console.log도 출력 (adb logcat 확인용)
    console.log(`[${tag}] ${message}`);
  }

  getLogs(): string {
    if (this.logs.length === 0) return "(로그 없음)";
    return this.logs
      .map((e) => `[${e.timestamp}][${e.tag}] ${e.message}`)
      .join("\n");
  }

  getLogEntries(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const debugLogger = new DebugLogger();

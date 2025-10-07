import {
  writeFileSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
} from "fs";
import { dirname } from "path";

export type PerformanceRecord = {
  service: string;
  protocol: string;
  authType: string;
  operation: string;
  duration: number;
  timestamp: Date;
};

export class PerformanceTracker {
  private static readonly JSONL_PATH = "./test-reports/performance-records.jsonl";
  private static readonly REPORT_PATH = "./test-reports/performance-report.txt";

  /**
   * Clean both files (call this in globalSetup)
   */
  static clean(): void {
    if (existsSync(this.JSONL_PATH)) {
      unlinkSync(this.JSONL_PATH);
    }
    if (existsSync(this.REPORT_PATH)) {
      unlinkSync(this.REPORT_PATH);
    }
  }

  /**
   * Record a performance measurement
   * Automatically appends to JSONL and regenerates the report
   */
  static record(data: Omit<PerformanceRecord, "timestamp">): void {
    const newRecord: PerformanceRecord = {
      ...data,
      timestamp: new Date(),
    };

    // Append to JSONL file
    const dir = dirname(this.JSONL_PATH);
    mkdirSync(dir, { recursive: true });

    const line = JSON.stringify({
      service: newRecord.service,
      protocol: newRecord.protocol,
      authType: newRecord.authType,
      operation: newRecord.operation,
      duration: newRecord.duration,
      timestamp: newRecord.timestamp.toISOString(),
    }) + "\n";

    appendFileSync(this.JSONL_PATH, line, "utf-8");

    // Read all records and regenerate report
    const allRecords = this.readAllRecords();
    this.writeReport(allRecords);
  }

  /**
   * Read all records from JSONL file
   */
  private static readAllRecords(): PerformanceRecord[] {
    if (!existsSync(this.JSONL_PATH)) {
      return [];
    }

    const content = readFileSync(this.JSONL_PATH, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const parsed = JSON.parse(line);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  }

  /**
   * Write aggregated report to TXT file
   */
  private static writeReport(records: PerformanceRecord[]): void {
    if (records.length === 0) {
      return;
    }

    // Group by endpoint (service/protocol/authType/operation)
    const grouped = new Map<string, number[]>();
    records.forEach((r) => {
      const key = `[${r.service}/${r.protocol}/${r.authType}] ${r.operation}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(r.duration);
    });

    // Calculate max duration for each endpoint (worst case = cold start)
    const aggregated = Array.from(grouped.entries()).map(([key, durations]) => {
      const count = durations.length;
      const max = Math.max(...durations);
      return { key, count, max };
    });

    // Sort by max duration (descending)
    aggregated.sort((a, b) => b.max - a.max);

    // Build report content
    let reportContent = `=== 🚀 Performance Report (${records.length} requests, ${aggregated.length} unique endpoints) ===\n\n`;
    aggregated.forEach((item, i) => {
      reportContent += `${i + 1}. ${item.key} - ${item.max}ms`;
      if (item.count > 1) {
        reportContent += ` (${item.count}x calls)`;
      }
      reportContent += "\n";
    });

    // Write report to TXT file
    writeFileSync(this.REPORT_PATH, reportContent, "utf-8");
  }
}

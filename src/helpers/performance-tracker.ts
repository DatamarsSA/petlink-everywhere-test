import {
  writeFileSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  existsSync,
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
  private static records: PerformanceRecord[] = [];
  private static readonly JSONL_PATH = "./test-reports/performance-records.jsonl";

  /**
   * Ensure the directory and file exist
   */
  private static ensureFileExists(): void {
    const dir = dirname(this.JSONL_PATH);
    mkdirSync(dir, { recursive: true });
    
    if (!existsSync(this.JSONL_PATH)) {
      writeFileSync(this.JSONL_PATH, "", "utf-8");
    }
  }

  /**
   * Record a performance measurement
   */
  static record(data: Omit<PerformanceRecord, "timestamp">): void {
    this.records.push({ ...data, timestamp: new Date() });
  }

  /**
   * Append current in-memory records to JSONL file
   * Call this in afterAll() hooks to persist data from each test file
   */
  static appendToJsonl(): void {
    if (this.records.length === 0) return;

    this.ensureFileExists();

    // Append each record as a JSON line
    this.records.forEach((record) => {
      const line =
        JSON.stringify({
          service: record.service,
          protocol: record.protocol,
          authType: record.authType,
          operation: record.operation,
          duration: record.duration,
          timestamp: record.timestamp.toISOString(),
        }) + "\n";
      appendFileSync(this.JSONL_PATH, line, "utf-8");
    });
  }

  /**
   * Generate aggregated performance report from JSONL file and overwrite it
   * Call this in globalTeardown to create the final report
   */
  static generateReportFromJsonl(): void {
    this.ensureFileExists();

    // Read and parse JSONL file
    const content = readFileSync(this.JSONL_PATH, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      const message =
        "\n=== 🚀 Performance Report ===\nNo requests tracked yet\n";
      console.log(message);
      writeFileSync(this.JSONL_PATH, message, "utf-8");
      return;
    }

    const records = lines.map((line) => JSON.parse(line));

    // Group by endpoint (service/protocol/authType/operation)
    const grouped = new Map<string, number[]>();
    records.forEach((r: any) => {
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
    let reportContent = `=== 🚀 Performance Report (${records.length} requests, ${aggregated.length} unique endpoints) ===\n`;
    aggregated.forEach((item, i) => {
      if (item.count === 1) {
        reportContent += `${i + 1}. ${item.key} - ${item.max}ms\n`;
      } else {
        reportContent += `${i + 1}. ${item.key} - ${item.max}ms (${item.count}x calls)\n`;
      }
    });
    reportContent += `Total Requests: ${records.length}\n`;

    // Log to console
    console.log(`\n${reportContent}`);

    // OVERWRITE the same JSONL file with the aggregated report
    writeFileSync(this.JSONL_PATH, reportContent, "utf-8");
  }

  /**
   * Clean the JSONL file (call this in globalSetup)
   */
  static cleanJsonl(): void {
    this.ensureFileExists();
    writeFileSync(this.JSONL_PATH, "", "utf-8");
  }

  /**
   * Clear in-memory records
   */
  static clear(): void {
    this.records = [];
  }

  /**
   * Get sorted records (for debugging)
   */
  static getRecords(): PerformanceRecord[] {
    return [...this.records].sort((a, b) => b.duration - a.duration);
  }
}

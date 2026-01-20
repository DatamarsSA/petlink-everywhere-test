import { writeFileSync, mkdirSync, appendFileSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";
import { logger } from "../config/logger.js";

export type PerformanceRecord = {
  service: string;
  protocol: string;
  authType: string;
  operation: string;
  duration: number;
  timestamp: Date;
};

export class PerformanceTracker {
  private readonly jsonlPath: string;
  private readonly reportPath: string;

  constructor(jsonlPath = "./test-reports/performance-records.jsonl", reportPath = "./test-reports/performance-report.txt") {
    this.jsonlPath = jsonlPath;
    this.reportPath = reportPath;
  }

  /**
   * Record a performance measurement
   * Appends to JSONL and regenerates the report
   */
  recordPerformance(data: Omit<PerformanceRecord, "timestamp">): void {
    const newRecord: PerformanceRecord = {
      ...data,
      timestamp: new Date(),
    };

    // Append to JSONL file
    const dir = dirname(this.jsonlPath);
    mkdirSync(dir, { recursive: true });

    const line =
      JSON.stringify({
        service: newRecord.service,
        protocol: newRecord.protocol,
        authType: newRecord.authType,
        operation: newRecord.operation,
        duration: newRecord.duration,
        timestamp: newRecord.timestamp.toISOString(),
      }) + "\n";

    appendFileSync(this.jsonlPath, line, "utf-8");

    // Read all records and regenerate report
    const allRecords = this.readAllRecords();
    this.writeReport(allRecords);
  }

  /**
   * Read all records from JSONL file
   */
  private readAllRecords(): PerformanceRecord[] {
    if (!existsSync(this.jsonlPath)) {
      return [];
    }

    const content = readFileSync(this.jsonlPath, "utf-8");
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
  private writeReport(records: PerformanceRecord[]): void {
    if (records.length === 0) {
      return;
    }

    // Group by endpoint and collect service info
    const grouped = new Map<string, { durations: number[]; service: string }>();

    records.forEach((r) => {
      const key = `[${r.service}/${r.protocol}/${r.authType}] ${r.operation}`;
      if (!grouped.has(key)) {
        grouped.set(key, { durations: [], service: r.service });
      }
      grouped.get(key)!.durations.push(r.duration);
    });

    // Calculate stats
    const aggregated = Array.from(grouped.entries()).map(([key, data]) => {
      const { durations, service } = data;
      const count = durations.length;
      const sorted = [...durations].sort((a, b) => a - b);

      const max = sorted[sorted.length - 1];

      // Median (p50)
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

      // p95 Percentile
      const getPercentile = (p: number) => {
        if (count === 0) return 0;
        const index = Math.ceil((p / 100) * count) - 1;
        return sorted[Math.max(0, Math.min(index, count - 1))];
      };

      return {
        key,
        service,
        count,
        max,
        median,
        p95: getPercentile(95),
      };
    });

    // Sort by MAX descending
    aggregated.sort((a, b) => b.max - a.max);

    // Calculate summary for title (Unique endpoints per service)
    const serviceStats = new Map<string, number>();
    aggregated.forEach((item) => {
      const current = serviceStats.get(item.service) || 0;
      serviceStats.set(item.service, current + 1);
    });

    const breakdown = Array.from(serviceStats.entries())
      .map(([svc, count]) => `${svc}: ${count}`)
      .join(" - ");

    // Build report content
    let reportContent = `=== 🚀 Performance Report (${aggregated.length} endpoints | ${breakdown}) ===\n`;
    reportContent += `Sorted by: MAX duration (descending)\n\n`;

    aggregated.forEach((item, i) => {
      if (item.count === 1) {
        reportContent += `${i + 1}. ${item.key}: (1x call) Duration: ${item.max}ms\n`;
      } else {
        reportContent += `${i + 1}. ${item.key}: (${item.count}x calls) Stats: ${item.max}ms (Max) ➔ ${item.p95}ms (p95) ➔ ${item.median}ms (Med)\n`;
      }
    });

    // Write report to TXT file
    writeFileSync(this.reportPath, reportContent, "utf-8");
  }
}

/**
 * Default singleton instance for performance tracking
 * Use this in most cases for consistent tracking across the test suite
 */
export const performanceTracker = new PerformanceTracker();

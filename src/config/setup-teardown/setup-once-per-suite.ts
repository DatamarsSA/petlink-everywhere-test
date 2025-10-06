import { PerformanceTracker } from "../../test-utils/helpers/performance-tracker.js";

export default async function setup() {
  // una volta PRIMA di tutta la run
  console.log("----- INIZIO SUITE (globalSetup) -----");
  PerformanceTracker.cleanJsonl();

  // ritorna la funzione di teardown UNA volta a FINE run
  return async () => {
    console.log("----- FINE SUITE (global teardown) -----");
    PerformanceTracker.generateReportFromJsonl();
    console.log("✅ Aggregated performance report generated\n");
  };
}

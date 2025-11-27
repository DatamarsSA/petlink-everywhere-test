import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { config } from "dotenv";

/**
 * Load environment variables from .env.{environment} file
 */
function loadEnvironmentVariables(): void {
  const environment = process.env.TEST_ENV || "develop";
  console.log(`📦 Loading environment variables from .env.${environment}`);
  config({ path: `.env.${environment}` });
}

loadEnvironmentVariables();

/**
 * Fetch GraphQL schemas from remote endpoints
 * Uses environment variables loaded from .env files
 */
export async function fetchSchemas(): Promise<void> {
  console.log("\n📥 Fetching GraphQL schemas...");

  const SCHEMA_DIR = "src/clients/petlink-infrastructure/endpoints/graphql/schema";
  mkdirSync(SCHEMA_DIR, { recursive: true });

  // Fetch CORE
  console.log("  → Fetching CORE schema...");
  execSync(
    `npx get-graphql-schema -h "X-API-KEY=${process.env.CORE_GRAPHQL_API_KEY}" ${process.env.CORE_GRAPHQL_API_URL} > ${SCHEMA_DIR}/core_schema.graphql`,
    {
      stdio: "inherit",
    },
  );

  // Fetch CCT
  console.log("  → Fetching CCT schema...");
  execSync(
    `npx get-graphql-schema -h "X-API-KEY=${process.env.CCT_GRAPHQL_API_KEY}" ${process.env.CCT_GRAPHQL_API_URL} > ${SCHEMA_DIR}/cct_schema.graphql`,
    {
      stdio: "inherit",
    },
  );

  console.log("✅ Schemas fetched successfully!");
}

/**
 * Generate TypeScript SDK from GraphQL schemas
 */
export async function generateSdk(): Promise<void> {
  console.log("\n🔧 Generating TypeScript SDK...");

  try {
    execSync("npx graphql-codegen", { stdio: "inherit" });
    console.log("✅ SDK generated successfully!");
  } catch (error) {
    console.error("❌ SDK generation failed");
    throw error;
  }
}

(async () => {
  const command = process.argv[2];
  console.log(`\n🚀 Running command: ${command || "default (fetch + generate)"}`);

  switch (command) {
    case "fetch":
      await fetchSchemas();
      break;
    case "generate":
      await generateSdk();
      break;
    default:
      await fetchSchemas();
      await generateSdk();
  }
})();

import { config } from "dotenv";
import { execSync } from "child_process";
import { join, dirname, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// Ottieni il tipo di servizio dal primo argomento della riga di comando
const serviceType = process.argv[2]?.toUpperCase();

// Ottieni l'ambiente dal secondo argomento o dalla variabile d'ambiente
const envArg = process.argv[3];
const environment = envArg || process.env.NODE_ENV || "develop";

// Verifica che il tipo di servizio sia valido
if (!serviceType || (serviceType !== "CCT" && serviceType !== "CORE")) {
  console.error("Usage: node fetchSchema.js <serviceType> [environment]");
  console.error('Where <serviceType> is either "CCT" or "CORE"');
  console.error('And [environment] is optional (default: "develop")');
  process.exit(1);
}

// Carica le variabili d'ambiente dal file .env appropriato
config({ path: `.env.${environment}` });

function getBinFile(cmd: string): string {
  return join("node_modules", ".bin", cmd);
}

function ensureDirExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Usa direttamente le variabili senza il suffisso del branch
const apiKeyVarName = `${serviceType}_GRAPHQL_API_KEY`;
const apiUrlVarName = `${serviceType}_GRAPHQL_API_URL`;

const API_KEY = process.env[apiKeyVarName];
const API_URL = process.env[apiUrlVarName];

if (!API_KEY || !API_URL) {
  console.warn(
    `Environment variables needed to fetch ${serviceType} schema not found. Skipping schema fetch.`,
  );
  console.warn(
    `Missing: ${!API_KEY ? apiKeyVarName : ""} ${!API_URL ? apiUrlVarName : ""}`,
  );
  process.exit(0);
}

const SCHEMA_GRAPHQL_PATH = `./src/clients/petlink-infrastructure/endpoints/graphql/${serviceType.toLowerCase()}_schema.graphql`;

ensureDirExists(dirname(SCHEMA_GRAPHQL_PATH));

console.log(`Fetching ${serviceType} schema from environment: ${environment}`);
console.log(`The file will be saved to: ${SCHEMA_GRAPHQL_PATH}`);

try {
  execSync(
    `${getBinFile("get-graphql-schema")} -h "X-API-KEY=${API_KEY}" ${API_URL} > ${SCHEMA_GRAPHQL_PATH}`,
  );

  console.log("Schema fetched successfully. Applying modifications...");
  let schemaContent = readFileSync(SCHEMA_GRAPHQL_PATH, "utf8");
  writeFileSync(SCHEMA_GRAPHQL_PATH, schemaContent, "utf8");
  console.log(`${serviceType} schema modified successfully!`);
} catch (error) {
  console.error(`Sync ${serviceType} GraphQL schema error: `, error);
}

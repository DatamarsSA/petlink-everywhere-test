import { config } from "dotenv";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

// Ottieni il tipo di servizio dal primo argomento della riga di comando
const serviceType = process.argv[2]?.toUpperCase();

// Ottieni l'ambiente dal secondo argomento o dalla variabile d'ambiente
// const envArg = process.argv[3];
const environment = process.env.TEST_ENV || "develop";

function getBinFile(cmd: string): string {
  return join("node_modules", ".bin", cmd);
}

function ensureDirExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Funzione per eseguire il fetch di un singolo schema
async function fetchSchema(type: string) {
  // Usa direttamente le variabili senza il suffisso del branch
  const apiKeyVarName = `${type}_GRAPHQL_API_KEY`;
  const apiUrlVarName = `${type}_GRAPHQL_API_URL`;

  const API_KEY = process.env[apiKeyVarName];
  const API_URL = process.env[apiUrlVarName];

  if (!API_KEY || !API_URL) {
    console.warn(
      `Environment variables needed to fetch ${type} schema not found. Skipping schema fetch.`,
    );
    console.warn(
      `Missing: ${!API_KEY ? apiKeyVarName : ""} ${!API_URL ? apiUrlVarName : ""}`,
    );
    return;
  }

  const SCHEMA_GRAPHQL_PATH = `./src/clients/petlink-infrastructure/endpoints/graphql/schema/${type.toLowerCase()}_schema.graphql`;

  ensureDirExists(dirname(SCHEMA_GRAPHQL_PATH));

  console.log(`Fetching ${type} schema from environment: ${environment}`);
  console.log(`The file will be saved to: ${SCHEMA_GRAPHQL_PATH}`);

  try {
    execSync(
      `${getBinFile("get-graphql-schema")} -h "X-API-KEY=${API_KEY}" ${API_URL} > ${SCHEMA_GRAPHQL_PATH}`,
    );

    console.log("Schema fetched successfully. Applying modifications...");
    let schemaContent = readFileSync(SCHEMA_GRAPHQL_PATH, "utf8");
    writeFileSync(SCHEMA_GRAPHQL_PATH, schemaContent, "utf8");
    console.log(`${type} schema modified successfully!`);
  } catch (error) {
    console.error(`Sync ${type} GraphQL schema error: `, error);
  }
}

// Carica le variabili d'ambiente dal file .env appropriato
config({ path: `.env.${environment}` });

// Verifica che il tipo di servizio sia valido e procedi
if (!serviceType) {
  console.error("Usage: node fetchSchema.js <serviceType> [environment]");
  console.error('Where <serviceType> is "CCT", "CORE", or "ALL"');
  console.error('And [environment] is optional (default: "develop")');
  process.exit(1);
}

if (serviceType === "ALL") {
  // Fetch entrambi gli schemi
  fetchSchema("CCT");
  fetchSchema("CORE");
} else if (serviceType === "CCT" || serviceType === "CORE") {
  // Fetch di un singolo schema
  fetchSchema(serviceType);
} else {
  console.error('Invalid service type. Must be "CCT", "CORE", or "ALL"');
  process.exit(1);
}

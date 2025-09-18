import { config } from 'dotenv';
import { execSync } from 'child_process';
import { join, dirname, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

config();

function getBinFile(cmd: string): string {
  return join('node_modules', '.bin', cmd);
}

function ensureDirExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function getBranchName(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot: string = resolve(__dirname, '..');
  return execSync('git branch --show-current', {
    cwd: projectRoot,
    encoding: 'utf8',
  })
    .toString()
    .trim();
}

const branchName = getBranchName().toUpperCase();
const apiKeyVarName = `CORE_GRAPHQL_API_KEY_${branchName}`;
const apiUrlVarName = `CORE_GRAPHQL_API_URL_${branchName}`;

const CORE_GRAPHQL_API_KEY = process.env[apiKeyVarName];
const CORE_GRAPHQL_API_URL = process.env[apiUrlVarName];
if (
  !CORE_GRAPHQL_API_KEY ||
  !CORE_GRAPHQL_API_URL
) {
  console.warn(
    'Environment variables needed to fetch Subscriptions Manager not found. Skipping schema fetch.'
  );
  process.exit(0);
}

const SCHEMA_GRAPHQL_PATH = './schema/graphql/core_schema.graphql';

ensureDirExists(dirname(SCHEMA_GRAPHQL_PATH));

console.log(
  'Fetching schema. The file will be saved to the following path:',
  SCHEMA_GRAPHQL_PATH
);
try {
  execSync(
    `${getBinFile('get-graphql-schema')} -h "X-API-KEY=${CORE_GRAPHQL_API_KEY}" ${CORE_GRAPHQL_API_URL} > ${SCHEMA_GRAPHQL_PATH}`
  );

  console.log('Schema fetched successfully. Applying modifications...');
  let schemaContent = readFileSync(SCHEMA_GRAPHQL_PATH, 'utf8');
  writeFileSync(SCHEMA_GRAPHQL_PATH, schemaContent, 'utf8');
  console.log('Schema modified successfully!');
} catch (error) {
  console.error('Sync graphql error: ', error);
}

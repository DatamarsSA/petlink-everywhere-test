// scripts/fetchSchema.ts
import { config } from 'dotenv';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Carica le variabili d'ambiente dal file .env
config();

// Funzione per assicurarsi che la directory esista
function ensureDirExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

// Funzione per scaricare lo schema di un ambiente specifico
function fetchSchema(env: string): boolean {
    const apiKey = process.env[`${env}_API_KEY`];
    const apiUrl = process.env[`${env}_URL`];

    if (!apiKey || !apiUrl) {
        console.error(`Error: ${env}_API_KEY and ${env}_URL must be defined in .env file`);
        return false;
    }

    const schemaPath = `./schema/graphql/${env.toLowerCase()}_schema.graphql`;

    // Assicurati che la directory esista
    ensureDirExists(dirname(schemaPath));

    console.log(`Fetching GraphQL schema for ${env} from ${apiUrl}...`);
    try {
        // Esegui il comando get-graphql-schema
        execSync(
            `npx get-graphql-schema -h "X-API-KEY=${apiKey}" ${apiUrl} > ${schemaPath}`,
            { stdio: 'inherit' }
        );

        console.log(`Schema for ${env} successfully downloaded to ${schemaPath}\n`);

        return true;
    } catch (error) {
        console.error(`Error fetching GraphQL schema for ${env}:`, error instanceof Error ? error.message : String(error));
        return false;
    }
}

// Determina quale schema scaricare in base agli argomenti della riga di comando
const args = process.argv.slice(2);
const env = args[0]?.toUpperCase();

if (env === 'CORE' || env === 'CCT') {
    // Scarica lo schema per l'ambiente specificato
    fetchSchema(env);
} else if (!env) {
    // Se non è specificato un ambiente, prova a scaricare entrambi
    console.log('No environment specified, trying to fetch schemas for both CORE and CCT...');
    const coreSuccess = fetchSchema('CORE');
    const cctSuccess = fetchSchema('CCT');

    if (!coreSuccess && !cctSuccess) {
        console.error('Failed to fetch any schema. Please check your .env file and API credentials.');
        process.exit(1);
    }
} else {
    console.error('Invalid environment. Use "CORE" or "CCT".');
    process.exit(1);
}

// Con questa configurazione, puoi:
//
// Eseguire npm run fetch:schema per scaricare entrambi gli schemi (se possibile)
// Eseguire npm run fetch:core-schema per scaricare solo lo schema CORE
// Eseguire npm run fetch:cct-schema per scaricare solo lo schema CCT
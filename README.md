# Infrastructure Client - Pattern Standard Vitest

Sistema di testing API con gestione multi-ambiente usando il pattern standard di Vitest/Vite.

## 🚀 Setup Rapido

1. **Copia il template per il tuo ambiente:**
   ```bash
   cp env.example .env.develop.develop  # Per sviluppo
   cp env.example .env.develop.test     # Per test
   cp env.example .env.develop.prod     # Per produzione
   ```

2. **Compila le variabili nel file `.env.[ambiente]`**

3. **Esegui i test per l'ambiente desiderato:**
   ```bash
   npm run test:develop    # Watch mode per develop
   npm run test:test       # Watch mode per test  
   npm run test:prod       # Watch mode per prod
   
   # O single run:
   npm run test:develop:run
   npm run test:test:run
   npm run test:prod:run
   ```

## 📋 Variabili d'Ambiente Richieste

Tutte le variabili sono definite in `env.example`:

```env
# CORE API (User Backend)
CORE_GRAPHQL_API_URL=https://your-core-endpoint.com/graphql
CORE_GRAPHQL_API_KEY=your-core-api-key

# CCT API (Support Backend)
CCT_GRAPHQL_API_URL=https://your-cct-endpoint.com/graphql
CCT_GRAPHQL_API_KEY=your-cct-api-key

# AWS Cognito Authentication
COGNITO_REGION=eu-west-1
COGNITO_CLIENT_ID=your-client-id
COGNITO_USERNAME=your-username
COGNITO_PASSWORD=your-password
```

## 🔧 Come Funziona

### Pattern Standard Vitest

Il sistema usa il **pattern ufficiale di Vite/Vitest** per la gestione degli ambienti:

1. **`vitest.config.ts`** - Usa `loadEnv()` per caricare `.env.[mode]`
2. **`setupFiles`** - Valida automaticamente TUTTE le variabili prima dei test
3. **Mode-based env files** - `.env.develop`, `.env.test`, `.env.prod`

### Flusso di Esecuzione

```
npm run test:develop
    ↓
Vitest carica .env.develop (tramite --mode develop)
    ↓
setupFiles → test-setup.ts valida contro env.example
    ↓
Se OK → Test partono
Se KO → Errore immediato con lista variabili mancanti
```

### Validazione Automatica

Il sistema:
1. Legge `env.example` per ottenere la lista delle variabili richieste
2. Verifica che TUTTE siano presenti nell'ambiente corrente
3. Se manca anche una sola variabile → **FAIL IMMEDIATO**

## 💻 Uso nei Test

```typescript
import { Infrastructure } from '../clients/client.js';

describe('My API Tests', () => {
  beforeAll(async () => {
    // Connetti ai servizi (environment già validato)
    await Infrastructure.connect();
  });

  afterAll(() => {
    Infrastructure.disconnect();
  });

  it('test CORE API', async () => {
    const result = await Infrastructure.core.sdk.getUser();
    expect(result).toBeDefined();
  });

  it('test CCT API', async () => {
    const result = await Infrastructure.cct.sdk.someEndpoint();
    expect(result).toBeDefined();
  });
});
```

## 🎯 Vantaggi di Questo Approccio

✅ **Standard Vitest/Vite** - Segue le best practices ufficiali  
✅ **Multi-ambiente pulito** - Un file `.env` per ambiente, niente suffissi  
✅ **Validazione automatica** - Controlla env.example prima di ogni test  
✅ **Fail-fast** - Se manca una variabile, nessun test parte  
✅ **Zero configurazione** - Tutto gestito da Vitest  
✅ **Facile da mantenere** - Aggiungi variabili solo in env.example

## 📁 Struttura File

```
petlink-everywhere-test/
├── env.example           # Template con TUTTE le variabili richieste
├── .env.develop         # Variabili per ambiente develop (ignorato da git)
├── .env.test           # Variabili per ambiente test (ignorato da git)
├── .env.prod           # Variabili per ambiente prod (ignorato da git)
├── vitest.config.ts    # Configurazione con loadEnv()
├── src/
│   ├── test-setup.ts   # Validazione automatica pre-test
│   └── clients/
│       └── client.ts   # Infrastructure client semplificato
```

## 🔍 Debug

Se i test non partono:

1. **Controlla il messaggio di errore** - Lista esatta delle variabili mancanti
2. **Verifica il file `.env.[mode]`** - Deve esistere per il mode usato
3. **Confronta con `env.example`** - Tutte le variabili devono essere presenti
4. **Controlla il mode** - `--mode develop` cerca `.env.develop`

## 🚨 Note Importanti

- **NESSUN default hardcoded** - Tutte le variabili devono essere esplicite
- **Validazione STRICT** - Se manca una variabile, TUTTO si ferma
- **File `.env` ignorati da Git** - Non committare credenziali!
- **Un ambiente alla volta** - Ogni esecuzione usa UN SOLO file `.env.[mode]`
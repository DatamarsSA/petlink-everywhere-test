# Piano: Test di Integrazione GraphQL — Journal

## 1. Stato attuale

- **Schema GraphQL journal già presente** in `src/clients/petlink-infrastructure/endpoints/graphql/schema/core_schema.graphql`
- **Operazioni GraphQL mancanti**: `core_ops.graphql` non contiene ancora query/mutation per il journal, quindi il **SDK TypeScript generato non espone metodi journal**
- **Struttura test esistente**: `src/tests/<dominio>/<feature>.test.ts` (es. `src/tests/entities/entity-pet.test.ts`)
- **Pattern usato**: vitest, `testHelper.cleanupAll()` / `setupBuilder()`, chiamate via `petlink.core.graphqlHttp.authJwt.*`, assert su `code === "200"` con messaggi descrittivi

---

## 2. Step di implementazione

### Step 1 — Aggiungere operazioni GraphQL in `core_ops.graphql`

Aggiungere nel file `src/clients/petlink-infrastructure/endpoints/graphql/operations/core_ops.graphql` le seguenti operazioni (coerenti con lo schema):

```graphql
# ======================== JOURNAL ========================

# --- Query ---
query getJournalEventTypes($petId: String!) {
  getJournalEventTypes(petId: $petId) {
    code
    message
    eventTypes {
      id
      entityType
      creationDate
      updateDate
      eventType
      points
      translationKey
      sentimentType
      name
      userId
      icon
    }
  }
}

query getJournalEntry($journalId: String!) {
  getJournalEntry(journalId: $journalId) {
    code
    message
    journalEntry {
      id
      entityType
      creationDate
      updateDate
      userId
      petId
      connection { id eventType points translationKey sentimentType name icon }
      connectionPoints
      behaviour { id eventType points translationKey sentimentType name icon }
      behaviourPoints
      routineCheck { id eventType points translationKey sentimentType name icon }
      routineCheckPoints
      mood { id eventType points translationKey sentimentType name icon }
      moodPoints
      totalPoints
      note
    }
    notifications { type translationKey }
  }
}

query getJournalEntries($input: GetJournalEntriesInput!) {
  getJournalEntries(input: $input) {
    code
    message
    entries {
      id
      entityType
      creationDate
      updateDate
      userId
      petId
      connection { id eventType points translationKey sentimentType name icon }
      connectionPoints
      behaviour { id eventType points translationKey sentimentType name icon }
      behaviourPoints
      routineCheck { id eventType points translationKey sentimentType name icon }
      routineCheckPoints
      mood { id eventType points translationKey sentimentType name icon }
      moodPoints
      totalPoints
      note
    }
  }
}

# --- Mutation ---
mutation addJournalEventType($input: AddJournalEventTypeInput!) {
  addJournalEventType(input: $input) {
    code
    message
    eventTypes {
      id
      entityType
      creationDate
      updateDate
      eventType
      points
      translationKey
      sentimentType
      name
      userId
      icon
    }
  }
}

mutation deleteJournalEventType($input: DeleteJournalEventTypeInput!) {
  deleteJournalEventType(input: $input) {
    code
    message
  }
}

mutation addJournalEntry($input: AddJournalEntryInput!) {
  addJournalEntry(input: $input) {
    code
    message
    journalEntry {
      id
      entityType
      creationDate
      updateDate
      userId
      petId
      connection { id eventType points translationKey sentimentType name icon }
      connectionPoints
      behaviour { id eventType points translationKey sentimentType name icon }
      behaviourPoints
      routineCheck { id eventType points translationKey sentimentType name icon }
      routineCheckPoints
      mood { id eventType points translationKey sentimentType name icon }
      moodPoints
      totalPoints
      note
    }
    notifications { type translationKey }
  }
}
```

### Step 2 — Rigenerare il SDK

```bash
yarn generate-sdk
```

Questo aggiornerà:
- `src/clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.ts`
- Esporrà i nuovi metodi su `petlink.core.graphqlHttp.authJwt` (es. `getJournalEventTypes`, `addJournalEntry`, ...)

### Step 3 — Creare il file di test

**Percorso**: `src/tests/journal/journal.test.ts`

Mantenere la stessa struttura degli altri test:
- `import { beforeAll, describe, expect, it } from "vitest"`
- Usare `testHelper.cleanupAll()` nel `beforeAll`
- Usare `testHelper.setupBuilder()` per creare user + pet
- Chiamate via `petlink.core.graphqlHttp.authJwt.*`
- Assert su `.code` con template string descrittivi (come in `entity-pet.test.ts`)

### Step 4 — Scenari di test da implementare

#### A. Journal Event Types

| # | Test | Note |
|---|------|------|
| A1 | `getJournalEventTypes` restituisce i tipi di default per un pet | Verificare `code === "200"` e array `eventTypes` non vuoto |
| A2 | `addJournalEventType` crea un event type custom | Usare `JournalEventTypeEnum.CONNECTION` (o BEHAVIOURS/ROUTINE_CHECK/MOOD), `EventSentimentEnum.NEUTRAL` |
| A3 | Dopo la creazione, `getJournalEventTypes` include il nuovo custom type | Verificare presenza per `name` o `id` |
| A4 | `deleteJournalEventType` rimuove il custom type | Verificare `code === "200"` |
| A5 | Dopo la delete, il custom type non è più presente in `getJournalEventTypes` | Verificare assenza |

#### B. Journal Entries

| # | Test | Note |
|---|------|------|
| B1 | `addJournalEntry` crea un entry con dati validi | Prendere IDs da `getJournalEventTypes` (mood, connection, behaviour, routineCheck) |
| B2 | La risposta di `addJournalEntry` contiene `journalEntry` con punteggi calcolati | Verificare `totalPoints`, `moodPoints`, `connectionPoints`, ecc. |
| B3 | `getJournalEntry` restituisce l'entry creata per ID | Match con i dati inviati in B1 |
| B4 | `getJournalEntries` restituisce l'entry nel range di date | `from` e `to` devono includere la data di creazione |
| B5 | `addJournalEntry` senza `note` funziona ugualmente (`note` è opzionale) | Verificare `code === "200"` |
| B6 | `getJournalEntries` con range che NON include la data restituisce array vuoto | Edge case sul filtro temporale |

#### C. Errori / Validazioni

| # | Test | Note |
|---|------|------|
| C1 | `addJournalEntry` con `petId` inesistente → errore (`code !== "200"`) | Verificare gestione errore |
| C2 | `addJournalEntry` con `moodId` / `connectionIds` / `behaviourIds` / `routineCheckIds` inesistenti → errore | Verificare validazione |
| C3 | `getJournalEntry` con `journalId` inesistente → errore | Verificare `code !== "200"` |

### Step 5 — Struttura del file test (esempio)

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import {
  EventSentimentEnum,
  JournalEventTypeEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../fixtures/fixtures.js";
import { testHelper } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Journal", () => {
  describe("Event Types", () => {
    let testPetId: string;
    let customEventTypeId: string;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      const setup = await testHelper.setupBuilder().withUser().withDog().build();
      testPetId = setup.dog!.id;
    });

    it("Should get default journal event types for a pet", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.getJournalEventTypes({ petId: testPetId });
      expect(
        res.getJournalEventTypes.code,
        `getJournalEventTypes should succeed - Error: ${res.getJournalEventTypes.message}`,
      ).toBe("200");
      expect(res.getJournalEventTypes.eventTypes?.length).toBeGreaterThan(0);
    });

    it("Should add a custom journal event type", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.addJournalEventType({
        input: {
          petId: testPetId,
          eventType: JournalEventTypeEnum.Behaviours,
          name: "CustomBehaviourTest",
          sentimentType: EventSentimentEnum.Positive,
        },
      });
      expect(
        res.addJournalEventTypes.code,
        `addJournalEventTypes should succeed - Error: ${res.addJournalEventTypes.message}`,
      ).toBe("200");
      customEventTypeId = res.addJournalEventTypes.eventTypes!.find(
        (et) => et.name === "CustomBehaviourTest",
      )!.id;
    });

    // ... altri test
  });

  describe("Entries", () => {
    // setup simile, creazione entry, query, asserts su points e date range
  });
});
```

---

## 3. Dipendenze / Verifiche da fare

1. **Backend journal attivo**: Confermare che le mutation/query journal siano deployate nell'ambiente di test prima di generare il SDK
2. **Punti event types di default**: Verificare quali `id` di default esistono per `MOOD`, `CONNECTION`, `BEHAVIOURS`, `ROUTINE_CHECK` — nel test si useranno quelli restituiti da `getJournalEventTypes`
3. **Date format**: Lo schema usa `String` per `from`/`to` in `GetJournalEntriesInput` — verificare il formato atteso (ISO 8601? `YYYY-MM-DD`?)
4. **Cleanup**: Valutare se servire un `utilityIntegrationTest` specifico per cancellare journal entries (altrimenti il `cleanupAll` sullo user dovrebbe essere sufficiente)

---

## 4. Riepilogo deliverables

| File | Azione |
|------|--------|
| `src/clients/petlink-infrastructure/endpoints/graphql/operations/core_ops.graphql` | Aggiungere 6 operazioni journal |
| `src/clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.ts` | Rigenerare via `yarn generate-sdk` |
| `src/tests/journal/journal.test.ts` | Creare nuovo file test |
| `src/fixtures/fixtures.ts` | *Opzionale*: aggiungere fixture journal se servono costanti riusabili |

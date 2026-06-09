# Journal Flow

## Overview

The Journal is a **daily pet wellness tracker**. The user records observations about their pet across four categories: **Mood**, **Connection**, **Behaviours**, and **Routine Check**. Each observation is mapped to a pre-defined *Event Type* that carries a point value. The backend aggregates the points into per-category scores and a daily total.

Users can also create **custom event types** per pet to extend the default catalogue.

---

## Complete User Journey

### STEP 1: APP LOADS JOURNAL EVENT TYPES

**User Action**: Opens the journal screen for a pet.

```
User: "I want to check today's journal"
  ↓
App calls: getJournalEventTypes(petId)
  ↓
Backend returns: list of default + custom event types for that pet
  ↓
App displays: categories (MOOD, CONNECTION, BEHAVIOURS, ROUTINE_CHECK)
  ↓
✅ Event types loaded
```

**API**: `getJournalEventTypes(petId: String!)`
- **Auth**: JWT required
- **Response**: `ResponseJournalEventTypes { code, message, eventTypes[] }`

**Event Type Structure**:
```typescript
type JournalEventType {
  id: String!
  entityType: JournalEntityTypeEnum!   // JOURNAL_EVENT_TYPE | JOURNAL_CUSTOM_EVENT_TYPE
  creationDate: String!
  updateDate: String!
  eventType: JournalEventTypeEnum!     // CONNECTION | BEHAVIOURS | ROUTINE_CHECK | MOOD
  points: Int!
  translationKey: String
  sentimentType: EventSentimentEnum!    // POSITIVE | NEGATIVE | NEUTRAL
  name: String                         // null for default types, populated for custom
  userId: String
  icon: String
}
```

---

### STEP 2: USER FILLS A JOURNAL ENTRY

**User Action**: Selects observations for each category and optionally adds a note.

```
User: "Recording today's observations"
  ↓
App shows form:
  ├─ Mood (required, exactly 1)
  │   └─ User selects: "Happy" (+2 points)
  ├─ Connection (optional, 1..N)
  │   └─ User selects: "Cuddle time" (+1)
  ├─ Behaviours (optional, 1..N)
  │   └─ User selects: "Eating less" (-1)
  ├─ Routine Check (optional, 1..N)
  │   └─ User selects: "Eyes good" (+1)
  └─ Note (optional, free text)
      └─ User types: "Played a lot in the park"
  ↓
✅ Entry ready for submission
```

**Input Structure**:
```typescript
input AddJournalEntryInput {
  petId: String!
  moodId: String!           // single event type id
  connectionIds: [String!]! // array of event type ids
  behaviourIds: [String!]!  // array of event type ids
  routineCheckIds: [String!]! // array of event type ids
  note: String              // optional
}
```

**Validation Rules**:
- **moodId**: required, must reference a valid `MOOD` event type
- **connectionIds**: optional array, each id must reference a valid `CONNECTION` event type
- **behaviourIds**: optional array, each id must reference a valid `BEHAVIOURS` event type
- **routineCheckIds**: optional array, each id must reference a valid `ROUTINE_CHECK` event type
- **note**: optional string
- **petId**: must reference an existing pet owned by the user

---

### STEP 3: USER SUBMITS JOURNAL ENTRY

**User Action**: Taps "Save Entry".

```
User: "Saving the journal entry"
  ↓
App calls: addJournalEntry({
  petId,
  moodId,
  connectionIds,
  behaviourIds,
  routineCheckIds,
  note
})
  ↓
Backend (AppSync):
  ├─ Authorizer verifies JWT token
  ├─ Extracts userId from JWT
  └─ Calls addJournalEntry handler
  ↓
✅ Request sent to backend
```

**API**: `addJournalEntry(input: AddJournalEntryInput!)`
- **Auth**: JWT required
- **Response**: `ResponseJournalEntry { code, message, journalEntry, notifications[] }`

---

### STEP 4: BACKEND VALIDATES & CALCULATES POINTS

**Backend Processing**: Validates ownership, event type existence, and computes scores.

```
Backend:
  ├─ Verifies JWT token and extracts userId
  ├─ Checks: User exists and owns the pet
  ├─ Validates moodId:
  │  └─ Exists and belongs to the pet?
  │     └─ No → Returns error
  ├─ Validates each connectionIds:
  │  └─ Exists and is CONNECTION type?
  │     └─ No → Returns error
  ├─ Validates each behaviourIds:
  │  └─ Exists and is BEHAVIOURS type?
  │     └─ No → Returns error
  ├─ Validates each routineCheckIds:
  │  └─ Exists and is ROUTINE_CHECK type?
  │     └─ No → Returns error
  ├─ All validations pass → Compute points
  │  ├─ moodPoints = sum of selected mood points
  │  ├─ connectionPoints = sum of selected connection points
  │  ├─ behaviourPoints = sum of selected behaviour points
  │  ├─ routineCheckPoints = sum of selected routine check points
  │  └─ totalPoints = moodPoints + connectionPoints + behaviourPoints + routineCheckPoints
  └─ Proceed to creation
  ↓
✅ Validation & scoring complete
```

---

### STEP 5: BACKEND CREATES JOURNAL DOCUMENT

**Backend Processing**: Stores the entry in MongoDB.

```
Backend:
  ├─ Generates entryId (UUID)
  ├─ Creates JournalEntry document:
  │  ├─ id: entryId
  │  ├─ userId: logged-in user
  │  ├─ petId: petId from input
  │  ├─ mood: resolved JournalEventType object
  │  ├─ moodPoints: calculated sum
  │  ├─ connection: array of resolved JournalEventType objects
  │  ├─ connectionPoints: calculated sum
  │  ├─ behaviour: array of resolved JournalEventType objects
  │  ├─ behaviourPoints: calculated sum
  │  ├─ routineCheck: array of resolved JournalEventType objects
  │  ├─ routineCheckPoints: calculated sum
  │  ├─ totalPoints: sum of all category points
  │  ├─ note: note from input (or empty string)
  │  ├─ entityType: "JOURNAL_ENTRY"
  │  ├─ creationDate: now (ISO 8601)
  │  └─ updateDate: now (ISO 8601)
  └─ Returns journal entry with all resolved fields
  ↓
✅ Entry created successfully
```

**Journal Entry Document Structure**:
```typescript
type JournalEntry {
  id: String!
  entityType: JournalEntityTypeEnum!   // JOURNAL_ENTRY
  creationDate: String!
  updateDate: String!
  userId: String!
  petId: String!
  connection: [JournalEventType!]!
  connectionPoints: Int!
  behaviour: [JournalEventType!]!
  behaviourPoints: Int!
  routineCheck: [JournalEventType!]!
  routineCheckPoints: Int!
  mood: JournalEventType!
  moodPoints: Int!
  totalPoints: Int!
  note: String
}
```

---

### STEP 6: APP RECEIVES ENTRY & UPDATES UI

**App Processing**: Displays the saved entry and scores.

```
App receives: JournalEntry
  ├─ Shows total points and breakdown per category
  ├─ Displays selected event types with icons / labels
  ├─ Shows note if present
  └─ Updates journal list / calendar
  ↓
✅ Entry visible in app
```

---

### STEP 7: USER RETRIEVES PAST ENTRIES

**User Action**: Views journal history by date range or opens a specific entry.

```
User: "What did I record last week?"
  ↓
App calls one of:
  ├─ getJournalEntry(journalId)        // single entry
  └─ getJournalEntries({ petId, from, to }) // date range
  ↓
Backend returns: entries ordered by creation date
  ↓
App renders: list / detail view
  ↓
✅ History loaded
```

**APIs**:
- `getJournalEntry(journalId: String!)` → `ResponseJournalEntry`
- `getJournalEntries(input: GetJournalEntriesInput!)` → `ResponseJournalEntries`

**GetJournalEntriesInput**:
```typescript
input GetJournalEntriesInput {
  petId: String!
  from: String!   // ISO 8601
  to: String!     // ISO 8601
}
```

---

## Data Flow: App → Backend → Database

```
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ User selects mood / connection / behaviour /      │
│ routine check and optionally adds a note            │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ GraphQL Mutation: addJournalEntry                   │
│ Input: AddJournalEntryInput {                       │
│   petId, moodId, connectionIds, behaviourIds,       │
│   routineCheckIds, note                             │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ AppSync Authorizer                                  │
│ - Verifies JWT signature                            │
│ - Extracts userId from JWT claims                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ addJournalEntry Handler (Lambda)                    │
│ - Validates user owns the pet                       │
│ - Validates all event type ids exist and match      │
│   their declared category (MOOD, CONNECTION, ...)     │
│ - Computes per-category points and total points       │
│ - Creates JournalEntry document                       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ MongoDB (Journal Collection)                        │
│ - Inserts JournalEntry document                     │
│ - References JournalEventType documents by id       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Response to App                                     │
│ { code: "200", journalEntry: { ... },               │
│   notifications: [...] }                             │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ - Displays total points and category breakdown      │
│ - Updates journal list / calendar                   │
└─────────────────────────────────────────────────────┘
```

---

## Key Behaviors

### Points Calculation
- Each selected event type contributes its `points` value to its category.
- `moodPoints` = points of the single selected mood.
- `connectionPoints` = sum of points of selected connection events.
- `behaviourPoints` = sum of points of selected behaviour events.
- `routineCheckPoints` = sum of points of selected routine check events.
- `totalPoints` = `moodPoints + connectionPoints + behaviourPoints + routineCheckPoints`.

### Default vs Custom Event Types
- **Default**: seeded by the system per pet, have `name: null`, `entityType: JOURNAL_EVENT_TYPE`, fixed `points` and `translationKey`.
- **Custom**: created by the user via `addJournalEventType`, have `name` populated, `entityType: JOURNAL_CUSTOM_EVENT_TYPE`, and belong to one of the four `eventType` categories.

### Custom Event Type Lifecycle
```
User: "I want a custom behaviour type"
  ↓
addJournalEventType({ petId, eventType, name, sentimentType })
  ↓
Type appears in getJournalEventTypes for that pet
  ↓
Can be used in addJournalEntry
  ↓
deleteJournalEventType({ id }) removes it
```

### Entry Retrieval
- `getJournalEntry` returns a single entry by id with all resolved event types.
- `getJournalEntries` returns an array filtered by `petId` and a date range (`from` inclusive, `to` inclusive).
- Entries are returned with full `JournalEventType` objects, not just ids.

---

## Related Operations

### After Creating an Entry
- **getJournalEntry**: Retrieve a single entry by id.
- **getJournalEntries**: Retrieve all entries for a pet in a date range.

### Managing Event Types
- **addJournalEventType**: Create a custom event type for a pet.
- **deleteJournalEventType**: Remove a custom event type (default types cannot be deleted).
- **getJournalEventTypes**: List all available types for a pet (default + custom).

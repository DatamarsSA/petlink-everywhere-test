# Pet Registration Flow

## Overview

Pet registration is a **straightforward flow** where the user creates a pet profile after being authenticated. The pet is associated with the logged-in user.

---

## Complete User Journey

### STEP 1: USER SELECTS PET SPECIES & BREED TYPE

**User Action**: Chooses species (Dog/Cat) and breed type (Purebreed/Mixed)

```
User: "I want to add a pet"
  ↓
App displays: Species selector (Dog, Cat, Other)
  ↓
User selects: Dog
  ↓
App displays: Breed type selector (Purebreed, Mixed Breed)
  ↓
User selects: Purebreed
  ↓
✅ Species and breed type selected
```

**Validation Rules**:
- **Purebreed**: Must have exactly 1 breed
- **Mixed Breed**: Must have exactly 2 different breeds
- **Species-Breed Match**: Dog breeds only for dogs, cat breeds only for cats

---

### STEP 2: USER FILLS PET DETAILS

**User Action**: Enters name, gender, weight, birth date, color, living environment

```
User: "Entering pet information"
  ↓
App shows form with fields:
  ├─ Name (required, max 50 chars)
  ├─ Gender (required: Male/Female/Unknown)
  ├─ Birth Date (optional, must be in past)
  ├─ Weight (optional, in grams)
  ├─ Primary Color (optional)
  ├─ Living Environment (optional: Indoor/Outdoor/Both)
  └─ Photo (optional, uploaded to S3)
  ↓
User fills all fields
  ↓
✅ Pet details ready for submission
```

**Field Details**:
- **Name**: String, max 50 characters
- **Gender**: Enum (Male, Female, Unknown)
- **Birth Date**: ISO 8601 datetime, must be in the past
- **Weight**: Number in grams (converted to kg in database)
- **Primary Color**: UUID reference to color document
- **Living Environment**: Enum (Indoor, Outdoor, Both)
- **Photo**: Image ID (uploaded separately to S3)

---

### STEP 3: USER SUBMITS PET CREATION

**User Action**: Clicks "Create Pet" button

```
User: "Creating the pet"
  ↓
App calls: createPet({
  name, species, breedType, breeds, gender,
  weight, birthDate, primaryColor, livingEnvironment, imageId
})
  ↓
Backend (AppSync):
  ├─ Authorizer verifies JWT token
  ├─ Extracts userId from JWT
  └─ Calls createPet handler
  ↓
✅ Request sent to backend
```

**API**: `createPet(pet: PetIn!)`
- **Auth**: JWT required (user must be authenticated)
- **Response**: `{ code: "200"|"400"|"401"|"403"|"404", pet, message }`

---

### STEP 4: BACKEND VALIDATES PET DATA

**Backend Processing**: Validates all fields and breed/color consistency

```
Backend:
  ├─ Verifies JWT token and extracts userId
  ├─ Checks: User exists and is not deleted
  ├─ Checks: User is not a demo user (demo users cannot create pets)
  ├─ Validates PetIn schema:
  │  ├─ Name: required, max 50 chars
  │  ├─ Species: required (Dog, Cat, Other)
  │  ├─ Breed Type: required (Purebreed, Mixed Breed)
  │  ├─ Breeds: required array
  │  ├─ Gender: required (Male, Female, Unknown)
  │  ├─ Birth Date: optional, must be in past
  │  ├─ Weight: optional, number
  │  ├─ Primary Color: optional, string UUID
  │  └─ Living Environment: optional
  ├─ If species != OTHER:
  │  ├─ Queries breed collection: Are all breed IDs valid?
  │  ├─ Checks: Do all breeds match the species?
  │  ├─ Validates breed type rules:
  │  │  ├─ PUREBREED: Must have exactly 1 breed
  │  │  └─ MIXED_BREED: Must have exactly 2 different breeds
  │  └─ If invalid → Returns 400 (invalid_breeds)
  ├─ If primary color provided:
  │  ├─ Queries color collection: Is color ID valid?
  │  └─ If invalid → Returns 400 (invalid_color)
  ├─ If image provided:
  │  ├─ Assigns image to pet (links image entity to pet)
  │  └─ If fails → Returns error
  └─ All validations pass → Proceed to creation
  ↓
✅ All validations passed
```

**Validation Errors**:
- **400 (Bad Request)**: Invalid schema, invalid breeds, invalid color, breed/species mismatch
- **401 (Unauthorized)**: JWT invalid or missing
- **403 (Forbidden)**: Demo user trying to create pet
- **404 (Not Found)**: User not found or deleted

---

### STEP 5: BACKEND CREATES PET DOCUMENT

**Backend Processing**: Creates pet in MongoDB and generates history events

```
Backend:
  ├─ Generates petId (UUID)
  ├─ Converts weight: grams → kg (divide by 1000)
  ├─ Creates Pet document in MongoDB:
  │  ├─ id: petId (UUID)
  │  ├─ userId: logged-in user ID
  │  ├─ name, species, breedType, breeds
  │  ├─ gender, weight (in kg), birthDate
  │  ├─ primaryColor, livingEnvironment
  │  ├─ image: { id: imageId } (if provided)
  │  ├─ entityType: "PET"
  │  ├─ hidden: false
  │  ├─ creationDate: now (ISO 8601)
  │  └─ updateDate: now (ISO 8601)
  ├─ Creates history events:
  │  ├─ Event 1: PET_PROFILE_CREATED (now)
  │  └─ Event 2: PET_BORN (if birthDate provided)
  └─ Returns pet document with:
     ├─ All fields from input
     ├─ weight converted back: kg → grams (multiply by 1000)
     ├─ Auto-generated: id, creationDate, updateDate
     └─ Image: { id, url } (if provided)
  ↓
✅ Pet created successfully
```

**Pet Document Structure**:
```typescript
{
  id: string;                    // UUID (auto-generated)
  userId: string;                // Associated user
  name: string;                  // Pet name
  species: string;               // Dog, Cat, Other
  breedType: string;             // Purebreed, Mixed Breed
  breeds: string[];              // Array of breed UUIDs
  gender: string;                // Male, Female, Unknown
  weight?: number;               // In kg (stored), grams (returned)
  birthDate?: string;            // ISO 8601 datetime
  primaryColor?: string;         // Color UUID
  livingEnvironment?: string;    // Indoor, Outdoor, Both
  image?: { id: string; url?: string };
  hidden: boolean;               // false by default
  entityType: "PET";
  creationDate: string;          // ISO 8601
  updateDate: string;            // ISO 8601
}
```

---

### STEP 6: APP RECEIVES PET & UPDATES UI

**App Processing**: Stores pet in local state and updates UI

```
App receives: Pet document
  ├─ Adds pet to pets list
  ├─ Creates empty products list for pet
  ├─ If first pet: Sets as selected pet
  ├─ Updates UI: Shows new pet in list
  └─ Navigates back to pet list
  ↓
✅ Pet visible in app
```

---



## Data Flow: App → Backend → Database

```
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ User fills pet form and clicks "Create Pet"        │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ GraphQL Mutation: createPet                         │
│ Input: PetIn {                                      │
│   name, species, breedType, breeds,                │
│   gender, weight, birthDate, primaryColor,         │
│   livingEnvironment, imageId                       │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ AppSync Authorizer                                  │
│ - Verifies JWT signature                           │
│ - Extracts userId from JWT claims                  │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ createPet Handler (Lambda)                          │
│ - Validates user exists and is not demo            │
│ - Validates PetIn schema                           │
│ - Validates breed/species matching                 │
│ - Validates color existence                        │
│ - Calls createPetlinkPet()                         │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ MongoDB (Petlink Collection)                        │
│ - Inserts Pet document                             │
│ - Creates PET_PROFILE_CREATED history event        │
│ - Creates PET_BORN history event (if birthDate)    │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Response to App                                     │
│ { code: "200", pet: { ... }, message: "Success" }  │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ - Adds pet to local pets list                      │
│ - Updates UI with new pet                          │
│ - Navigates back to pet list                       │
└─────────────────────────────────────────────────────┘
```

---

## Key Behaviors

### Pet Ownership
- Each pet is associated with exactly one user (userId)
- User can have multiple pets
- Pet cannot be transferred to another user

### Pet Visibility
- By default, pets are visible (`hidden: false`)
- Pets can be marked as lost (creates LostInfo document)
- Deleted pets are soft-deleted (not removed from database)

### Pet History
- Every pet creation generates a history event
- If birth date is provided, an additional "PET_BORN" event is created
- History events are immutable and used for audit trails

---

## Related Operations

### After Pet Creation
Once a pet is created, users can:
- **Update Pet**: Modify pet details (name, weight, color, etc.)
- **Delete Pet**: Remove pet (only if no devices associated)
- **Add Device**: Register a GPS device for the pet
- **Add Microchip**: Register a microchip for the pet
- **View History**: See pet history events

---

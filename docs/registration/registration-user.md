# User Registration Flow

## Overview

User registration is a **mandatory sequential flow** where the user verifies phone ownership via OTP and email ownership via confirmation link. Both contacts must be verified before the account is fully active.

The flow involves **3 main phases**:
1. **Phone Verification** (OTP via SMS)
2. **Account Creation** (User data + Email verification)
3. **Authentication** (JWT token from Cognito)

---

## Complete User Journey

### STEP 1: USER ENTERS PHONE → CHECK AVAILABILITY

**User Action**: Enters phone number in the app

```
User: "I want to register with my phone number"
  ↓
App calls: checkContact(phone, ContactType.Phone)
  ↓
Backend:
  ├─ Queries MongoDB: Is this phone already registered?
  ├─ If YES → Returns 400 (phone unavailable)
  └─ If NO → Returns 200 (phone available)
  ↓
✅ Phone is available, user can proceed
```

**API**: `checkContact(contact, contactType)`
- **Auth**: Public (no JWT required)
- **Response**: `{ code: "200"|"400", message, translationCode }`

---

### STEP 2: USER CLICKS "SEND CODE" → OTP GENERATION & SMS

**User Action**: Clicks button to receive OTP via SMS

```
User: "Send me the verification code"
  ↓
App calls: sendOtp(phone, languageId)
  ↓
Backend:
  ├─ Generates random OTP (5 digits)
  ├─ Saves to DynamoDB (OTP_TABLE):
  │  ├─ id: verificationId (UUID)
  │  ├─ contact: phone
  │  ├─ otp: "12345"
  │  ├─ creation_at: now
  │  ├─ expires_at: now + 10 minutes
  │  ├─ resend_at: now + 60 seconds (cooldown)
  │  ├─ verification: false (not verified yet)
  │  └─ valid: true
  ├─ Sends SMS via Twilio (async via SQS queue)
  │  └─ Message: "Your verification code is: 12345"
  └─ Returns verificationId to app
  ↓
User receives SMS: "Your verification code is: 12345"
```

**API**: `sendOtp(phone, languageId?)`
- **Auth**: Public
- **Response**: `{ code: "200"|"422", verificationId, resendAt, message }`
- **Error 422**: OTP resend too soon (must wait 60 seconds)

**Storage**:
- **Where**: DynamoDB (OTP_TABLE) - temporary storage
- **Expiration**: 10 minutes (EXPIRES_IN env var)
- **Resend cooldown**: 60 seconds (RESEND_IN env var)

---

### STEP 3: USER ENTERS OTP → VERIFY OTP

**User Action**: Enters the 5-digit code received via SMS

```
User: "I received the code, entering it now"
  ↓
App calls: checkOtp(verificationId, otp, phone)
  ↓
Backend:
  ├─ Retrieves OTP from DynamoDB by verificationId
  ├─ Validates:
  │  ├─ OTP value matches input ✓
  │  ├─ Not expired (expires_at > now) ✓
  │  ├─ Not already verified (verification == false) ✓
  │  └─ Contact matches (phone) ✓
  ├─ If all valid:
  │  ├─ Updates DynamoDB:
  │  │  ├─ verification: true
  │  │  └─ verified_at: now
  │  └─ Returns 200
  ├─ If invalid:
  │  └─ Returns 400 (invalid OTP)
  ↓
✅ Phone verified (OTP confirmed)
```

**API**: `checkOtp(verificationId, otp, contact)`
- **Auth**: Public
- **Response**: `{ code: "200"|"400", verificationId, message }`

**Key Point**: This is the first verification. The OTP is marked as verified in DynamoDB but the user is NOT yet registered.

---

### STEP 4: USER FILLS DETAILS → CREATE ACCOUNT

**User Action**: Enters email, password, name, address, etc.

```
User: "Filling in my details and registering"
  ↓
App calls: signUpUser({
  user: {
    email, name, surname, phone, password, confirmPassword,
    city, countryCode, zipCode, streetAddress, languageId
  },
  otpData: { otp, verificationId },
  appBrand
})
  ↓
Backend:
  ├─ Validates all fields (email format, password strength, etc)
  ├─ Verifies OTP again (second validation - must be verified in DynamoDB)
  ├─ Checks: Is email already registered? (MongoDB query)
  ├─ Creates user in Cognito (USER_POOL_ID):
  │  ├─ Username: userId (UUID)
  │  ├─ Password: hashed (Cognito handles hashing)
  │  └─ Attributes: phone, email, name, surname
  ├─ Creates User document in MongoDB:
  │  ├─ id: userId
  │  ├─ email, phone, name, surname
  │  ├─ password: NOT stored (stored in Cognito)
  │  ├─ contactVerified:
  │  │  ├─ phone: true (verified in STEP 3)
  │  │  └─ email: false (not verified yet)
  │  ├─ creationDate, updateDate
  │  └─ Other fields: address, city, country, etc
  ├─ Generates NEW OTP for email verification:
  │  ├─ Saves to DynamoDB (OTP_TABLE)
  │  ├─ Expires in 24 hours
  │  └─ Used only for email verification link
  ├─ Sends confirmation email via Gmail (async via SQS):
  │  └─ Link: https://app.petlink.com/verify?uuid=userId&otp=...&verificationId=...
  ├─ Cleans up old OTP records from DynamoDB
  └─ Returns { code: 200, message: "Success" }
  ↓
✅ Account created (phone verified, email pending verification)
```

**API**: `signUpUser(user, otpData, appBrand)`
- **Auth**: Public (no JWT yet)
- **Response**: `{ code: "200"|"400", message, translationCode }`
- **Important**: Does NOT return JWT token

**What Happens Behind the Scenes**:
1. **Cognito**: User account created (for authentication)
2. **MongoDB**: User profile created (for application data)
3. **DynamoDB**: New OTP created (for email verification)
4. **SQS**: Email notification queued (for async delivery)

---

### STEP 5: USER CLICKS EMAIL LINK → VERIFY EMAIL

**User Action**: Receives email and clicks verification link

```
User: "Received confirmation email, clicking the link"
  ↓
Email contains: https://app.petlink.com/verify?uuid=userId&otp=...&verificationId=...
  ↓
App extracts parameters from URL
  ↓
App calls: verifyEmail(uuid, otp, verificationId)
  ↓
Backend:
  ├─ Retrieves user from MongoDB by uuid
  ├─ Retrieves OTP from DynamoDB by verificationId
  ├─ Validates OTP (same checks as STEP 3):
  │  ├─ OTP matches ✓
  │  ├─ Not expired ✓
  │  ├─ Not already verified ✓
  │  └─ Contact matches (email) ✓
  ├─ If valid:
  │  ├─ Updates MongoDB:
  │  │  └─ contactVerified.email: true
  │  └─ Returns 200
  ├─ If invalid:
  │  └─ Returns 400 (invalid OTP)
  ↓
✅ Email verified (account fully active)
```

**API**: `verifyEmail(uuid, otp, verificationId)`
- **Auth**: Public
- **Response**: `{ code: "200"|"400", message }`

**Key Point**: After this step, the account is FULLY ACTIVE. Both phone and email are verified.

---

### STEP 6: USER LOGS IN → GET JWT TOKEN

**User Action**: Enters phone/email and password to login

```
User: "Now I can log in"
  ↓
Option A - Login with PHONE:
  App calls: petlink.loginWithPhone(phone, password)
  ↓
Option B - Login with EMAIL:
  App calls: petlink.loginWithEmail(email, password)
  ↓
App (TypeScript Client):
  ├─ Calls Cognito directly (NOT the backend)
  ├─ Sends: InitiateAuthCommand(USER_PASSWORD_AUTH)
  │  ├─ Username: phone or email
  │  └─ Password: user-provided password
  ↓
Cognito:
  ├─ Verifies credentials
  ├─ If valid:
  │  ├─ Generates idToken (JWT)
  │  ├─ Generates accessToken (JWT)
  │  └─ Generates refreshToken
  ├─ If invalid:
  │  └─ Returns error (invalid credentials)
  ↓
App receives JWT token
  ├─ Caches idToken in secure storage
  ├─ Uses idToken in Authorization header for all GraphQL requests
  ↓
✅ User authenticated and can use the app
```

**Flow Details**:
1. **App talks to Cognito directly** (not through backend)
2. **Cognito verifies password** and returns JWT tokens
3. **App caches the JWT** in secure storage
4. **App uses JWT** for all subsequent API calls

**JWT Token**:
- **Issued by**: AWS Cognito
- **Type**: ID Token (contains user identity claims)
- **Contains**: User ID, email, phone, custom attributes
- **Verified by**: AppSync Authorizer (validates signature)
- **Expiration**: ~1 hour (configurable)
- **Refresh**: Use refreshToken to get new idToken

---

### STEP 7: USER IS AUTHENTICATED → CAN USE APP

**User Action**: App is now fully functional

```
User: "I'm logged in and can use the app"
  ↓
App calls: getUser() with JWT token in Authorization header
  ↓
Backend (AppSync):
  ├─ Authorizer verifies JWT signature against Cognito public keys
  ├─ Extracts userId from JWT
  ├─ Queries MongoDB for user profile
  └─ Returns user data
  ↓
✅ User sees their profile and can use all features
```

**All subsequent requests**:
- Include JWT token in `Authorization` header
- AppSync Authorizer validates the token
- Backend retrieves user data from MongoDB
- User can access their pets, devices, subscriptions, etc.

---

## After Registration

### Contacts Locked
Once registered, phone and email are **locked**:
- `checkContact(phone)` → `400` (unavailable)
- `checkContact(email)` → `400` (unavailable)

### Account Deletion
User can delete account only if:
- ✅ No pets associated
- ❌ If has pets → must delete them first


---
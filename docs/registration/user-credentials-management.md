# User Credentials Management

✓ User Credentials Management
  ✓ CHANGE flows (authenticated)
    ✓ 1. Change PASSWORD (User wants to change his password)
    ✓ 2. Change EMAIL (User wants to change his email)
    ✓ 3. Change PHONE (User wants to change his phone number)
  ✓ FORGOT/RECOVERY flows (public)
    ✓ 4. Reset PASSWORD (User forgot password) → OTP flow
    ✓ 5. Recovery EMAIL (User forgot email) → Serial number device flow


------ CHANGE flows (authenticated) ------

🔄 1. CHANGE PASSWORD (utente autenticato vuole cambiare password)
STEP 1: Cambia password direttamente
└─> changePassword(oldPassword, newPassword)
    └─> Password aggiornata
Autenticazione richiesta: ✅ SI (authJwt)

📧 2. CHANGE EMAIL
STEP 1: Aggiorna email
└─> updateEmailUser(newEmail, languageId, appBrand)
    └─> Email aggiornata
Autenticazione richiesta: ✅ SI (authJwt)

📱 3. CHANGE PHONE
STEP 1: Richiedi OTP per il nuovo numero
└─> sendOtp(newPhone)
    └─> Ritorna: verificationId

STEP 2: Utente riceve OTP via SMS

STEP 3: Aggiorna phone con OTP
└─> updatePhoneNumberUser(newPhone, verificationId, otp)
    └─> Phone aggiornato
Autenticazione richiesta: 
  STEP 1: ❌ NO (public)
  STEP 3: ✅ SI (authJwt)

------ FORGOT/RECOVERY flows (public) ------

🔐 4. RESET PASSWORD (utente ha dimenticato la password)
STEP 1: Richiedi OTP
└─> sendOtpForgotPassword(contact: email/phone)
    └─> Ritorna: verificationId

STEP 2: Utente riceve OTP via email/SMS

STEP 3: Cambia password
└─> changeForgotPassword(otp, verificationId, newPassword)
    └─> Password aggiornata
Autenticazione richiesta: ❌ NO (public endpoint)

🔍 5. RECOVER EMAIL (utente ha dimenticato la email)
STEP 1: Recupera email usando serial number del device
└─> forgotEmail(deviceSerialNumber, entityType: "PETLINK_GPS")
    └─> Email inviata all'indirizzo registrato
Autenticazione richiesta: ❌ NO (public endpoint)


--------------------
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: L'utente richiede il reset password                │
└─────────────────────────────────────────────────────────────┘
👤 Utente fornisce: email O phone number
📱 App chiama (PUBLIC endpoint):
   └─> sendOtpForgotPassword(contact: "user@example.com")
   
🔙 Backend ritorna:
   └─> verificationId: "abc-123-xyz"
   
📧 Nel frattempo:
   └─> Utente riceve email/SMS con codice OTP (es: "456789")


┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Utente controlla email/SMS                         │
└─────────────────────────────────────────────────────────────┘
📧 Email ricevuta: "Il tuo codice OTP è: 456789"
👤 Utente copia il codice


┌─────────────────────────────────────────────────────────────┐
│ STEP 3: L'utente inserisce OTP e nuova password            │
└─────────────────────────────────────────────────────────────┘
👤 Utente fornisce:
   - OTP: "456789"
   - Nuova password: "MyNewPassword123!"
   
📱 App chiama (PUBLIC endpoint):
   └─> changeForgotPassword(
         otp: "456789",
         verificationId: "abc-123-xyz",
         password: "MyNewPassword123!"
       )
   
✅ Password aggiornata!
👤 Utente può ora fare login con la nuova password


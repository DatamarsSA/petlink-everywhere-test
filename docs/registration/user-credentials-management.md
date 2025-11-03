# User Credentials Management

## Overview

✓ User Credentials Management
- ✓ CHANGE flows (authenticated)
  - ✓ 1. Change PASSWORD (User wants to change his password)
  - ✓ 2. Change EMAIL (User wants to change his email)
  - ✓ 3. Change PHONE (User wants to change his phone number)
- ✓ FORGOT/RECOVERY flows (public)
  - ✓ 4. Reset PASSWORD (User forgot password) → OTP flow

---

## CHANGE flows (authenticated)

### 🔄 1. CHANGE PASSWORD (utente autenticato vuole cambiare password)

- **STEP 1**: Cambia password direttamente
  - **Endpoint**: `authJwt.changePassword(oldPassword, newPassword)`
  - **Risultato**: Password aggiornata

---

### 📧 2. CHANGE EMAIL

- **STEP 1**: Aggiorna email
  - **Endpoint**: `authJwt.updateEmailUser(newEmail, languageId, appBrand)`
  - **Risultato**: Email aggiornata (non verificata)

- **STEP 2**: Utente riceve email di verifica

- **STEP 3**: Verifica email
  - **Endpoint**: `public.verifyEmail(uuid, otp, verificationId)`
  - **Risultato**: Email verificata e cambiata con successo

---

### 📱 3. CHANGE PHONE

- **STEP 1**: Richiedi OTP per il nuovo numero
  - **Endpoint**: `public.sendOtp(newPhone)`
  - **Risultato**: Ritorna `verificationId`

- **STEP 2**: Utente riceve OTP via SMS

- **STEP 3**: Verifica Phone number inviando OTP
  - **Endpoint**: `public.checkOtp(verificationId, otp, newPhone)`
  - **Risultato**: OTP verificato

- **STEP 4**: Aggiorna phone con OTP
  - **Endpoint**: `authJwt.updatePhoneNumberUser(newPhone, verificationId, otp)`
  - **Risultato**: Phone aggiornato


---

## FORGOT/RECOVERY flows (public)

### 🔐 4. RESET PASSWORD (utente ha dimenticato la password)

- **STEP 1**: Richiedi OTP
  - **Endpoint**: `public.sendOtpForgotPassword(contact: email/phone)`
  - **Risultato**: Ritorna `verificationId`

- **STEP 2**: Utente riceve OTP via SMS

- **STEP 3**: Verifica OTP
  - **Endpoint**: `public.checkOtp(verificationId, otp, contact)`
  - **Risultato**: OTP verificato

- **STEP 4**: Cambia password
  - **Endpoint**: `public.changeForgotPassword(otp, verificationId, newPassword)`
  - **Risultato**: Password aggiornata

---
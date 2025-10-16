// ============================================================================
// UTILITIES
// ============================================================================

export enum AppBrand {
  KIPPY = "KIPPY",
  PETLINK = "PETLINK",
}

export enum UtilityTestTypeEnum {
  BUY_NEW_SUBSCRIPTION = "BUY_NEW_SUBSCRIPTION",
  CLEAN_UP_USER = "CLEAN_UP_USER",
  SIGN_UP = "SIGN_UP",
}

export enum LanguageId {
  DE = "DE",
  EN = "EN",
  ES = "ES",
  FR = "FR",
  IT = "IT",
}

// ============================================================================
// PET & DEVICE
// ============================================================================

export enum PetType {
  DOG = "DOG",
  CAT = "CAT",
  OTHER = "OTHER",
}

export enum DeviceType {
  DOG = "DOG",
  CAT = "CAT",
  EVO = "EVO",
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export enum SubStatus {
  Active = "active",
  Cancelled = "cancelled",
  Closed = "closed",
  Future = "future",
  InTrial = "in_trial",
  NonRenewing = "non_renewing",
  Paused = "paused",
  ToStopRenew = "to_stop_renew",
  ToStopRenewAddon = "to_stop_renew_addon",
  Transferred = "transferred",
}

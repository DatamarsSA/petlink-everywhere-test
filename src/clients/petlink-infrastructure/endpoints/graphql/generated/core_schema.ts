import { GraphQLClient, RequestOptions } from "graphql-request";
import { DocumentNode } from "graphql";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /**
   * The `AWSJSON` scalar type provided by AWS AppSync, represents a JSON string that
   * complies with [RFC 8259](https://tools.ietf.org/html/rfc8259).  Maps like
   * "**{\\"upvotes\\": 10}**", lists like "**[1,2,3]**", and scalar values like
   * "**\\"AWSJSON example string\\"**", "**1**", and "**true**" are accepted as
   * valid JSON and will automatically be parsed and loaded in the resolver mapping
   * templates as Maps, Lists, or Scalar values rather than as the literal input
   * strings.  Invalid JSON strings like "**{a: 1}**", "**{'a': 1}**" and "**Unquoted
   * string**" will throw GraphQL validation errors.
   */
  AWSJSON: { input: any; output: any };
};

export interface Activities {
  __typename?: "Activities";
  calories?: Maybe<Scalars["Float"]["output"]>;
  /**   only cat */
  feed?: Maybe<Scalars["Float"]["output"]>;
  grooming?: Maybe<Scalars["Float"]["output"]>;
  highMovement?: Maybe<Scalars["Float"]["output"]>;
  jumps?: Maybe<Scalars["Float"]["output"]>;
  onTheMove?: Maybe<Scalars["Float"]["output"]>;
  petId?: Maybe<Scalars["String"]["output"]>;
  /**   only dog */
  play?: Maybe<Scalars["Float"]["output"]>;
  run?: Maybe<Scalars["Float"]["output"]>;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
  sleep?: Maybe<Scalars["Float"]["output"]>;
  steps?: Maybe<Scalars["Float"]["output"]>;
  timestamp?: Maybe<Scalars["Float"]["output"]>;
  /**   dog and cat */
  walk?: Maybe<Scalars["Float"]["output"]>;
}

export enum ActivityProfileEnum {
  ModeratelyActive = "MODERATELY_ACTIVE",
  Sedentary = "SEDENTARY",
  VeryActive = "VERY_ACTIVE",
}

export interface ActivityReport {
  __typename?: "ActivityReport";
  activitiesLevel?: Maybe<Scalars["Float"]["output"]>;
  calories: ActivityValue;
  onTheMove: ActivityValue;
  petId: Scalars["String"]["output"];
  play: ActivityValue;
  run: ActivityValue;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
  sleep: ActivityValue;
  steps: ActivityValue;
  walk: ActivityValue;
}

export interface ActivityReportAverageCat {
  __typename?: "ActivityReportAverageCat";
  activitiesLevel?: Maybe<Scalars["Float"]["output"]>;
  calories: ActivityValue;
  feed: ActivityValue;
  grooming: ActivityValue;
  highMovement: ActivityValue;
  jumps: ActivityValue;
  onTheMove: ActivityValue;
  petId: Scalars["String"]["output"];
  sleep: ActivityValue;
  steps: ActivityValue;
  walk: ActivityValue;
}

export interface ActivityReportCat {
  __typename?: "ActivityReportCat";
  calories: ActivityValueCat;
  feed: ActivityValueCat;
  grooming: ActivityValueCat;
  healthRate?: Maybe<Scalars["Float"]["output"]>;
  healthRateReliability?: Maybe<Scalars["Float"]["output"]>;
  highMovement: ActivityValueCat;
  jumps: ActivityValueCat;
  onTheMove: ActivityValueCat;
  petId: Scalars["String"]["output"];
  sleep: ActivityValueCat;
  steps: ActivityValueCat;
  walk: ActivityValueCat;
}

export interface ActivityValue {
  __typename?: "ActivityValue";
  goal: Scalars["Float"]["output"];
  value: Scalars["Float"]["output"];
}

export interface ActivityValueCat {
  __typename?: "ActivityValueCat";
  goal: GoalRange;
  value: Scalars["Float"]["output"];
}

export interface AddonPricing {
  __typename?: "AddonPricing";
  currencyCode: Scalars["String"]["output"];
  externalName?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  itemFamilyId?: Maybe<Scalars["String"]["output"]>;
  itemId: Scalars["String"]["output"];
  itemType?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  period?: Maybe<Scalars["Float"]["output"]>;
  periodUnit?: Maybe<Scalars["String"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  status?: Maybe<Scalars["String"]["output"]>;
  trialPeriod?: Maybe<Scalars["Int"]["output"]>;
  trialPeriodUnit?: Maybe<Scalars["String"]["output"]>;
}

export enum AppBrand {
  Kippy = "KIPPY",
  Petlink = "PETLINK",
}

export interface BillingInfo {
  __typename?: "BillingInfo";
  address?: Maybe<Scalars["String"]["output"]>;
  city?: Maybe<Scalars["String"]["output"]>;
  country?: Maybe<Scalars["String"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  firstName?: Maybe<Scalars["String"]["output"]>;
  lastName?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
  state?: Maybe<Scalars["String"]["output"]>;
  stateCode?: Maybe<Scalars["String"]["output"]>;
  zip?: Maybe<Scalars["String"]["output"]>;
}

export interface BillingInfoInput {
  address: Scalars["String"]["input"];
  city: Scalars["String"]["input"];
  country: Scalars["String"]["input"];
  state?: InputMaybe<Scalars["String"]["input"]>;
  zip: Scalars["String"]["input"];
}

export interface Breed {
  __typename?: "Breed";
  breedName: Scalars["String"]["output"];
  code: Scalars["String"]["output"];
  species: SpeciesEnum;
}

export enum BreedTypeEnum {
  MixedBreed = "MIXED_BREED",
  Purebreed = "PUREBREED",
}

export enum CancelReasonCodeEnum {
  DoNotUse = "DO_NOT_USE",
  DoNotWorkProperly = "DO_NOT_WORK_PROPERLY",
  MissingPet = "MISSING_PET",
  NotSuitable = "NOT_SUITABLE",
  Other = "OTHER",
  RetentionFlow = "RETENTION_FLOW",
  TooExpensive = "TOO_EXPENSIVE",
}

export interface Card {
  __typename?: "Card";
  brand?: Maybe<Scalars["String"]["output"]>;
  expiryMonth?: Maybe<Scalars["Int"]["output"]>;
  expiryYear?: Maybe<Scalars["Int"]["output"]>;
  maskedNumber?: Maybe<Scalars["String"]["output"]>;
  paymentMethod: Scalars["String"]["output"];
  type?: Maybe<Scalars["String"]["output"]>;
}

export interface CareProtectionPlan {
  __typename?: "CareProtectionPlan";
  itemId: Scalars["String"]["output"];
  pricings: Array<Maybe<Pricing>>;
}

export interface ClearCacheMessageStatus {
  __typename?: "ClearCacheMessageStatus";
  id: Scalars["String"]["output"];
  status: ClearCacheStatus;
}

export interface ClearCacheMessageStatusIn {
  id: Scalars["String"]["input"];
  status: ClearCacheStatusIn;
}

export interface ClearCacheStatus {
  __typename?: "ClearCacheStatus";
  entityType: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
}

export interface ClearCacheStatusIn {
  entityType: Scalars["String"]["input"];
  id: Scalars["String"]["input"];
}

export interface Color {
  __typename?: "Color";
  code: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
}

export interface Command {
  commandType: CommandEnum;
  duration?: InputMaybe<Scalars["Int"]["input"]>;
  id: Scalars["String"]["input"];
  modeType?: InputMaybe<ModeType>;
}

export enum CommandEnum {
  Flashlight = "FLASHLIGHT",
  LiveTracking = "LIVE_TRACKING",
  LiveTrackingTest = "LIVE_TRACKING_TEST",
  Shutdown = "SHUTDOWN",
  Sound = "SOUND",
}

export enum ContactType {
  Email = "EMAIL",
  Phone = "PHONE",
}

export interface ContactVerified {
  __typename?: "ContactVerified";
  email?: Maybe<Scalars["Boolean"]["output"]>;
  phone?: Maybe<Scalars["Boolean"]["output"]>;
}

export interface ContentMessage {
  __typename?: "ContentMessage";
  contact: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  petName: Scalars["String"]["output"];
  position?: Maybe<Coordinates>;
}

export interface Coordinates {
  __typename?: "Coordinates";
  lat: Scalars["Float"]["output"];
  lng: Scalars["Float"]["output"];
}

export interface CoordinatesIn {
  lat?: InputMaybe<Scalars["Float"]["input"]>;
  lng?: InputMaybe<Scalars["Float"]["input"]>;
}

export interface CountryState {
  __typename?: "CountryState";
  code: Scalars["String"]["output"];
  gpsOptimizationCommand?: Maybe<GpsOptimizationCommand>;
  name: Scalars["String"]["output"];
}

export interface Coupon {
  __typename?: "Coupon";
  currencyCode?: Maybe<Scalars["String"]["output"]>;
  discountAmount?: Maybe<Scalars["Int"]["output"]>;
  discountPercentage?: Maybe<Scalars["Int"]["output"]>;
  discountQuantity?: Maybe<Scalars["Int"]["output"]>;
  discountType: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
}

export interface CurrentSubscription {
  __typename?: "CurrentSubscription";
  id: Scalars["String"]["output"];
  invoiceStatus?: Maybe<InvoiceStatusEnum>;
  paymentStatus?: Maybe<PaymentStatusTypeEnum>;
  status: SubscriptionStatusEnum;
}

export interface Device {
  __typename?: "Device";
  activated: Scalars["Boolean"]["output"];
  appBrand: Scalars["String"]["output"];
  deviceType: DeviceTypeEnum;
  itemId: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
}

export interface DevicePrice {
  __typename?: "DevicePrice";
  countryCode: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  deviceType: DeviceTypeEnum;
  discountPercentage: Scalars["Int"]["output"];
  id: Scalars["String"]["output"];
  period?: Maybe<Scalars["Float"]["output"]>;
  periodUnit?: Maybe<Scalars["String"]["output"]>;
  price: Scalars["Float"]["output"];
}

export enum DeviceTypeEnum {
  Cat = "CAT",
  Dog = "DOG",
  Evo = "EVO",
}

export interface DiscoutItem {
  __typename?: "DiscoutItem";
  amount: Scalars["Float"]["output"];
  chargebeeInvoiceItemId: Scalars["String"]["output"];
  couponId: Scalars["String"]["output"];
  discountPercentage?: Maybe<Scalars["Float"]["output"]>;
  discountType: Scalars["String"]["output"];
}

export interface EndOfLife {
  __typename?: "EndOfLife";
  addonIds?: Maybe<Array<Scalars["String"]["output"]>>;
  devicePrice?: Maybe<DevicePrice>;
  id: Scalars["String"]["output"];
  pricing?: Maybe<Pricing>;
  productId: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
  shippingInfo?: Maybe<ShippingInfo>;
  shopUrl?: Maybe<Scalars["String"]["output"]>;
  step: Scalars["String"]["output"];
  subscriptionId?: Maybe<Scalars["String"]["output"]>;
  userId: Scalars["String"]["output"];
}

export interface EndOfLifeIn {
  addonIds?: InputMaybe<Array<Scalars["String"]["input"]>>;
  devicePriceId?: InputMaybe<Scalars["String"]["input"]>;
  priceId?: InputMaybe<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
  serialNumber: Scalars["String"]["input"];
  shippingInfo?: InputMaybe<ShippingInfoIn>;
  shopUrl?: InputMaybe<Scalars["String"]["input"]>;
  step: Scalars["String"]["input"];
  subscriptionId?: InputMaybe<Scalars["String"]["input"]>;
  userId: Scalars["String"]["input"];
}

export interface EnergySavingZone {
  __typename?: "EnergySavingZone";
  bssid: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  entityType: EntityTypeEnum;
  icon: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  position: Coordinates;
  radius: Scalars["Float"]["output"];
  ssid: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface EnergySavingZoneIn {
  bssid: Scalars["String"]["input"];
  entityType: EntityTypeEnum;
  icon: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  position: CoordinatesIn;
  radius: Scalars["Float"]["input"];
  ssid: Scalars["String"]["input"];
}

export enum EntityTypeEnum {
  Activity = "ACTIVITY",
  EnergySavingZone = "ENERGY_SAVING_ZONE",
  Geofence = "GEOFENCE",
  Pet = "PET",
  PetlinkGps = "PETLINK_GPS",
  PetlinkMicrochip = "PETLINK_MICROCHIP",
  PetlinkQrTag = "PETLINK_QR_TAG",
  PetHistoryEvent = "PET_HISTORY_EVENT",
  Subscription = "SUBSCRIPTION",
  User = "USER",
}

export interface EszNotificationPreferences {
  __typename?: "EszNotificationPreferences";
  push: Scalars["Boolean"]["output"];
}

export interface EszNotificationPreferencesIn {
  push: Scalars["Boolean"]["input"];
}

export interface EszNotificationsInput {
  push: Scalars["Boolean"]["input"];
}

export enum Gender {
  Female = "FEMALE",
  Male = "MALE",
}

export interface Geofence {
  __typename?: "Geofence";
  creationDate: Scalars["String"]["output"];
  devices?: Maybe<Array<Maybe<Scalars["String"]["output"]>>>;
  entityType: EntityTypeEnum;
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  position: Array<Coordinates>;
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface GeofenceIn {
  name: Scalars["String"]["input"];
  position: Array<CoordinatesIn>;
}

export interface GoalRange {
  __typename?: "GoalRange";
  max: Scalars["Float"]["output"];
  min: Scalars["Float"]["output"];
}

export interface GpsMessagePosition {
  __typename?: "GpsMessagePosition";
  id: Scalars["String"]["output"];
  messageType: GpsMessageType;
  position: GpsPosition;
}

export interface GpsMessagePositionIn {
  id: Scalars["String"]["input"];
  messageType: GpsMessageType;
  position: GpsPositionIn;
}

export interface GpsMessageStatus {
  __typename?: "GpsMessageStatus";
  id: Scalars["String"]["output"];
  messageType: GpsMessageType;
  status: GpsStatus;
}

export interface GpsMessageStatusIn {
  id: Scalars["String"]["input"];
  messageType: GpsMessageType;
  status: GpsStatusIn;
}

export enum GpsMessageType {
  LastPosition = "LAST_POSITION",
  LiveTracking = "LIVE_TRACKING",
  Status = "STATUS",
}

export interface GpsOptimizationCommand {
  __typename?: "GpsOptimizationCommand";
  rfBand: Scalars["String"]["output"];
  rfTecnology: Scalars["String"]["output"];
}

export interface GpsPosition {
  __typename?: "GpsPosition";
  alt?: Maybe<Scalars["Float"]["output"]>;
  date: Scalars["String"]["output"];
  lat: Scalars["Float"]["output"];
  lng: Scalars["Float"]["output"];
  positionType: PositionType;
  radius: Scalars["Float"]["output"];
  speed?: Maybe<Scalars["Float"]["output"]>;
}

export interface GpsPositionIn {
  alt?: InputMaybe<Scalars["Float"]["input"]>;
  date: Scalars["String"]["input"];
  lat: Scalars["Float"]["input"];
  lng: Scalars["Float"]["input"];
  positionType: PositionType;
  radius: Scalars["Float"]["input"];
  speed?: InputMaybe<Scalars["Float"]["input"]>;
}

export interface GpsSettings {
  __typename?: "GpsSettings";
  activityProfile?: Maybe<ActivityProfileEnum>;
  enableGpsOnDefault: Scalars["Boolean"]["output"];
  optimizationDone?: Maybe<Scalars["Boolean"]["output"]>;
  updateFrequency: Scalars["Int"]["output"];
}

export interface GpsSettingsIn {
  activityProfile?: InputMaybe<ActivityProfileEnum>;
  enableGpsOnDefault?: InputMaybe<Scalars["Boolean"]["input"]>;
  updateFrequency?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface GpsStatus {
  __typename?: "GpsStatus";
  battery: Scalars["Int"]["output"];
  date: Scalars["String"]["output"];
  energySavingMode: StatusState;
  firmwareVersion: Scalars["String"]["output"];
  flashlight: StatusState;
  geofence: StatusState;
  inEnergySavingZone?: Maybe<Scalars["Boolean"]["output"]>;
  inGeofence?: Maybe<Scalars["Boolean"]["output"]>;
  liveTracking: StatusState;
  offline?: Maybe<Scalars["Boolean"]["output"]>;
  shutdown?: Maybe<Scalars["Boolean"]["output"]>;
  sound: StatusState;
}

export interface GpsStatusIn {
  battery: Scalars["Int"]["input"];
  date: Scalars["String"]["input"];
  energySavingMode: StatusState;
  firmwareVersion: Scalars["String"]["input"];
  flashlight: StatusState;
  geofence: StatusState;
  inEnergySavingZone?: InputMaybe<Scalars["Boolean"]["input"]>;
  inGeofence?: InputMaybe<Scalars["Boolean"]["input"]>;
  liveTracking: StatusState;
  offline?: InputMaybe<Scalars["Boolean"]["input"]>;
  shutdown?: InputMaybe<Scalars["Boolean"]["input"]>;
  sound: StatusState;
}

export enum HighlightEnum {
  AboveAverage = "ABOVE_AVERAGE",
  AboveThreshold = "ABOVE_THRESHOLD",
  Average = "AVERAGE",
  BelowAverage = "BELOW_AVERAGE",
  BelowThreshold = "BELOW_THRESHOLD",
  Hide = "HIDE",
}

export interface Highlights {
  __typename?: "Highlights";
  feed?: Maybe<HighlightEnum>;
  grooming?: Maybe<HighlightEnum>;
  highMovement?: Maybe<HighlightEnum>;
  isStressed?: Maybe<Scalars["Boolean"]["output"]>;
  jumps?: Maybe<HighlightEnum>;
}

export interface HostedPageOptionsInput {
  layout?: InputMaybe<LayoutPageEnum>;
  redirectUrl?: InputMaybe<Scalars["String"]["input"]>;
}

export interface Image {
  __typename?: "Image";
  id: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export enum ImageUploadType {
  Pet = "PET",
  User = "USER",
}

export interface InvoiceItemShortInfo {
  __typename?: "InvoiceItemShortInfo";
  amount: Scalars["Int"]["output"];
  chargebeeInvoiceItemId: Scalars["String"]["output"];
  description: Scalars["String"]["output"];
  itemId: Scalars["String"]["output"];
  itemType: Scalars["String"]["output"];
  quantity: Scalars["Int"]["output"];
  unitPrice: Scalars["Int"]["output"];
}

export enum InvoiceReasonCodeEnum {
  OrderCancellation = "order_cancellation",
  OrderChange = "order_change",
  Other = "other",
  ProductUnsatisfactory = "product_unsatisfactory",
  ServiceUnsatisfactory = "service_unsatisfactory",
  Waiver = "waiver",
}

export interface InvoiceShortInfo {
  __typename?: "InvoiceShortInfo";
  creationDate: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  discountItems?: Maybe<Array<DiscoutItem>>;
  id: Scalars["String"]["output"];
  items: Array<InvoiceItemShortInfo>;
  status: InvoiceStatusEnum;
  total: Scalars["Float"]["output"];
}

export enum InvoiceStatusEnum {
  NonPaying = "non_paying",
  NotPaid = "not_paid",
  Paid = "paid",
  PaidExternally = "paid_externally",
  PaymentDue = "payment_due",
  Pending = "pending",
  Posted = "posted",
  Voided = "voided",
}

export enum LanguageId {
  De = "DE",
  En = "EN",
  Es = "ES",
  Fr = "FR",
  It = "IT",
}

export enum LayoutPageEnum {
  FullPage = "full_page",
  InApp = "in_app",
}

export enum LikeType {
  Dislike = "DISLIKE",
  Like = "LIKE",
}

export interface LostIn {
  countryCode: Scalars["String"]["input"];
  imageId?: InputMaybe<Scalars["String"]["input"]>;
  lostDate: Scalars["String"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
  publishInLostPage: Scalars["Boolean"]["input"];
  showEmailAddress: Scalars["Boolean"]["input"];
  showPhoneNumber: Scalars["Boolean"]["input"];
  zipCode: Scalars["String"]["input"];
}

export interface LostInfo {
  __typename?: "LostInfo";
  countryCode: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  image?: Maybe<Image>;
  lostDate: Scalars["String"]["output"];
  note?: Maybe<Scalars["String"]["output"]>;
  petId: Scalars["String"]["output"];
  publishInLostPage: Scalars["Boolean"]["output"];
  showEmailAddress: Scalars["Boolean"]["output"];
  showPhoneNumber: Scalars["Boolean"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  zipCode: Scalars["String"]["output"];
}

export interface MessageFoundPetIn {
  contact: Scalars["String"]["input"];
  message: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  position?: InputMaybe<Position>;
  serialNumber: Scalars["String"]["input"];
}

export interface MobileDevice {
  __typename?: "MobileDevice";
  os: MobileOsEnum;
  registrationToken: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
}

export enum MobileOsEnum {
  Android = "ANDROID",
  Ios = "IOS",
}

export enum ModeType {
  Ble = "BLE",
  Sentinel = "SENTINEL",
}

export interface Mutation {
  __typename?: "Mutation";
  acknowledgeCheckout: Response;
  /**
   *  refundInvoice(invoiceId: String!, refundAmount: Float!, reasonCode:
   * InvoiceReasonCodeEnum!): Response @aws_cognito_user_pools @aws_iam
   */
  activateDeviceInOrder?: Maybe<Response>;
  addGpsPromotion?: Maybe<Response>;
  appKeepAlive: Response;
  changeForgotPassword: Response;
  changePassword: Response;
  checkOtp: ResponseOtp;
  /**
   *   createEnergySavingZone(energySavingZone: EnergySavingZoneIn!):
   * ResponseEnergySavingZone! @aws_cognito_user_pools @aws_iam
   *  updateEnergySavingZone(energySavingZone: UpdateEnergySavingZoneIn!):
   * ResponseEnergySavingZone! @aws_cognito_user_pools @aws_iam
   *  deleteEnergySavingZone(id: String!): Response! @aws_cognito_user_pools @aws_iam
   *  isActiveEnergySavingZone(id: String!, isActive: Boolean!): Response! @aws_cognito_user_pools @aws_iam
   */
  createGeofence: ResponseGeofence;
  createPet: ResponsePet;
  createPetlinkGps: ResponseCreatePetlinkGps;
  createPetlinkMicrochip: ResponsePetlinkMicrochip;
  createPetlinkQrTag: ResponsePetlinkQrTag;
  deleteGeofence: Response;
  deletePet: Response;
  deleteRegistrationToken: Response;
  deleteUser: Response;
  forceClearCache: Response;
  forgotEmail?: Maybe<Response>;
  logDisabled?: Maybe<Response>;
  publishOnForceClearCache: ClearCacheMessageStatus;
  /**   subscription publishers */
  publishOnGpsMessagePosition: GpsMessagePosition;
  publishOnGpsMessageStatus: GpsMessageStatus;
  publishOnSubscriptionStatus: SubscriptionMessageStatus;
  pushGpsMessagePositionBLE: Response;
  qrTagHasBeenScanned: Response;
  /**   newsletter */
  registerToNewsletter: Response;
  removeProduct: Response;
  replacement: ResponseReplacement;
  resetPetlinkGps: Response;
  sendCommand: Response;
  sendCustomerSuggestions: Response;
  sendMessageFoundPet: Response;
  sendOtp: ResponseOtp;
  sendOtpForgotPassword: ResponseOtp;
  sendSetting: ResponseSendSetting;
  /**   add sub w/uuid from verifyEmail */
  sendTokenEmail: Response;
  setArcaPlanetTerms: Response;
  setOptimizationDone: Response;
  setPetIsFound: ResponseSetPetIsFound;
  setPetIsLost: ResponseSetPetIsLost;
  setReadPopupMigratedUser: Response;
  setSafetyTermsCat: Response;
  /**   sso */
  setSsoToken: ResponseSsoUrl;
  signUpUser: Response;
  stopRenewingAddon?: Maybe<Response>;
  stopRenewingSubscription?: Maybe<Response>;
  /**   subscriptions */
  updateBillingInfo: Response;
  updateEmailUser: ResponseUser;
  /**   end of life */
  updateEndOfLife: ResponseUpdateEndOfLife;
  updateGeofence: ResponseGeofence;
  updateNotificationSettings: ResponseNotificationSettings;
  updatePaymentSources: ResponseManagePaymentSources;
  updatePet: ResponsePet;
  updatePetProtectionData?: Maybe<ResponseUpdatePetProtectionData>;
  /**   TODO: rename in deleteProduct */
  updatePetlinkGps: ResponsePetlinkGps;
  updatePhoneNumberUser: ResponseUser;
  updateUser: ResponseUser;
  /**   cct */
  updateUserContact: Response;
  /**   test suite */
  utilityIntegrationTest: ResponseUtilityIntegrationTest;
  verifyEmail?: Maybe<Response>;
}

export type MutationAcknowledgeCheckoutArgs = {
  id: Scalars["String"]["input"];
};

export type MutationActivateDeviceInOrderArgs = {
  deviceId: Scalars["String"]["input"];
};

export type MutationAddGpsPromotionArgs = {
  deviceId: Scalars["String"]["input"];
  promotion: PromotionInput;
};

export type MutationAppKeepAliveArgs = {
  productIds: Array<Scalars["String"]["input"]>;
};

export type MutationChangeForgotPasswordArgs = {
  otp: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
};

export type MutationChangePasswordArgs = {
  oldPassword: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
};

export type MutationCheckOtpArgs = {
  contact: Scalars["String"]["input"];
  otp: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
};

export type MutationCreateGeofenceArgs = {
  geofence: GeofenceIn;
};

export type MutationCreatePetArgs = {
  pet: PetIn;
};

export type MutationCreatePetlinkGpsArgs = {
  appBrand: AppBrand;
  petlinkGps: PetlinkGpsIn;
};

export type MutationCreatePetlinkMicrochipArgs = {
  petlinkMicrochip: PetlinkMicrochipIn;
};

export type MutationCreatePetlinkQrTagArgs = {
  petlinkQrTag: PetlinkQrTagIn;
};

export type MutationDeleteGeofenceArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeletePetArgs = {
  petId: Scalars["String"]["input"];
};

export type MutationDeleteRegistrationTokenArgs = {
  mobileDevice: Scalars["String"]["input"];
};

export type MutationDeleteUserArgs = {
  id?: InputMaybe<Scalars["String"]["input"]>;
};

export type MutationForceClearCacheArgs = {
  clearCacheStatus: ClearCacheMessageStatusIn;
};

export type MutationForgotEmailArgs = {
  entityType?: InputMaybe<ProductTypeEnum>;
  languageId?: InputMaybe<LanguageId>;
  productNumber: Scalars["String"]["input"];
};

export type MutationLogDisabledArgs = {
  deviceId: Scalars["String"]["input"];
};

export type MutationPublishOnForceClearCacheArgs = {
  clearCacheStatus?: InputMaybe<ClearCacheMessageStatusIn>;
};

export type MutationPublishOnGpsMessagePositionArgs = {
  gpsPosition: GpsMessagePositionIn;
};

export type MutationPublishOnGpsMessageStatusArgs = {
  gpsStatus: GpsMessageStatusIn;
};

export type MutationPublishOnSubscriptionStatusArgs = {
  subscriptionStatus: SubscriptionMessageStatusIn;
};

export type MutationPushGpsMessagePositionBleArgs = {
  position: GpsPositionIn;
  productId: Scalars["String"]["input"];
};

export type MutationQrTagHasBeenScannedArgs = {
  petlinkQrTag: Scalars["String"]["input"];
};

export type MutationRegisterToNewsletterArgs = {
  email: Scalars["String"]["input"];
};

export type MutationRemoveProductArgs = {
  productId: Scalars["String"]["input"];
};

export type MutationReplacementArgs = {
  entityType: ProductTypeEnum;
  newSerialNumber: Scalars["String"]["input"];
  productId: Scalars["String"]["input"];
};

export type MutationResetPetlinkGpsArgs = {
  id: Scalars["String"]["input"];
};

export type MutationSendCommandArgs = {
  command: Command;
};

export type MutationSendCustomerSuggestionsArgs = {
  productId: Scalars["String"]["input"];
  suggestion: Scalars["String"]["input"];
};

export type MutationSendMessageFoundPetArgs = {
  message: MessageFoundPetIn;
};

export type MutationSendOtpArgs = {
  languageId?: InputMaybe<LanguageId>;
  phone: Scalars["String"]["input"];
};

export type MutationSendOtpForgotPasswordArgs = {
  contact: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
  migrationFlow?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type MutationSendSettingArgs = {
  setting: Setting;
};

export type MutationSendTokenEmailArgs = {
  appBrand: AppBrand;
  email?: InputMaybe<Scalars["String"]["input"]>;
  languageId?: InputMaybe<LanguageId>;
};

export type MutationSetOptimizationDoneArgs = {
  productId: Scalars["String"]["input"];
};

export type MutationSetPetIsFoundArgs = {
  petId: Scalars["String"]["input"];
};

export type MutationSetPetIsLostArgs = {
  lostIn: LostIn;
  petId: Scalars["String"]["input"];
};

export type MutationSetSsoTokenArgs = {
  appBrand: AppBrand;
  pageType: PageTypeEnum;
  productId?: InputMaybe<Scalars["String"]["input"]>;
};

export type MutationSignUpUserArgs = {
  appBrand: AppBrand;
  languageId?: InputMaybe<LanguageId>;
  otpData: OtpInput;
  user: UserIn;
};

export type MutationStopRenewingAddonArgs = {
  itemPriceIds: Array<Scalars["String"]["input"]>;
  subscriptionId: Scalars["String"]["input"];
};

export type MutationStopRenewingSubscriptionArgs = {
  appBrand: AppBrand;
  cancelReason: Scalars["String"]["input"];
  cancelReasonCode: CancelReasonCodeEnum;
  subscriptionId: Scalars["String"]["input"];
};

export type MutationUpdateBillingInfoArgs = {
  updateBillingInfoInput: UpdateBillingInfoInput;
};

export type MutationUpdateEmailUserArgs = {
  appBrand: AppBrand;
  email: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
};

export type MutationUpdateEndOfLifeArgs = {
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  eolId?: InputMaybe<Scalars["String"]["input"]>;
  input?: InputMaybe<EndOfLifeIn>;
};

export type MutationUpdateGeofenceArgs = {
  geofence: UpdateGeofenceIn;
};

export type MutationUpdateNotificationSettingsArgs = {
  notificationSettings: UpdateNotificationSettingsInput;
};

export type MutationUpdatePetArgs = {
  pet: UpdatePetIn;
};

export type MutationUpdatePetProtectionDataArgs = {
  owner: PetProtectionOwnerIn;
  pet: PetProtectionPetIn;
  petProtectionId: Scalars["String"]["input"];
};

export type MutationUpdatePetlinkGpsArgs = {
  petlinkGps: UpdatePetlinkGpsIn;
};

export type MutationUpdatePhoneNumberUserArgs = {
  languageId?: InputMaybe<LanguageId>;
  otp: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
};

export type MutationUpdateUserArgs = {
  user: UpdateUserIn;
};

export type MutationUpdateUserContactArgs = {
  appBrand: AppBrand;
  contact: Scalars["String"]["input"];
  contactType: ContactType;
  userId: Scalars["String"]["input"];
};

export type MutationUtilityIntegrationTestArgs = {
  input: UtilityIntegrationTestInput;
};

export type MutationVerifyEmailArgs = {
  otp: Scalars["String"]["input"];
  uuid: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
};

export interface NewFirmwareVersion {
  __typename?: "NewFirmwareVersion";
  url: Scalars["String"]["output"];
  version: Scalars["String"]["output"];
}

export interface Notification {
  __typename?: "Notification";
  action: Scalars["String"]["output"];
  actionType: Scalars["String"]["output"];
  contact?: Maybe<Scalars["String"]["output"]>;
  data?: Maybe<Scalars["AWSJSON"]["output"]>;
  date: Scalars["String"]["output"];
  languageId?: Maybe<Scalars["String"]["output"]>;
  petId?: Maybe<Scalars["String"]["output"]>;
  productId?: Maybe<Scalars["String"]["output"]>;
  to?: Maybe<Scalars["String"]["output"]>;
  type: Scalars["String"]["output"];
  userId?: Maybe<Scalars["String"]["output"]>;
}

export interface NotificationSettings {
  __typename?: "NotificationSettings";
  email: Scalars["Boolean"]["output"];
  energySavingZone: EszNotificationPreferences;
  push: Scalars["Boolean"]["output"];
  sms: Scalars["Boolean"]["output"];
}

export interface NotificationSettingsIn {
  energySavingZone: EszNotificationPreferencesIn;
}

export interface Order {
  __typename?: "Order";
  country: Scalars["String"]["output"];
  devices: Array<Device>;
  email: Scalars["String"]["output"];
  firstName: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  lastName: Scalars["String"]["output"];
  phone: Scalars["String"]["output"];
  state?: Maybe<Scalars["String"]["output"]>;
}

export interface OtpInput {
  otp: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
}

export enum PageTypeEnum {
  Eol = "EOL",
  PaymentMethod = "PAYMENT_METHOD",
  PetProfile = "PET_PROFILE",
}

export interface Pagination {
  __typename?: "Pagination";
  currentPage: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  totalItems: Scalars["Int"]["output"];
  totalPage: Scalars["Int"]["output"];
}

export interface PaginationInput {
  pageNumber?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
}

export enum PaymentSourceStatus {
  Expired = "expired",
  Expiring = "expiring",
  Invalid = "invalid",
  PendingVerification = "pending_verification",
  Valid = "valid",
}

export enum PaymentStatusTypeEnum {
  Failed = "FAILED",
  Pending = "PENDING",
  Succeeded = "SUCCEEDED",
}

export interface Pet {
  __typename?: "Pet";
  birthDate?: Maybe<Scalars["String"]["output"]>;
  breedType: Scalars["String"]["output"];
  breeds: Array<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  dateMarkedAsLost?: Maybe<Scalars["String"]["output"]>;
  entityType: EntityTypeEnum;
  gender: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  image?: Maybe<Image>;
  length?: Maybe<Scalars["Float"]["output"]>;
  livingEnvironment?: Maybe<PetLivingEnvironment>;
  name: Scalars["String"]["output"];
  neutered?: Maybe<Scalars["Boolean"]["output"]>;
  petProtectionId?: Maybe<Scalars["String"]["output"]>;
  primaryColor?: Maybe<Scalars["String"]["output"]>;
  species: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  weight?: Maybe<Scalars["Float"]["output"]>;
}

export interface PetCheckMicrochip {
  __typename?: "PetCheckMicrochip";
  breeds: Array<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  primaryColor?: Maybe<Scalars["String"]["output"]>;
  species: Scalars["String"]["output"];
}

export interface PetHistoryEvent {
  __typename?: "PetHistoryEvent";
  creationDate: Scalars["String"]["output"];
  date: Scalars["String"]["output"];
  entityType: EntityTypeEnum;
  eventType: PetHistoryEventTypeEnum;
  extra?: Maybe<PetHistoryExtra>;
  id: Scalars["String"]["output"];
  petId: Scalars["String"]["output"];
}

export enum PetHistoryEventTypeEnum {
  ActiveSubscription = "ACTIVE_SUBSCRIPTION",
  ActiveSubscriptionTrial = "ACTIVE_SUBSCRIPTION_TRIAL",
  DeviceAssociate = "DEVICE_ASSOCIATE",
  DeviceBattery = "DEVICE_BATTERY",
  DeviceOff = "DEVICE_OFF",
  DeviceOffline = "DEVICE_OFFLINE",
  DevicePosition = "DEVICE_POSITION",
  EnergySavingZoneActive = "ENERGY_SAVING_ZONE_ACTIVE",
  EnergySavingZoneIn = "ENERGY_SAVING_ZONE_IN",
  EnergySavingZoneOut = "ENERGY_SAVING_ZONE_OUT",
  FirmwareUpdate = "FIRMWARE_UPDATE",
  GeofenceActive = "GEOFENCE_ACTIVE",
  GeofenceNoPet = "GEOFENCE_NO_PET",
  GeofenceOut = "GEOFENCE_OUT",
  HighTemperature = "HIGH_TEMPERATURE",
  LowTemperature = "LOW_TEMPERATURE",
  NoGpsSignal = "NO_GPS_SIGNAL",
  OffSubscription = "OFF_SUBSCRIPTION",
  PetBorn = "PET_BORN",
  PetFound = "PET_FOUND",
  PetProfileCreated = "PET_PROFILE_CREATED",
  PetProfileUpdated = "PET_PROFILE_UPDATED",
  QrTagScanned = "QR_TAG_SCANNED",
  RegisteredGps = "REGISTERED_GPS",
  RegisteredGpsPrepaid = "REGISTERED_GPS_PREPAID",
  Replacement = "REPLACEMENT",
  SetPetFound = "SET_PET_FOUND",
  SetPetLost = "SET_PET_LOST",
  SignalInterrupted = "SIGNAL_INTERRUPTED",
  SignalTimeout = "SIGNAL_TIMEOUT",
  WeeklyGoalAchieved = "WEEKLY_GOAL_ACHIEVED",
  WeeklyGoalAlmostReached = "WEEKLY_GOAL_ALMOST_REACHED",
}

export interface PetHistoryExtra {
  __typename?: "PetHistoryExtra";
  address?: Maybe<Scalars["String"]["output"]>;
  contentMessage?: Maybe<ContentMessage>;
  newSerialNumber?: Maybe<Scalars["String"]["output"]>;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
}

export interface PetIn {
  birthDate?: InputMaybe<Scalars["String"]["input"]>;
  breedType: BreedTypeEnum;
  breeds: Array<Scalars["String"]["input"]>;
  gender: Gender;
  imageId?: InputMaybe<Scalars["String"]["input"]>;
  livingEnvironment?: InputMaybe<PetLivingEnvironment>;
  name: Scalars["String"]["input"];
  primaryColor?: InputMaybe<Scalars["String"]["input"]>;
  species: SpeciesEnum;
  weight?: InputMaybe<Scalars["Float"]["input"]>;
}

export enum PetLivingEnvironment {
  AlwaysAtHome = "ALWAYS_AT_HOME",
  AlwaysOutdoors = "ALWAYS_OUTDOORS",
  IndoorsAndOutoors = "INDOORS_AND_OUTOORS",
}

export interface PetProtection {
  __typename?: "PetProtection";
  card?: Maybe<Card>;
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  codiceTessera?: Maybe<Scalars["String"]["output"]>;
  currencyCode: Scalars["String"]["output"];
  currentTermEnd: Scalars["String"]["output"];
  currentTermStart: Scalars["String"]["output"];
  customerServiceContact: Scalars["String"]["output"];
  fileName?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  period: Scalars["Int"]["output"];
  periodUnit: Scalars["String"]["output"];
  pet?: Maybe<PetProtectionPetData>;
  petFlag: PetProtectionFlag;
  petId?: Maybe<Scalars["String"]["output"]>;
  petOwner?: Maybe<PetProtectionOwnerData>;
  price: Scalars["Int"]["output"];
  reservedCoupon: Scalars["String"]["output"];
  reservedCouponPercent: Scalars["Int"]["output"];
  status: PetProtectionStatus;
  userId: Scalars["String"]["output"];
}

export interface PetProtectionFlag {
  __typename?: "PetProtectionFlag";
  age: Scalars["Boolean"]["output"];
  country: Scalars["Boolean"]["output"];
}

export interface PetProtectionOwnerData {
  __typename?: "PetProtectionOwnerData";
  city: Scalars["String"]["output"];
  countryCode: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  fiscalCode: Scalars["String"]["output"];
  homePhone: Scalars["String"]["output"];
  mobilePhone: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  provinceCode: Scalars["String"]["output"];
  streetAddress: Scalars["String"]["output"];
  surname: Scalars["String"]["output"];
  zipCode: Scalars["String"]["output"];
}

export interface PetProtectionOwnerIn {
  city: Scalars["String"]["input"];
  countryCode: Scalars["String"]["input"];
  email: Scalars["String"]["input"];
  fiscalCode: Scalars["String"]["input"];
  homePhone: Scalars["String"]["input"];
  mobilePhone: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  provinceCode: Scalars["String"]["input"];
  streetAddress: Scalars["String"]["input"];
  surname: Scalars["String"]["input"];
  zipCode: Scalars["String"]["input"];
}

export interface PetProtectionPetData {
  __typename?: "PetProtectionPetData";
  birthDate?: Maybe<Scalars["String"]["output"]>;
  breed: Scalars["String"]["output"];
  gender: Scalars["String"]["output"];
  microchip?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  species: Scalars["String"]["output"];
}

export interface PetProtectionPetIn {
  birthDate: Scalars["String"]["input"];
  breed: Scalars["String"]["input"];
  gender: Scalars["String"]["input"];
  microchip?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  species: Scalars["String"]["input"];
}

export enum PetProtectionStatus {
  Active = "ACTIVE",
  Cancelled = "CANCELLED",
  Expired = "EXPIRED",
  InProgress = "IN_PROGRESS",
  InReview = "IN_REVIEW",
  Open = "OPEN",
  Refunded = "REFUNDED",
  Rejected = "REJECTED",
  ToUpdate = "TO_UPDATE",
}

export interface PetlinkGps {
  __typename?: "PetlinkGps";
  countryCode?: Maybe<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  endOfLifeDevice?: Maybe<Scalars["Boolean"]["output"]>;
  entityType: EntityTypeEnum;
  geofenceCoordinates?: Maybe<Array<Maybe<Coordinates>>>;
  id: Scalars["String"]["output"];
  lastKnownPosition?: Maybe<GpsPosition>;
  lastKnownStatus?: Maybe<GpsStatus>;
  logEnabled?: Maybe<Scalars["Boolean"]["output"]>;
  newFirmwareVersion?: Maybe<NewFirmwareVersion>;
  petId: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
  settings: GpsSettings;
  subscriptionId?: Maybe<Scalars["String"]["output"]>;
  subscriptionIsActive?: Maybe<Scalars["Boolean"]["output"]>;
  timezone?: Maybe<Scalars["String"]["output"]>;
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface PetlinkGpsIn {
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  petId: Scalars["String"]["input"];
  serialNumber: Scalars["String"]["input"];
  timezone?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PetlinkMicrochip {
  __typename?: "PetlinkMicrochip";
  creationDate: Scalars["String"]["output"];
  entityType: EntityTypeEnum;
  id: Scalars["String"]["output"];
  petId: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface PetlinkMicrochipIn {
  petId: Scalars["String"]["input"];
  serialNumber: Scalars["String"]["input"];
}

export interface PetlinkQrTag {
  __typename?: "PetlinkQrTag";
  creationDate: Scalars["String"]["output"];
  entityType: EntityTypeEnum;
  id: Scalars["String"]["output"];
  petId?: Maybe<Scalars["String"]["output"]>;
  serialNumber: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface PetlinkQrTagIn {
  petId: Scalars["String"]["input"];
  serialNumber: Scalars["String"]["input"];
}

export interface PetlinkSubscription {
  __typename?: "PetlinkSubscription";
  addonToStopIds?: Maybe<Array<Scalars["String"]["output"]>>;
  billingPeriod: Scalars["Int"]["output"];
  billingPeriodUnit: Scalars["String"]["output"];
  card?: Maybe<Card>;
  currencyCode: Scalars["String"]["output"];
  currentTermEnd?: Maybe<Scalars["String"]["output"]>;
  currentTermStart?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  nextBillingAt?: Maybe<Scalars["String"]["output"]>;
  paymentStatus?: Maybe<PaymentStatusTypeEnum>;
  planChangeNotAllowed: Scalars["Boolean"]["output"];
  status: SubscriptionStatusEnum;
  subscriptionItems: Array<PetlinkSubscriptionItem>;
}

export interface PetlinkSubscriptionItem {
  __typename?: "PetlinkSubscriptionItem";
  amount: Scalars["Int"]["output"];
  itemId: Scalars["String"]["output"];
  itemPriceId: Scalars["String"]["output"];
  itemType: Scalars["String"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  quantity: Scalars["Int"]["output"];
  unitPrice: Scalars["Int"]["output"];
}

export interface Plan {
  __typename?: "Plan";
  itemId: Scalars["String"]["output"];
  pricings: Array<Maybe<Pricing>>;
}

export interface Position {
  lat: Scalars["Float"]["input"];
  lng: Scalars["Float"]["input"];
}

export enum PositionType {
  Ble = "BLE",
  Gps = "GPS",
  Lbs = "LBS",
  Skip = "SKIP",
  Wifi = "WIFI",
}

export interface Post {
  __typename?: "Post";
  countId: Scalars["Int"]["output"];
  description: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  imageUrl?: Maybe<Scalars["String"]["output"]>;
  petType?: Maybe<Scalars["String"]["output"]>;
  templateId: Scalars["String"]["output"];
  title: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface Pricing {
  __typename?: "Pricing";
  addonPricings?: Maybe<Array<Maybe<AddonPricing>>>;
  currencyCode: Scalars["String"]["output"];
  externalName?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  itemFamilyId?: Maybe<Scalars["String"]["output"]>;
  itemId: Scalars["String"]["output"];
  itemType?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  period?: Maybe<Scalars["Float"]["output"]>;
  periodUnit?: Maybe<Scalars["String"]["output"]>;
  price?: Maybe<Scalars["Float"]["output"]>;
  status?: Maybe<Scalars["String"]["output"]>;
  trialPeriod?: Maybe<Scalars["Int"]["output"]>;
  trialPeriodUnit?: Maybe<Scalars["String"]["output"]>;
}

export interface Product {
  __typename?: "Product";
  brand?: Maybe<AppBrand>;
  creationDate: Scalars["String"]["output"];
  endOfLifeDevice?: Maybe<Scalars["Boolean"]["output"]>;
  entityType: ProductTypeEnum;
  id: Scalars["String"]["output"];
  lastKnownPosition?: Maybe<GpsPosition>;
  /**  TODO remove */
  lastKnownStatus?: Maybe<GpsStatus>;
  petId: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
  /**  TODO remove */
  subscriptionIsActive?: Maybe<Scalars["Boolean"]["output"]>;
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export enum ProductTypeEnum {
  PetlinkGps = "PETLINK_GPS",
  PetlinkMicrochip = "PETLINK_MICROCHIP",
  PetlinkQrTag = "PETLINK_QR_TAG",
}

export interface Promotion {
  __typename?: "Promotion";
  billingPeriod: Scalars["Int"]["output"];
  billingPeriodUnit: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  price: Scalars["Float"]["output"];
  type: PromotionTypeEnum;
}

export interface PromotionInput {
  id: Scalars["String"]["input"];
  type: PromotionTypeEnum;
}

export enum PromotionTypeEnum {
  Addon = "ADDON",
}

export interface PurchasedService {
  __typename?: "PurchasedService";
  card?: Maybe<Card>;
  creationDate: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  currentTermEnd?: Maybe<Scalars["String"]["output"]>;
  currentTermStart?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  invoice?: Maybe<InvoiceShortInfo>;
  paymentStatus?: Maybe<PaymentStatusTypeEnum>;
  subscriptionStatus?: Maybe<SubscriptionStatusEnum>;
}

export interface Query {
  __typename?: "Query";
  changeSubscriptionPlan: ResponseChangeSubscriptionPlan;
  checkContact: Response;
  checkGps: ResponseCheckGps;
  checkMicrochip: ResponseCheckMicrochip;
  checkoutAddons: ResponseCheckoutAddons;
  checkoutCareProtection: ResponseCheckoutCareProtection;
  checkoutEOLNewDevice: ResponseCheckoutEolNewDevice;
  checkoutNewSubscription: ResponseCheckoutNewSubscription;
  checkoutPrepaid: ResponseCheckoutNewSubscription;
  churnDeflection: ResponseChurnDeflection;
  getActiveSubscriptions: ResponseActiveSubscriptions;
  getActivities: ResponseActivities;
  /**   TODO: rename in dog */
  getActivitiesAverage?: Maybe<ResponseActivities>;
  getActivitiesAverageCat?: Maybe<ResponseActivitiesAverageCat>;
  /**   TODO: rename in dog */
  getActivitiesByHour: ResponseActivitiesByHour;
  /**   TODO: rename in dog */
  getActivitiesCat: ResponseActivitiesCat;
  getBillingInfo: ResponseBillingInfo;
  getBreed: ResponseGetBreed;
  getColors: ResponseGetColors;
  getCountryState: ResponseGetCountryState;
  getDictionary: ResponseGetDictionary;
  /**   end of life */
  getEndOfLifeStep: ResponseGetEndOfLifeStep;
  getEnergySavingZone: ResponseEnergySavingZone;
  getEnergySavingZones: ResponseEnergySavingZones;
  /**   getGeofence(id: String!): ResponseGeofence! @aws_cognito_user_pools @aws_iam */
  getGeofences: ResponseGeofences;
  getGpsPromotions: ResponseGetGpsPromotions;
  getLogUploadUrl: ResponseGetLogUploadUrl;
  getNotificationsHistory: ResponseNotificationsHistory;
  getOrder?: Maybe<ResponseGetOrder>;
  getPaymentSource: ResponseGetPaymentSource;
  getPet: ResponsePet;
  getPetByQrTag: ResponsePetByQrTag;
  getPetHistory: ResponsePetHistory;
  getPetLostInfo: ResponseGetPetLostInfo;
  getPetProtection: ResponseGetPetProtection;
  getPetlinkGps: ResponsePetlinkGps;
  getPetlinkMicrochip: ResponsePetlinkMicrochip;
  getPetlinkQrTag: ResponsePetlinkQrTag;
  getPets: ResponsePets;
  getPetsAndProducts: ResponsePetsAndProducts;
  getPlansEOL: ResponseGetPlansEol;
  getPositionsHistory: ResponsePositionsHistory;
  getPositionsHistoryDates?: Maybe<ResponsePositionsHistoryDates>;
  getPosts: ResponseGetPosts;
  getProduct: ResponseProduct;
  getProducts: ResponseProducts;
  getProtectionPlans: ResponseProtectionPlans;
  getPurchasedServices: ResponseGetPurchasedServices;
  getS3UploadUrl: ResponseS3Upload;
  /**  sso */
  getSsoToken: ResponseSsoToken;
  getSubscriptionByProductId: ResponseGetSubscriptionByProductId;
  getSubscriptionPlanPricing: ResponseSubscriptionPlanPricing;
  getSubscriptionPlans: ResponseSubscriptionPlans;
  getSubscriptions: ResponseGetSubscriptions;
  getUser: ResponseUser;
}

export type QueryChangeSubscriptionPlanArgs = {
  hostedPageOptions?: InputMaybe<HostedPageOptionsInput>;
  priceIds: Array<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
};

export type QueryCheckContactArgs = {
  contact: Scalars["String"]["input"];
  contactType: ContactType;
};

export type QueryCheckGpsArgs = {
  serialNumber: Scalars["String"]["input"];
};

export type QueryCheckMicrochipArgs = {
  microchip: Scalars["String"]["input"];
};

export type QueryCheckoutAddonsArgs = {
  hostedPageOptions?: InputMaybe<HostedPageOptionsInput>;
  priceIds: Array<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
  subscriptionId: Scalars["String"]["input"];
};

export type QueryCheckoutCareProtectionArgs = {
  hostedPageOptions?: InputMaybe<HostedPageOptionsInput>;
  priceIds: Array<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
};

export type QueryCheckoutEolNewDeviceArgs = {
  eolId: Scalars["String"]["input"];
};

export type QueryCheckoutNewSubscriptionArgs = {
  hostedPageOptions?: InputMaybe<HostedPageOptionsInput>;
  priceIds: Array<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
};

export type QueryCheckoutPrepaidArgs = {
  appBrand?: InputMaybe<AppBrand>;
  hostedPageOptions?: InputMaybe<HostedPageOptionsInput>;
  orderId: Scalars["String"]["input"];
  priceIds: Array<Scalars["String"]["input"]>;
  serialNumber: Scalars["String"]["input"];
};

export type QueryChurnDeflectionArgs = {
  cancelUrl: Scalars["String"]["input"];
  redirectUrl: Scalars["String"]["input"];
  subscriptionId: Scalars["String"]["input"];
};

export type QueryGetActiveSubscriptionsArgs = {
  subscriptionsIds?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type QueryGetActivitiesArgs = {
  from: Scalars["Int"]["input"];
  petId: Scalars["String"]["input"];
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
  to: Scalars["Int"]["input"];
};

export type QueryGetActivitiesAverageArgs = {
  from: Scalars["Int"]["input"];
  petId: Scalars["String"]["input"];
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
  to: Scalars["Int"]["input"];
};

export type QueryGetActivitiesAverageCatArgs = {
  from: Scalars["Int"]["input"];
  petId: Scalars["String"]["input"];
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
  to: Scalars["Int"]["input"];
};

export type QueryGetActivitiesByHourArgs = {
  from: Scalars["Int"]["input"];
  petId: Scalars["String"]["input"];
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
  to: Scalars["Int"]["input"];
};

export type QueryGetActivitiesCatArgs = {
  from: Scalars["Int"]["input"];
  petId: Scalars["String"]["input"];
  to: Scalars["Int"]["input"];
  weekIndex: Scalars["Int"]["input"];
};

export type QueryGetBreedArgs = {
  languageId?: InputMaybe<LanguageId>;
  species: SpeciesEnum;
};

export type QueryGetColorsArgs = {
  languageId?: InputMaybe<LanguageId>;
  species: SpeciesEnum;
};

export type QueryGetCountryStateArgs = {
  countryId?: InputMaybe<Scalars["String"]["input"]>;
  languageId?: InputMaybe<LanguageId>;
};

export type QueryGetDictionaryArgs = {
  appBrand: AppBrand;
  languageId?: InputMaybe<LanguageId>;
};

export type QueryGetEndOfLifeStepArgs = {
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  eolId?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetEnergySavingZoneArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetGpsPromotionsArgs = {
  productId: Scalars["String"]["input"];
};

export type QueryGetLogUploadUrlArgs = {
  deviceId: Scalars["String"]["input"];
  fileName: Scalars["String"]["input"];
};

export type QueryGetNotificationsHistoryArgs = {
  from?: InputMaybe<Scalars["String"]["input"]>;
  to?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetOrderArgs = {
  orderId: Scalars["String"]["input"];
};

export type QueryGetPetArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetPetByQrTagArgs = {
  serialNumber: Scalars["String"]["input"];
};

export type QueryGetPetHistoryArgs = {
  petId: Scalars["String"]["input"];
};

export type QueryGetPetLostInfoArgs = {
  petId: Scalars["String"]["input"];
};

export type QueryGetPetProtectionArgs = {
  petProtectionId: Scalars["String"]["input"];
};

export type QueryGetPetlinkGpsArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetPetlinkMicrochipArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetPetlinkQrTagArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetPlansEolArgs = {
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  productId: Scalars["String"]["input"];
};

export type QueryGetPositionsHistoryArgs = {
  from?: InputMaybe<Scalars["String"]["input"]>;
  petId: Scalars["String"]["input"];
  to?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetPositionsHistoryDatesArgs = {
  from?: InputMaybe<Scalars["String"]["input"]>;
  petId: Scalars["String"]["input"];
  to?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetPostsArgs = {
  languageId?: InputMaybe<Scalars["String"]["input"]>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetProductArgs = {
  entityType: ProductTypeEnum;
  id: Scalars["String"]["input"];
};

export type QueryGetProductsArgs = {
  petId: Scalars["String"]["input"];
};

export type QueryGetProtectionPlansArgs = {
  petId: Scalars["String"]["input"];
};

export type QueryGetPurchasedServicesArgs = {
  productId: Scalars["String"]["input"];
};

export type QueryGetS3UploadUrlArgs = {
  fileName: Scalars["String"]["input"];
};

export type QueryGetSsoTokenArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetSubscriptionByProductIdArgs = {
  productId: Scalars["String"]["input"];
};

export type QueryGetSubscriptionPlanPricingArgs = {
  addonPriceIds?: InputMaybe<Array<Scalars["String"]["input"]>>;
  careProtectionPlanId?: InputMaybe<Scalars["String"]["input"]>;
  countryCode: Scalars["String"]["input"];
  planPriceId: Scalars["String"]["input"];
  productId: Scalars["String"]["input"];
};

export type QueryGetSubscriptionPlansArgs = {
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  productId?: InputMaybe<Scalars["String"]["input"]>;
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetSubscriptionsArgs = {
  productId: Scalars["String"]["input"];
};

export interface Response {
  __typename?: "Response";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseActiveSubscriptions {
  __typename?: "ResponseActiveSubscriptions";
  activeSubscriptions?: Maybe<Array<Maybe<Scalars["String"]["output"]>>>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseActivities {
  __typename?: "ResponseActivities";
  activityReport?: Maybe<ActivityReport>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseActivitiesAverageCat {
  __typename?: "ResponseActivitiesAverageCat";
  activityReport?: Maybe<ActivityReportAverageCat>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseActivitiesByHour {
  __typename?: "ResponseActivitiesByHour";
  activities?: Maybe<Array<Activities>>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseActivitiesCat {
  __typename?: "ResponseActivitiesCat";
  activityReport?: Maybe<ActivityReportCat>;
  code: Scalars["String"]["output"];
  highlights?: Maybe<Highlights>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseBillingInfo {
  __typename?: "ResponseBillingInfo";
  billingInfo?: Maybe<BillingInfo>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseChangeSubscriptionPlan {
  __typename?: "ResponseChangeSubscriptionPlan";
  checkoutId?: Maybe<Scalars["String"]["output"]>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckGps {
  __typename?: "ResponseCheckGps";
  brand?: Maybe<Scalars["String"]["output"]>;
  code: Scalars["String"]["output"];
  firmwareVersion?: Maybe<Scalars["String"]["output"]>;
  idccd?: Maybe<Scalars["String"]["output"]>;
  imei?: Maybe<Scalars["String"]["output"]>;
  message: Scalars["String"]["output"];
  model?: Maybe<Scalars["String"]["output"]>;
  planProfileId?: Maybe<Scalars["String"]["output"]>;
  simRequestedStatus?: Maybe<Scalars["String"]["output"]>;
  simStatus?: Maybe<Scalars["String"]["output"]>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckMicrochip {
  __typename?: "ResponseCheckMicrochip";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pet?: Maybe<PetCheckMicrochip>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckoutAddons {
  __typename?: "ResponseCheckoutAddons";
  checkoutId?: Maybe<Scalars["String"]["output"]>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckoutCareProtection {
  __typename?: "ResponseCheckoutCareProtection";
  checkoutId?: Maybe<Scalars["String"]["output"]>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckoutEolNewDevice {
  __typename?: "ResponseCheckoutEOLNewDevice";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCheckoutNewSubscription {
  __typename?: "ResponseCheckoutNewSubscription";
  checkoutId?: Maybe<Scalars["String"]["output"]>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseChurnDeflection {
  __typename?: "ResponseChurnDeflection";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseCreatePetlinkGps {
  __typename?: "ResponseCreatePetlinkGps";
  code: Scalars["String"]["output"];
  currentTermEnd?: Maybe<Scalars["String"]["output"]>;
  message: Scalars["String"]["output"];
  petlinkGps?: Maybe<PetlinkGps>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseEnergySavingZone {
  __typename?: "ResponseEnergySavingZone";
  code: Scalars["String"]["output"];
  energySavingZone?: Maybe<EnergySavingZone>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseEnergySavingZones {
  __typename?: "ResponseEnergySavingZones";
  code: Scalars["String"]["output"];
  energySavingZones?: Maybe<Array<EnergySavingZone>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGeofence {
  __typename?: "ResponseGeofence";
  code: Scalars["String"]["output"];
  geofence?: Maybe<Geofence>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGeofences {
  __typename?: "ResponseGeofences";
  code: Scalars["String"]["output"];
  geofences?: Maybe<Array<Geofence>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetBreed {
  __typename?: "ResponseGetBreed";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<Breed>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetColors {
  __typename?: "ResponseGetColors";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<Color>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetCountryState {
  __typename?: "ResponseGetCountryState";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<CountryState>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetDictionary {
  __typename?: "ResponseGetDictionary";
  code: Scalars["String"]["output"];
  dictionary: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetEndOfLifeStep {
  __typename?: "ResponseGetEndOfLifeStep";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  step?: Maybe<Scalars["String"]["output"]>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetGpsPromotions {
  __typename?: "ResponseGetGpsPromotions";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  promotions?: Maybe<Array<Maybe<Promotion>>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetLogUploadUrl {
  __typename?: "ResponseGetLogUploadUrl";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  uploadData?: Maybe<UploadData>;
}

export interface ResponseGetOrder {
  __typename?: "ResponseGetOrder";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  order?: Maybe<Order>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetPaymentSource {
  __typename?: "ResponseGetPaymentSource";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  status?: Maybe<PaymentSourceStatus>;
}

export interface ResponseGetPetLostInfo {
  __typename?: "ResponseGetPetLostInfo";
  code: Scalars["String"]["output"];
  lostInfo?: Maybe<LostInfo>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetPetProtection {
  __typename?: "ResponseGetPetProtection";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petProtection?: Maybe<PetProtection>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetPlansEol {
  __typename?: "ResponseGetPlansEOL";
  code: Scalars["String"]["output"];
  devicePrice?: Maybe<Array<DevicePrice>>;
  endOfLife?: Maybe<EndOfLife>;
  message: Scalars["String"]["output"];
  plans?: Maybe<Array<Plan>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetPosts {
  __typename?: "ResponseGetPosts";
  code: Scalars["String"]["output"];
  items: Array<Post>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetPurchasedServices {
  __typename?: "ResponseGetPurchasedServices";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  purchasedServices?: Maybe<Array<PurchasedService>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetSubscriptionByProductId {
  __typename?: "ResponseGetSubscriptionByProductId";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  subscription?: Maybe<PetlinkSubscription>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetSubscriptions {
  __typename?: "ResponseGetSubscriptions";
  code: Scalars["String"]["output"];
  currentSubscription?: Maybe<CurrentSubscription>;
  message: Scalars["String"]["output"];
  subscriptions?: Maybe<Array<SubscriptionShortInfo>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseManagePaymentSources {
  __typename?: "ResponseManagePaymentSources";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseNotificationSettings {
  __typename?: "ResponseNotificationSettings";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  notificationSettings?: Maybe<NotificationSettings>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseNotificationsHistory {
  __typename?: "ResponseNotificationsHistory";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  notifications?: Maybe<Array<Notification>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseOtp {
  __typename?: "ResponseOtp";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  resendAt?: Maybe<Scalars["Float"]["output"]>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  verificationId?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePet {
  __typename?: "ResponsePet";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pet?: Maybe<Pet>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePetByQrTag {
  __typename?: "ResponsePetByQrTag";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pet?: Maybe<Pet>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface ResponsePetHistory {
  __typename?: "ResponsePetHistory";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petHistory?: Maybe<Array<PetHistoryEvent>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePetlinkGps {
  __typename?: "ResponsePetlinkGps";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petlinkGps?: Maybe<PetlinkGps>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePetlinkMicrochip {
  __typename?: "ResponsePetlinkMicrochip";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petlinkMicrochip?: Maybe<PetlinkMicrochip>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePetlinkQrTag {
  __typename?: "ResponsePetlinkQrTag";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petlinkQrTag?: Maybe<PetlinkQrTag>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePets {
  __typename?: "ResponsePets";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pets?: Maybe<Array<Pet>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePetsAndProducts {
  __typename?: "ResponsePetsAndProducts";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pets?: Maybe<Array<Pet>>;
  products?: Maybe<Array<Product>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePositionsHistory {
  __typename?: "ResponsePositionsHistory";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  positions?: Maybe<Array<GpsPosition>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponsePositionsHistoryDates {
  __typename?: "ResponsePositionsHistoryDates";
  code: Scalars["String"]["output"];
  dates?: Maybe<Array<Maybe<Scalars["String"]["output"]>>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseProduct {
  __typename?: "ResponseProduct";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  product?: Maybe<Product>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  verificationId?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseProducts {
  __typename?: "ResponseProducts";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  products?: Maybe<Array<Product>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseProtectionPlans {
  __typename?: "ResponseProtectionPlans";
  careProtectionPlans?: Maybe<Array<CareProtectionPlan>>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseReplacement {
  __typename?: "ResponseReplacement";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  product?: Maybe<Product>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseS3Upload {
  __typename?: "ResponseS3Upload";
  code: Scalars["String"]["output"];
  command?: Maybe<Array<Scalars["String"]["output"]>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  uploadData?: Maybe<UploadData>;
}

export interface ResponseSendSetting {
  __typename?: "ResponseSendSetting";
  code: Scalars["String"]["output"];
  energySavingZone?: Maybe<EnergySavingZone>;
  message: Scalars["String"]["output"];
  petlinkGps?: Maybe<PetlinkGps>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseSetPetIsFound {
  __typename?: "ResponseSetPetIsFound";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseSetPetIsLost {
  __typename?: "ResponseSetPetIsLost";
  code: Scalars["String"]["output"];
  lostInfo?: Maybe<LostInfo>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseSsoToken {
  __typename?: "ResponseSsoToken";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  ssoToken?: Maybe<Scalars["String"]["output"]>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseSsoUrl {
  __typename?: "ResponseSsoUrl";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseSubscriptionPlanPricing {
  __typename?: "ResponseSubscriptionPlanPricing";
  careProtectionPricing?: Maybe<Pricing>;
  code: Scalars["String"]["output"];
  coupon?: Maybe<Coupon>;
  message: Scalars["String"]["output"];
  paymentMethodRequired?: Maybe<Scalars["Boolean"]["output"]>;
  pricing?: Maybe<Pricing>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  trialDuration?: Maybe<Scalars["Int"]["output"]>;
}

export interface ResponseSubscriptionPlans {
  __typename?: "ResponseSubscriptionPlans";
  careProtectionPlans?: Maybe<Array<CareProtectionPlan>>;
  code: Scalars["String"]["output"];
  coupon?: Maybe<Coupon>;
  message: Scalars["String"]["output"];
  paymentMethodRequired?: Maybe<Scalars["Boolean"]["output"]>;
  plans?: Maybe<Array<Plan>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
  trialDuration?: Maybe<Scalars["Int"]["output"]>;
}

export interface ResponseUpdateEndOfLife {
  __typename?: "ResponseUpdateEndOfLife";
  code: Scalars["String"]["output"];
  endOfLife?: Maybe<EndOfLife>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseUpdatePaymentSources {
  __typename?: "ResponseUpdatePaymentSources";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseUpdatePetProtectionData {
  __typename?: "ResponseUpdatePetProtectionData";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  petProtection?: Maybe<PetProtection>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseUser {
  __typename?: "ResponseUser";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface ResponseUtilityIntegrationTest {
  __typename?: "ResponseUtilityIntegrationTest";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  userId?: Maybe<Scalars["String"]["output"]>;
}

export interface RetentionDiscountItem {
  __typename?: "RetentionDiscountItem";
  amount?: Maybe<Scalars["Float"]["output"]>;
  couponId: Scalars["String"]["output"];
  couponName: Scalars["String"]["output"];
  discountPercentage?: Maybe<Scalars["Float"]["output"]>;
  discountType: Scalars["String"]["output"];
}

export interface Setting {
  createObject?: InputMaybe<Scalars["AWSJSON"]["input"]>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  geofence?: InputMaybe<Array<InputMaybe<CoordinatesIn>>>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  modeType?: InputMaybe<ModeType>;
  operationType: SettingOperationEnum;
  settingType: SettingTypeEnum;
  /**   id and deviceId both used for activation ESZ and eventually others */
  updateObject?: InputMaybe<Scalars["AWSJSON"]["input"]>;
}

export enum SettingOperationEnum {
  Activate = "ACTIVATE",
  Create = "CREATE",
  Deactivate = "DEACTIVATE",
  Delete = "DELETE",
  Update = "UPDATE",
}

export enum SettingTypeEnum {
  EnergySavingZone = "ENERGY_SAVING_ZONE",
  Geofence = "GEOFENCE",
  UpdateFrequency = "UPDATE_FREQUENCY",
}

export interface ShippingInfo {
  __typename?: "ShippingInfo";
  address: Scalars["String"]["output"];
  city: Scalars["String"]["output"];
  country: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  firstName: Scalars["String"]["output"];
  lastName: Scalars["String"]["output"];
  phone: Scalars["String"]["output"];
  state?: Maybe<Scalars["String"]["output"]>;
  stateCode?: Maybe<Scalars["String"]["output"]>;
  zip: Scalars["String"]["output"];
}

export interface ShippingInfoIn {
  address: Scalars["String"]["input"];
  city: Scalars["String"]["input"];
  country: Scalars["String"]["input"];
  email: Scalars["String"]["input"];
  firstName: Scalars["String"]["input"];
  lastName: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
  state: Scalars["String"]["input"];
  stateCode?: InputMaybe<Scalars["String"]["input"]>;
  zip: Scalars["String"]["input"];
}

export enum SpeciesEnum {
  Cat = "CAT",
  Dog = "DOG",
  Other = "OTHER",
}

export enum StatusState {
  Error = "ERROR",
  Off = "OFF",
  On = "ON",
  Requested = "REQUESTED",
}

export interface Subscription {
  __typename?: "Subscription";
  onForceClearCache?: Maybe<ClearCacheMessageStatus>;
  onGpsMessagePosition?: Maybe<GpsMessagePosition>;
  onGpsMessageStatus?: Maybe<GpsMessageStatus>;
  onSendingOtp?: Maybe<ResponseOtp>;
  onSubscriptionStatus?: Maybe<SubscriptionMessageStatus>;
}

export type SubscriptionOnForceClearCacheArgs = {
  id: Scalars["String"]["input"];
};

export type SubscriptionOnGpsMessagePositionArgs = {
  id: Scalars["String"]["input"];
};

export type SubscriptionOnGpsMessageStatusArgs = {
  id: Scalars["String"]["input"];
};

export type SubscriptionOnSendingOtpArgs = {
  verificationId?: InputMaybe<Scalars["String"]["input"]>;
};

export type SubscriptionOnSubscriptionStatusArgs = {
  id: Scalars["String"]["input"];
};

export interface SubscriptionMessageStatus {
  __typename?: "SubscriptionMessageStatus";
  id: Scalars["String"]["output"];
  status: SubscriptionStatus;
}

export interface SubscriptionMessageStatusIn {
  id: Scalars["String"]["input"];
  status: SubscriptionStatusIn;
}

export interface SubscriptionShortInfo {
  __typename?: "SubscriptionShortInfo";
  addonToStopIds?: Maybe<Array<Scalars["String"]["output"]>>;
  billingPeriod: Scalars["Int"]["output"];
  billingPeriodUnit: Scalars["String"]["output"];
  businessEntityId: Scalars["String"]["output"];
  card?: Maybe<Card>;
  creationDate: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  currentTermEnd?: Maybe<Scalars["String"]["output"]>;
  currentTermStart?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  invoice?: Maybe<InvoiceShortInfo>;
  paymentStatus?: Maybe<PaymentStatusTypeEnum>;
  planChangeNotAllowed: Scalars["Boolean"]["output"];
  retentionCoupon?: Maybe<RetentionDiscountItem>;
  status: SubscriptionStatusEnum;
  subscriptionItems: Array<SubscriptionShortInfoItem>;
  totalAmount: Scalars["Float"]["output"];
}

export interface SubscriptionShortInfoItem {
  __typename?: "SubscriptionShortInfoItem";
  amount: Scalars["Float"]["output"];
  itemId: Scalars["String"]["output"];
  itemPriceId: Scalars["String"]["output"];
  itemType: Scalars["String"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  quantity: Scalars["Float"]["output"];
  unitPrice: Scalars["Float"]["output"];
}

export interface SubscriptionStatus {
  __typename?: "SubscriptionStatus";
  currentTermEnd: Scalars["String"]["output"];
  productId: Scalars["String"]["output"];
  subscriptionIsActive: Scalars["Boolean"]["output"];
}

export enum SubscriptionStatusEnum {
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

export interface SubscriptionStatusIn {
  currentTermEnd: Scalars["String"]["input"];
  productId: Scalars["String"]["input"];
  subscriptionIsActive: Scalars["Boolean"]["input"];
}

export interface UpdateBillingInfoInput {
  billingInfo: BillingInfoInput;
  email: Scalars["String"]["input"];
  firstName: Scalars["String"]["input"];
  lastName: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
}

export interface UpdateEnergySavingZoneIn {
  bssid: Scalars["String"]["input"];
  entityType: EntityTypeEnum;
  icon: Scalars["String"]["input"];
  id: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  position: CoordinatesIn;
  radius: Scalars["Float"]["input"];
  ssid: Scalars["String"]["input"];
}

export interface UpdateGeofenceIn {
  id: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  position: Array<CoordinatesIn>;
}

export interface UpdateNotificationSettingsInput {
  energySavingZone: EszNotificationsInput;
}

export interface UpdatePetIn {
  birthDate?: InputMaybe<Scalars["String"]["input"]>;
  breedType?: InputMaybe<BreedTypeEnum>;
  breeds?: InputMaybe<Array<Scalars["String"]["input"]>>;
  gender?: InputMaybe<Gender>;
  id: Scalars["String"]["input"];
  imageId?: InputMaybe<Scalars["String"]["input"]>;
  length?: InputMaybe<Scalars["Float"]["input"]>;
  livingEnvironment?: InputMaybe<PetLivingEnvironment>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  neutered?: InputMaybe<Scalars["Boolean"]["input"]>;
  primaryColor?: InputMaybe<Scalars["String"]["input"]>;
  species?: InputMaybe<SpeciesEnum>;
  weight?: InputMaybe<Scalars["Float"]["input"]>;
}

export interface UpdatePetlinkGpsIn {
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["String"]["input"];
  settings?: InputMaybe<GpsSettingsIn>;
  timezone?: InputMaybe<Scalars["String"]["input"]>;
}

export interface UpdateUserIn {
  birthDate?: InputMaybe<Scalars["String"]["input"]>;
  city: Scalars["String"]["input"];
  countryCode: Scalars["String"]["input"];
  gender?: InputMaybe<Gender>;
  id: Scalars["String"]["input"];
  imageId?: InputMaybe<Scalars["String"]["input"]>;
  languageId: LanguageId;
  name: Scalars["String"]["input"];
  notificationSettings?: InputMaybe<NotificationSettingsIn>;
  settings?: InputMaybe<UserSettingsIn>;
  stateCode?: InputMaybe<Scalars["String"]["input"]>;
  streetAddress?: InputMaybe<Scalars["String"]["input"]>;
  surname: Scalars["String"]["input"];
  timezone?: InputMaybe<Scalars["String"]["input"]>;
  zipCode?: InputMaybe<Scalars["String"]["input"]>;
}

export interface UploadData {
  __typename?: "UploadData";
  id: Scalars["String"]["output"];
  url: Scalars["String"]["output"];
}

export interface User {
  __typename?: "User";
  appBrand: AppBrand;
  arcaPlanetTerms?: Maybe<Scalars["Boolean"]["output"]>;
  birthDate?: Maybe<Scalars["String"]["output"]>;
  chargebeeId?: Maybe<Scalars["String"]["output"]>;
  city?: Maybe<Scalars["String"]["output"]>;
  contactVerified?: Maybe<ContactVerified>;
  countryCode: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  entityType: EntityTypeEnum;
  forceSetPhoneNumber?: Maybe<Scalars["Boolean"]["output"]>;
  gender?: Maybe<Gender>;
  haveMicrochip?: Maybe<Scalars["Boolean"]["output"]>;
  id: Scalars["String"]["output"];
  image?: Maybe<Image>;
  languageId: LanguageId;
  migrated?: Maybe<Scalars["Boolean"]["output"]>;
  mobileDevices?: Maybe<Array<MobileDevice>>;
  name: Scalars["String"]["output"];
  notificationSettings: NotificationSettings;
  phone: Scalars["String"]["output"];
  readPopupMigrated?: Maybe<Scalars["Boolean"]["output"]>;
  safetyTermsCat?: Maybe<Scalars["Boolean"]["output"]>;
  settings: UserSettings;
  stateCode?: Maybe<Scalars["String"]["output"]>;
  streetAddress?: Maybe<Scalars["String"]["output"]>;
  surname: Scalars["String"]["output"];
  timezone?: Maybe<Scalars["String"]["output"]>;
  updateDate: Scalars["String"]["output"];
  zipCode?: Maybe<Scalars["String"]["output"]>;
}

export interface UserIn {
  city: Scalars["String"]["input"];
  confirmPassword: Scalars["String"]["input"];
  countryCode: Scalars["String"]["input"];
  email: Scalars["String"]["input"];
  languageId: LanguageId;
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
  stateCode?: InputMaybe<Scalars["String"]["input"]>;
  streetAddress?: InputMaybe<Scalars["String"]["input"]>;
  surname: Scalars["String"]["input"];
  timezone?: InputMaybe<Scalars["String"]["input"]>;
  zipCode?: InputMaybe<Scalars["String"]["input"]>;
}

export interface UserSettings {
  __typename?: "UserSettings";
  liveDistance: Scalars["Boolean"]["output"];
  liveSpeed: Scalars["Boolean"]["output"];
  liveTrack: Scalars["Boolean"]["output"];
}

export interface UserSettingsIn {
  liveDistance: Scalars["Boolean"]["input"];
  liveSpeed: Scalars["Boolean"]["input"];
  liveTrack: Scalars["Boolean"]["input"];
}

export interface UtilityIntegrationTestCardInput {
  cardNumber: Scalars["String"]["input"];
  cvv: Scalars["String"]["input"];
  expiryMonth: Scalars["Int"]["input"];
  expiryYear: Scalars["Int"]["input"];
}

export interface UtilityIntegrationTestInput {
  appBrand?: InputMaybe<AppBrand>;
  card?: InputMaybe<UtilityIntegrationTestCardInput>;
  currencyCode?: InputMaybe<Scalars["String"]["input"]>;
  isOnlyProtection?: InputMaybe<Scalars["Boolean"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  priceIds?: InputMaybe<Array<Scalars["String"]["input"]>>;
  productId?: InputMaybe<Scalars["String"]["input"]>;
  userIn?: InputMaybe<UserIn>;
  utilityType: UtilityTestTypeEnum;
}

export enum UtilityTestTypeEnum {
  BuyNewSubscription = "BUY_NEW_SUBSCRIPTION",
  CleanUpUser = "CLEAN_UP_USER",
  SignUp = "SIGN_UP",
}

export enum ValidationStatusEnum {
  Invalid = "invalid",
  NotValidated = "not_validated",
  PartiallyValid = "partially_valid",
  Valid = "valid",
}

export type SendOtpMutationVariables = Exact<{
  phone: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
}>;

export type SendOtpMutation = {
  __typename?: "Mutation";
  sendOtp: { __typename?: "ResponseOtp"; code: string; translationCode?: string | null; message: string; verificationId?: string | null };
};

export type CheckOtpMutationVariables = Exact<{
  verificationId: Scalars["String"]["input"];
  otp: Scalars["String"]["input"];
  contact: Scalars["String"]["input"];
}>;

export type CheckOtpMutation = {
  __typename?: "Mutation";
  checkOtp: { __typename?: "ResponseOtp"; code: string; translationCode?: string | null; message: string; verificationId?: string | null };
};

export type SignUpUserMutationVariables = Exact<{
  user: UserIn;
  otpData: OtpInput;
  languageId?: InputMaybe<LanguageId>;
  appBrand: AppBrand;
}>;

export type SignUpUserMutation = {
  __typename?: "Mutation";
  signUpUser: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type UtilityIntegrationTestMutationVariables = Exact<{
  input: UtilityIntegrationTestInput;
}>;

export type UtilityIntegrationTestMutation = {
  __typename?: "Mutation";
  utilityIntegrationTest: { __typename?: "ResponseUtilityIntegrationTest"; code: string; message: string };
};

export type VerifyEmailMutationVariables = Exact<{
  verificationId: Scalars["String"]["input"];
  otp: Scalars["String"]["input"];
  uuid: Scalars["String"]["input"];
}>;

export type VerifyEmailMutation = {
  __typename?: "Mutation";
  verifyEmail?: { __typename?: "Response"; code: string; translationCode?: string | null; message: string } | null;
};

export type CreatePetMutationVariables = Exact<{
  pet: PetIn;
}>;

export type CreatePetMutation = {
  __typename?: "Mutation";
  createPet: {
    __typename?: "ResponsePet";
    code: string;
    translationCode?: string | null;
    message: string;
    pet?: {
      __typename?: "Pet";
      id: string;
      entityType: EntityTypeEnum;
      name: string;
      birthDate?: string | null;
      species: string;
      breedType: string;
      breeds: Array<string>;
      gender: string;
      primaryColor?: string | null;
      weight?: number | null;
      userId: string;
      creationDate: string;
      updateDate: string;
      neutered?: boolean | null;
      livingEnvironment?: PetLivingEnvironment | null;
      length?: number | null;
      dateMarkedAsLost?: string | null;
      petProtectionId?: string | null;
      image?: { __typename?: "Image"; id: string; url?: string | null } | null;
    } | null;
  };
};

export type UpdatePetMutationVariables = Exact<{
  pet: UpdatePetIn;
}>;

export type UpdatePetMutation = {
  __typename?: "Mutation";
  updatePet: {
    __typename?: "ResponsePet";
    code: string;
    translationCode?: string | null;
    message: string;
    pet?: {
      __typename?: "Pet";
      id: string;
      entityType: EntityTypeEnum;
      name: string;
      birthDate?: string | null;
      species: string;
      breedType: string;
      breeds: Array<string>;
      gender: string;
      primaryColor?: string | null;
      weight?: number | null;
      userId: string;
      creationDate: string;
      updateDate: string;
      neutered?: boolean | null;
      livingEnvironment?: PetLivingEnvironment | null;
      length?: number | null;
      dateMarkedAsLost?: string | null;
      petProtectionId?: string | null;
      image?: { __typename?: "Image"; id: string; url?: string | null } | null;
    } | null;
  };
};

export type DeletePetMutationVariables = Exact<{
  petId: Scalars["String"]["input"];
}>;

export type DeletePetMutation = {
  __typename?: "Mutation";
  deletePet: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type CreatePetlinkGpsMutationVariables = Exact<{
  petlinkGps: PetlinkGpsIn;
  appBrand: AppBrand;
}>;

export type CreatePetlinkGpsMutation = {
  __typename?: "Mutation";
  createPetlinkGps: {
    __typename?: "ResponseCreatePetlinkGps";
    code: string;
    translationCode?: string | null;
    message: string;
    currentTermEnd?: string | null;
    url?: string | null;
    petlinkGps?: {
      __typename?: "PetlinkGps";
      id: string;
      entityType: EntityTypeEnum;
      serialNumber: string;
      petId: string;
      userId: string;
      creationDate: string;
      updateDate: string;
      countryCode?: string | null;
      timezone?: string | null;
      lastKnownPosition?: {
        __typename?: "GpsPosition";
        lat: number;
        lng: number;
        alt?: number | null;
        radius: number;
        speed?: number | null;
        positionType: PositionType;
        date: string;
      } | null;
      lastKnownStatus?: {
        __typename?: "GpsStatus";
        battery: number;
        flashlight: StatusState;
        sound: StatusState;
        liveTracking: StatusState;
        geofence: StatusState;
        inGeofence?: boolean | null;
        energySavingMode: StatusState;
        inEnergySavingZone?: boolean | null;
        firmwareVersion: string;
        offline?: boolean | null;
        date: string;
      } | null;
      geofenceCoordinates?: Array<{ __typename?: "Coordinates"; lat: number; lng: number } | null> | null;
      newFirmwareVersion?: { __typename?: "NewFirmwareVersion"; url: string; version: string } | null;
      settings: {
        __typename?: "GpsSettings";
        activityProfile?: ActivityProfileEnum | null;
        updateFrequency: number;
        enableGpsOnDefault: boolean;
        optimizationDone?: boolean | null;
      };
    } | null;
  };
};

export type UpdatePetlinkGpsMutationVariables = Exact<{
  petlinkGps: UpdatePetlinkGpsIn;
}>;

export type UpdatePetlinkGpsMutation = {
  __typename?: "Mutation";
  updatePetlinkGps: {
    __typename?: "ResponsePetlinkGps";
    code: string;
    translationCode?: string | null;
    message: string;
    petlinkGps?: {
      __typename?: "PetlinkGps";
      id: string;
      entityType: EntityTypeEnum;
      serialNumber: string;
      petId: string;
      userId: string;
      creationDate: string;
      updateDate: string;
      countryCode?: string | null;
      timezone?: string | null;
      subscriptionId?: string | null;
      subscriptionIsActive?: boolean | null;
      logEnabled?: boolean | null;
      lastKnownPosition?: {
        __typename?: "GpsPosition";
        lat: number;
        lng: number;
        alt?: number | null;
        radius: number;
        speed?: number | null;
        positionType: PositionType;
        date: string;
      } | null;
      lastKnownStatus?: {
        __typename?: "GpsStatus";
        battery: number;
        flashlight: StatusState;
        sound: StatusState;
        liveTracking: StatusState;
        geofence: StatusState;
        inGeofence?: boolean | null;
        energySavingMode: StatusState;
        inEnergySavingZone?: boolean | null;
        firmwareVersion: string;
        offline?: boolean | null;
        date: string;
      } | null;
      geofenceCoordinates?: Array<{ __typename?: "Coordinates"; lat: number; lng: number } | null> | null;
      newFirmwareVersion?: { __typename?: "NewFirmwareVersion"; version: string; url: string } | null;
      settings: {
        __typename?: "GpsSettings";
        activityProfile?: ActivityProfileEnum | null;
        updateFrequency: number;
        enableGpsOnDefault: boolean;
        optimizationDone?: boolean | null;
      };
    } | null;
  };
};

export type ResetPetlinkGpsMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type ResetPetlinkGpsMutation = {
  __typename?: "Mutation";
  resetPetlinkGps: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type UpdateBillingInfoMutationVariables = Exact<{
  updateBillingInfoInput: UpdateBillingInfoInput;
}>;

export type UpdateBillingInfoMutation = {
  __typename?: "Mutation";
  updateBillingInfo: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type UpdatePetProtectionDataMutationVariables = Exact<{
  petProtectionId: Scalars["String"]["input"];
  owner: PetProtectionOwnerIn;
  pet: PetProtectionPetIn;
}>;

export type UpdatePetProtectionDataMutation = {
  __typename?: "Mutation";
  updatePetProtectionData?: {
    __typename?: "ResponseUpdatePetProtectionData";
    code: string;
    translationCode?: string | null;
    message: string;
    petProtection?: {
      __typename?: "PetProtection";
      id: string;
      petId?: string | null;
      userId: string;
      chargebeeSubscriptionId?: string | null;
      currentTermStart: string;
      currentTermEnd: string;
      status: PetProtectionStatus;
      codiceTessera?: string | null;
      fileName?: string | null;
      name: string;
      price: number;
      currencyCode: string;
      period: number;
      periodUnit: string;
      reservedCoupon: string;
      reservedCouponPercent: number;
      customerServiceContact: string;
      petOwner?: {
        __typename?: "PetProtectionOwnerData";
        name: string;
        surname: string;
        email: string;
        fiscalCode: string;
        city: string;
        zipCode: string;
        streetAddress: string;
        countryCode: string;
        provinceCode: string;
        homePhone: string;
        mobilePhone: string;
      } | null;
      pet?: {
        __typename?: "PetProtectionPetData";
        species: string;
        breed: string;
        gender: string;
        name: string;
        birthDate?: string | null;
        microchip?: string | null;
      } | null;
      petFlag: { __typename?: "PetProtectionFlag"; country: boolean; age: boolean };
      card?: {
        __typename?: "Card";
        expiryMonth?: number | null;
        expiryYear?: number | null;
        maskedNumber?: string | null;
        type?: string | null;
        brand?: string | null;
        paymentMethod: string;
      } | null;
    } | null;
  } | null;
};

export type StopRenewingSubscriptionMutationVariables = Exact<{
  subscriptionId: Scalars["String"]["input"];
  appBrand: AppBrand;
  cancelReason: Scalars["String"]["input"];
  cancelReasonCode: CancelReasonCodeEnum;
}>;

export type StopRenewingSubscriptionMutation = {
  __typename?: "Mutation";
  stopRenewingSubscription?: { __typename?: "Response"; code: string; translationCode?: string | null; message: string } | null;
};

export type UpdateUserMutationVariables = Exact<{
  user: UpdateUserIn;
}>;

export type UpdateUserMutation = {
  __typename?: "Mutation";
  updateUser: {
    __typename?: "ResponseUser";
    code: string;
    translationCode?: string | null;
    message: string;
    user?: {
      __typename?: "User";
      id: string;
      entityType: EntityTypeEnum;
      name: string;
      surname: string;
      email: string;
      phone: string;
      birthDate?: string | null;
      gender?: Gender | null;
      city?: string | null;
      countryCode: string;
      zipCode?: string | null;
      streetAddress?: string | null;
      stateCode?: string | null;
      languageId: LanguageId;
      timezone?: string | null;
      creationDate: string;
      updateDate: string;
      image?: { __typename?: "Image"; id: string; url?: string | null } | null;
    } | null;
  };
};

export type DeleteUserMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteUserMutation = {
  __typename?: "Mutation";
  deleteUser: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type SendCommandMutationVariables = Exact<{
  command: Command;
}>;

export type SendCommandMutation = {
  __typename?: "Mutation";
  sendCommand: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type SendSettingMutationVariables = Exact<{
  setting: Setting;
}>;

export type SendSettingMutation = {
  __typename?: "Mutation";
  sendSetting: {
    __typename?: "ResponseSendSetting";
    code: string;
    translationCode?: string | null;
    message: string;
    petlinkGps?: {
      __typename?: "PetlinkGps";
      id: string;
      entityType: EntityTypeEnum;
      serialNumber: string;
      petId: string;
      userId: string;
      creationDate: string;
      updateDate: string;
      countryCode?: string | null;
      timezone?: string | null;
      subscriptionId?: string | null;
      subscriptionIsActive?: boolean | null;
      endOfLifeDevice?: boolean | null;
      lastKnownPosition?: {
        __typename?: "GpsPosition";
        lat: number;
        lng: number;
        alt?: number | null;
        radius: number;
        speed?: number | null;
        positionType: PositionType;
        date: string;
      } | null;
      lastKnownStatus?: {
        __typename?: "GpsStatus";
        battery: number;
        flashlight: StatusState;
        sound: StatusState;
        liveTracking: StatusState;
        geofence: StatusState;
        inGeofence?: boolean | null;
        energySavingMode: StatusState;
        inEnergySavingZone?: boolean | null;
        firmwareVersion: string;
        offline?: boolean | null;
        date: string;
      } | null;
      geofenceCoordinates?: Array<{ __typename?: "Coordinates"; lat: number; lng: number } | null> | null;
      settings: { __typename?: "GpsSettings"; updateFrequency: number; enableGpsOnDefault: boolean };
    } | null;
    energySavingZone?: {
      __typename?: "EnergySavingZone";
      entityType: EntityTypeEnum;
      id: string;
      name: string;
      icon: string;
      ssid: string;
      bssid: string;
      userId: string;
      radius: number;
      creationDate: string;
      updateDate: string;
      position: { __typename?: "Coordinates"; lat: number; lng: number };
    } | null;
  };
};

export type GetUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserQuery = {
  __typename?: "Query";
  getUser: {
    __typename?: "ResponseUser";
    code: string;
    message: string;
    translationCode?: string | null;
    user?: {
      __typename?: "User";
      birthDate?: string | null;
      chargebeeId?: string | null;
      city?: string | null;
      countryCode: string;
      creationDate: string;
      email: string;
      entityType: EntityTypeEnum;
      haveMicrochip?: boolean | null;
      gender?: Gender | null;
      id: string;
      languageId: LanguageId;
      name: string;
      phone: string;
      safetyTermsCat?: boolean | null;
      stateCode?: string | null;
      streetAddress?: string | null;
      surname: string;
      timezone?: string | null;
      updateDate: string;
      zipCode?: string | null;
      contactVerified?: { __typename?: "ContactVerified"; email?: boolean | null; phone?: boolean | null } | null;
      image?: { __typename?: "Image"; id: string; url?: string | null } | null;
      mobileDevices?: Array<{ __typename?: "MobileDevice"; os: MobileOsEnum; registrationToken: string; serialNumber: string }> | null;
      notificationSettings: {
        __typename?: "NotificationSettings";
        email: boolean;
        push: boolean;
        sms: boolean;
        energySavingZone: { __typename?: "EszNotificationPreferences"; push: boolean };
      };
      settings: { __typename?: "UserSettings"; liveDistance: boolean; liveSpeed: boolean; liveTrack: boolean };
    } | null;
  };
};

export type CheckContactQueryVariables = Exact<{
  contact: Scalars["String"]["input"];
  contactType: ContactType;
}>;

export type CheckContactQuery = {
  __typename?: "Query";
  checkContact: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type GetPetQueryVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type GetPetQuery = {
  __typename?: "Query";
  getPet: {
    __typename?: "ResponsePet";
    code: string;
    translationCode?: string | null;
    message: string;
    pet?: {
      __typename?: "Pet";
      id: string;
      name: string;
      birthDate?: string | null;
      species: string;
      breedType: string;
      breeds: Array<string>;
      gender: string;
      primaryColor?: string | null;
      weight?: number | null;
      userId: string;
      creationDate: string;
      updateDate: string;
      neutered?: boolean | null;
      length?: number | null;
      dateMarkedAsLost?: string | null;
      petProtectionId?: string | null;
    } | null;
  };
};

export type GetPetsQueryVariables = Exact<{ [key: string]: never }>;

export type GetPetsQuery = {
  __typename?: "Query";
  getPets: {
    __typename?: "ResponsePets";
    code: string;
    message: string;
    pets?: Array<{
      __typename?: "Pet";
      id: string;
      name: string;
      birthDate?: string | null;
      species: string;
      breedType: string;
      breeds: Array<string>;
      gender: string;
      primaryColor?: string | null;
      weight?: number | null;
      userId: string;
      creationDate: string;
      updateDate: string;
      neutered?: boolean | null;
      length?: number | null;
      dateMarkedAsLost?: string | null;
      petProtectionId?: string | null;
    }> | null;
  };
};

export type GetColorsQueryVariables = Exact<{
  species: SpeciesEnum;
  languageId?: InputMaybe<LanguageId>;
}>;

export type GetColorsQuery = {
  __typename?: "Query";
  getColors: {
    __typename?: "ResponseGetColors";
    code: string;
    message: string;
    translationCode?: string | null;
    items?: Array<{ __typename?: "Color"; code: string; name: string }> | null;
  };
};

export type GetBreedQueryVariables = Exact<{
  species: SpeciesEnum;
  languageId?: InputMaybe<LanguageId>;
}>;

export type GetBreedQuery = {
  __typename?: "Query";
  getBreed: {
    __typename?: "ResponseGetBreed";
    code: string;
    message: string;
    translationCode?: string | null;
    items?: Array<{ __typename?: "Breed"; breedName: string; code: string; species: SpeciesEnum }> | null;
  };
};

export type GetPetlinkGpsQueryVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type GetPetlinkGpsQuery = {
  __typename?: "Query";
  getPetlinkGps: {
    __typename?: "ResponsePetlinkGps";
    code: string;
    translationCode?: string | null;
    message: string;
    petlinkGps?: {
      __typename?: "PetlinkGps";
      id: string;
      entityType: EntityTypeEnum;
      serialNumber: string;
      petId: string;
      userId: string;
      creationDate: string;
      updateDate: string;
      countryCode?: string | null;
      timezone?: string | null;
      subscriptionId?: string | null;
      subscriptionIsActive?: boolean | null;
      logEnabled?: boolean | null;
      lastKnownPosition?: {
        __typename?: "GpsPosition";
        lat: number;
        lng: number;
        alt?: number | null;
        radius: number;
        speed?: number | null;
        positionType: PositionType;
        date: string;
      } | null;
      lastKnownStatus?: {
        __typename?: "GpsStatus";
        battery: number;
        flashlight: StatusState;
        sound: StatusState;
        liveTracking: StatusState;
        geofence: StatusState;
        inGeofence?: boolean | null;
        energySavingMode: StatusState;
        inEnergySavingZone?: boolean | null;
        firmwareVersion: string;
        offline?: boolean | null;
        date: string;
      } | null;
      geofenceCoordinates?: Array<{ __typename?: "Coordinates"; lat: number; lng: number } | null> | null;
      newFirmwareVersion?: { __typename?: "NewFirmwareVersion"; version: string; url: string } | null;
      settings: {
        __typename?: "GpsSettings";
        activityProfile?: ActivityProfileEnum | null;
        updateFrequency: number;
        enableGpsOnDefault: boolean;
        optimizationDone?: boolean | null;
      };
    } | null;
  };
};

export type GetSubscriptionPlansQueryVariables = Exact<{
  productId?: InputMaybe<Scalars["String"]["input"]>;
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetSubscriptionPlansQuery = {
  __typename?: "Query";
  getSubscriptionPlans: {
    __typename?: "ResponseSubscriptionPlans";
    code: string;
    translationCode?: string | null;
    message: string;
    trialDuration?: number | null;
    paymentMethodRequired?: boolean | null;
    plans?: Array<{
      __typename?: "Plan";
      itemId: string;
      pricings: Array<{
        __typename?: "Pricing";
        id: string;
        name: string;
        externalName?: string | null;
        itemId: string;
        price?: number | null;
        period?: number | null;
        currencyCode: string;
        periodUnit?: string | null;
        itemFamilyId?: string | null;
        status?: string | null;
        trialPeriod?: number | null;
        trialPeriodUnit?: string | null;
        addonPricings?: Array<{
          __typename?: "AddonPricing";
          id: string;
          name: string;
          externalName?: string | null;
          itemId: string;
          price?: number | null;
          period?: number | null;
          currencyCode: string;
          periodUnit?: string | null;
          itemFamilyId?: string | null;
          status?: string | null;
          trialPeriod?: number | null;
          trialPeriodUnit?: string | null;
        } | null> | null;
      } | null>;
    }> | null;
    careProtectionPlans?: Array<{
      __typename?: "CareProtectionPlan";
      itemId: string;
      pricings: Array<{
        __typename?: "Pricing";
        id: string;
        name: string;
        externalName?: string | null;
        itemId: string;
        price?: number | null;
        period?: number | null;
        currencyCode: string;
        periodUnit?: string | null;
        itemFamilyId?: string | null;
        status?: string | null;
        trialPeriod?: number | null;
        trialPeriodUnit?: string | null;
      } | null>;
    }> | null;
    coupon?: {
      __typename?: "Coupon";
      id: string;
      name: string;
      discountType: string;
      discountPercentage?: number | null;
      discountAmount?: number | null;
      discountQuantity?: number | null;
      currencyCode?: string | null;
    } | null;
  };
};

export type GetBillingInfoQueryVariables = Exact<{ [key: string]: never }>;

export type GetBillingInfoQuery = {
  __typename?: "Query";
  getBillingInfo: {
    __typename?: "ResponseBillingInfo";
    code: string;
    translationCode?: string | null;
    message: string;
    billingInfo?: {
      __typename?: "BillingInfo";
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      stateCode?: string | null;
      state?: string | null;
      country?: string | null;
      zip?: string | null;
    } | null;
  };
};

export type GetSubscriptionPlanPricingQueryVariables = Exact<{
  planPriceId: Scalars["String"]["input"];
  careProtectionPlanId?: InputMaybe<Scalars["String"]["input"]>;
  addonPriceIds?: InputMaybe<Array<Scalars["String"]["input"]> | Scalars["String"]["input"]>;
  countryCode: Scalars["String"]["input"];
  productId: Scalars["String"]["input"];
}>;

export type GetSubscriptionPlanPricingQuery = {
  __typename?: "Query";
  getSubscriptionPlanPricing: {
    __typename?: "ResponseSubscriptionPlanPricing";
    code: string;
    translationCode?: string | null;
    message: string;
    trialDuration?: number | null;
    paymentMethodRequired?: boolean | null;
    pricing?: {
      __typename?: "Pricing";
      id: string;
      name: string;
      externalName?: string | null;
      itemId: string;
      price?: number | null;
      period?: number | null;
      currencyCode: string;
      periodUnit?: string | null;
      itemFamilyId?: string | null;
      status?: string | null;
      trialPeriod?: number | null;
      trialPeriodUnit?: string | null;
    } | null;
    careProtectionPricing?: {
      __typename?: "Pricing";
      id: string;
      name: string;
      externalName?: string | null;
      itemId: string;
      price?: number | null;
      period?: number | null;
      currencyCode: string;
      periodUnit?: string | null;
      itemFamilyId?: string | null;
      status?: string | null;
      trialPeriod?: number | null;
      trialPeriodUnit?: string | null;
    } | null;
    coupon?: {
      __typename?: "Coupon";
      id: string;
      name: string;
      discountType: string;
      discountPercentage?: number | null;
      discountAmount?: number | null;
      discountQuantity?: number | null;
      currencyCode?: string | null;
    } | null;
  };
};

export type GetSubscriptionByProductIdQueryVariables = Exact<{
  productId: Scalars["String"]["input"];
}>;

export type GetSubscriptionByProductIdQuery = {
  __typename?: "Query";
  getSubscriptionByProductId: {
    __typename?: "ResponseGetSubscriptionByProductId";
    code: string;
    translationCode?: string | null;
    message: string;
    subscription?: {
      __typename?: "PetlinkSubscription";
      id: string;
      status: SubscriptionStatusEnum;
      currentTermStart?: string | null;
      currentTermEnd?: string | null;
      nextBillingAt?: string | null;
      currencyCode: string;
      paymentStatus?: PaymentStatusTypeEnum | null;
      planChangeNotAllowed: boolean;
      billingPeriod: number;
      billingPeriodUnit: string;
      addonToStopIds?: Array<string> | null;
      card?: {
        __typename?: "Card";
        expiryMonth?: number | null;
        expiryYear?: number | null;
        maskedNumber?: string | null;
        type?: string | null;
        brand?: string | null;
        paymentMethod: string;
      } | null;
      subscriptionItems: Array<{
        __typename?: "PetlinkSubscriptionItem";
        amount: number;
        name?: string | null;
        itemPriceId: string;
        itemType: string;
        quantity: number;
        unitPrice: number;
        itemId: string;
      }>;
    } | null;
  };
};

export type GetSubscriptionsQueryVariables = Exact<{
  productId: Scalars["String"]["input"];
}>;

export type GetSubscriptionsQuery = {
  __typename?: "Query";
  getSubscriptions: {
    __typename?: "ResponseGetSubscriptions";
    code: string;
    translationCode?: string | null;
    message: string;
    subscriptions?: Array<{
      __typename?: "SubscriptionShortInfo";
      id: string;
      status: SubscriptionStatusEnum;
      creationDate: string;
      currentTermStart?: string | null;
      currentTermEnd?: string | null;
      billingPeriod: number;
      billingPeriodUnit: string;
      currencyCode: string;
      paymentStatus?: PaymentStatusTypeEnum | null;
      planChangeNotAllowed: boolean;
      totalAmount: number;
      addonToStopIds?: Array<string> | null;
      card?: {
        __typename?: "Card";
        expiryMonth?: number | null;
        expiryYear?: number | null;
        maskedNumber?: string | null;
        type?: string | null;
        brand?: string | null;
        paymentMethod: string;
      } | null;
      subscriptionItems: Array<{
        __typename?: "SubscriptionShortInfoItem";
        amount: number;
        name?: string | null;
        itemPriceId: string;
        itemType: string;
        itemId: string;
        quantity: number;
      }>;
      invoice?: {
        __typename?: "InvoiceShortInfo";
        id: string;
        status: InvoiceStatusEnum;
        creationDate: string;
        currencyCode: string;
        total: number;
        items: Array<{
          __typename?: "InvoiceItemShortInfo";
          itemId: string;
          itemType: string;
          description: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }>;
        discountItems?: Array<{
          __typename?: "DiscoutItem";
          couponId: string;
          chargebeeInvoiceItemId: string;
          discountType: string;
          discountPercentage?: number | null;
          amount: number;
        }> | null;
      } | null;
    }> | null;
  };
};

export type GetPetProtectionQueryVariables = Exact<{
  petProtectionId: Scalars["String"]["input"];
}>;

export type GetPetProtectionQuery = {
  __typename?: "Query";
  getPetProtection: {
    __typename?: "ResponseGetPetProtection";
    code: string;
    translationCode?: string | null;
    message: string;
    petProtection?: {
      __typename?: "PetProtection";
      id: string;
      petId?: string | null;
      userId: string;
      chargebeeSubscriptionId?: string | null;
      currentTermStart: string;
      currentTermEnd: string;
      status: PetProtectionStatus;
      codiceTessera?: string | null;
      fileName?: string | null;
      name: string;
      price: number;
      currencyCode: string;
      period: number;
      periodUnit: string;
      reservedCoupon: string;
      reservedCouponPercent: number;
      customerServiceContact: string;
      petOwner?: {
        __typename?: "PetProtectionOwnerData";
        name: string;
        surname: string;
        email: string;
        fiscalCode: string;
        city: string;
        zipCode: string;
        streetAddress: string;
        countryCode: string;
        provinceCode: string;
        homePhone: string;
        mobilePhone: string;
      } | null;
      pet?: {
        __typename?: "PetProtectionPetData";
        species: string;
        breed: string;
        gender: string;
        name: string;
        birthDate?: string | null;
        microchip?: string | null;
      } | null;
      petFlag: { __typename?: "PetProtectionFlag"; country: boolean; age: boolean };
      card?: {
        __typename?: "Card";
        expiryMonth?: number | null;
        expiryYear?: number | null;
        maskedNumber?: string | null;
        type?: string | null;
        brand?: string | null;
        paymentMethod: string;
      } | null;
    } | null;
  };
};

export type ChangePasswordMutationVariables = Exact<{
  oldPassword: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
}>;

export type ChangePasswordMutation = {
  __typename?: "Mutation";
  changePassword: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type UpdateEmailUserMutationVariables = Exact<{
  email: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
  appBrand: AppBrand;
}>;

export type UpdateEmailUserMutation = {
  __typename?: "Mutation";
  updateEmailUser: { __typename?: "ResponseUser"; code: string; translationCode?: string | null; message: string };
};

export type UpdatePhoneNumberUserMutationVariables = Exact<{
  phone: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
  verificationId: Scalars["String"]["input"];
  otp: Scalars["String"]["input"];
}>;

export type UpdatePhoneNumberUserMutation = {
  __typename?: "Mutation";
  updatePhoneNumberUser: { __typename?: "ResponseUser"; code: string; translationCode?: string | null; message: string };
};

export type SendOtpForgotPasswordMutationVariables = Exact<{
  contact: Scalars["String"]["input"];
  languageId?: InputMaybe<LanguageId>;
}>;

export type SendOtpForgotPasswordMutation = {
  __typename?: "Mutation";
  sendOtpForgotPassword: {
    __typename?: "ResponseOtp";
    code: string;
    translationCode?: string | null;
    message: string;
    verificationId?: string | null;
  };
};

export type ChangeForgotPasswordMutationVariables = Exact<{
  otp: Scalars["String"]["input"];
  verificationId: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
}>;

export type ChangeForgotPasswordMutation = {
  __typename?: "Mutation";
  changeForgotPassword: { __typename?: "Response"; code: string; translationCode?: string | null; message: string };
};

export type ForgotEmailMutationVariables = Exact<{
  productNumber: Scalars["String"]["input"];
  entityType?: InputMaybe<ProductTypeEnum>;
  languageId?: InputMaybe<LanguageId>;
}>;

export type ForgotEmailMutation = {
  __typename?: "Mutation";
  forgotEmail?: { __typename?: "Response"; code: string; translationCode?: string | null; message: string } | null;
};

export const SendOtpDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "sendOtp" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "phone" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sendOtp" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "phone" }, value: { kind: "Variable", name: { kind: "Name", value: "phone" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "verificationId" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const CheckOtpDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "checkOtp" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "otp" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "contact" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "checkOtp" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "verificationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "otp" }, value: { kind: "Variable", name: { kind: "Name", value: "otp" } } },
              { kind: "Argument", name: { kind: "Name", value: "contact" }, value: { kind: "Variable", name: { kind: "Name", value: "contact" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "verificationId" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const SignUpUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "signUpUser" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "user" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UserIn" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "otpData" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "OtpInput" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "appBrand" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "AppBrand" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "signUpUser" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "user" }, value: { kind: "Variable", name: { kind: "Name", value: "user" } } },
              { kind: "Argument", name: { kind: "Name", value: "otpData" }, value: { kind: "Variable", name: { kind: "Name", value: "otpData" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "appBrand" }, value: { kind: "Variable", name: { kind: "Name", value: "appBrand" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UtilityIntegrationTestDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "utilityIntegrationTest" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "input" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UtilityIntegrationTestInput" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "utilityIntegrationTest" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "input" }, value: { kind: "Variable", name: { kind: "Name", value: "input" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const VerifyEmailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "verifyEmail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "otp" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "uuid" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "verifyEmail" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "verificationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "otp" }, value: { kind: "Variable", name: { kind: "Name", value: "otp" } } },
              { kind: "Argument", name: { kind: "Name", value: "uuid" }, value: { kind: "Variable", name: { kind: "Name", value: "uuid" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const CreatePetDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createPet" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pet" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "PetIn" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createPet" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "pet" }, value: { kind: "Variable", name: { kind: "Name", value: "pet" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pet" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "species" } },
                      { kind: "Field", name: { kind: "Name", value: "breedType" } },
                      { kind: "Field", name: { kind: "Name", value: "breeds" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "primaryColor" } },
                      { kind: "Field", name: { kind: "Name", value: "weight" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "image" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "neutered" } },
                      { kind: "Field", name: { kind: "Name", value: "livingEnvironment" } },
                      { kind: "Field", name: { kind: "Name", value: "length" } },
                      { kind: "Field", name: { kind: "Name", value: "dateMarkedAsLost" } },
                      { kind: "Field", name: { kind: "Name", value: "petProtectionId" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdatePetDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updatePet" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pet" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UpdatePetIn" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updatePet" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "pet" }, value: { kind: "Variable", name: { kind: "Name", value: "pet" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pet" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "species" } },
                      { kind: "Field", name: { kind: "Name", value: "breedType" } },
                      { kind: "Field", name: { kind: "Name", value: "breeds" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "primaryColor" } },
                      { kind: "Field", name: { kind: "Name", value: "weight" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "image" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "neutered" } },
                      { kind: "Field", name: { kind: "Name", value: "livingEnvironment" } },
                      { kind: "Field", name: { kind: "Name", value: "length" } },
                      { kind: "Field", name: { kind: "Name", value: "dateMarkedAsLost" } },
                      { kind: "Field", name: { kind: "Name", value: "petProtectionId" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const DeletePetDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deletePet" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "petId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deletePet" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "petId" }, value: { kind: "Variable", name: { kind: "Name", value: "petId" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const CreatePetlinkGpsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createPetlinkGps" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "petlinkGps" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "PetlinkGpsIn" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "appBrand" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "AppBrand" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createPetlinkGps" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "petlinkGps" },
                value: { kind: "Variable", name: { kind: "Name", value: "petlinkGps" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "appBrand" }, value: { kind: "Variable", name: { kind: "Name", value: "appBrand" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petlinkGps" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownPosition" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                            { kind: "Field", name: { kind: "Name", value: "alt" } },
                            { kind: "Field", name: { kind: "Name", value: "radius" } },
                            { kind: "Field", name: { kind: "Name", value: "speed" } },
                            { kind: "Field", name: { kind: "Name", value: "positionType" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownStatus" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "battery" } },
                            { kind: "Field", name: { kind: "Name", value: "flashlight" } },
                            { kind: "Field", name: { kind: "Name", value: "sound" } },
                            { kind: "Field", name: { kind: "Name", value: "liveTracking" } },
                            { kind: "Field", name: { kind: "Name", value: "geofence" } },
                            { kind: "Field", name: { kind: "Name", value: "inGeofence" } },
                            { kind: "Field", name: { kind: "Name", value: "energySavingMode" } },
                            { kind: "Field", name: { kind: "Name", value: "inEnergySavingZone" } },
                            { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                            { kind: "Field", name: { kind: "Name", value: "offline" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "geofenceCoordinates" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "newFirmwareVersion" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                            { kind: "Field", name: { kind: "Name", value: "version" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "settings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "activityProfile" } },
                            { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                            { kind: "Field", name: { kind: "Name", value: "enableGpsOnDefault" } },
                            { kind: "Field", name: { kind: "Name", value: "optimizationDone" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdatePetlinkGpsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updatePetlinkGps" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "petlinkGps" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UpdatePetlinkGpsIn" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updatePetlinkGps" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "petlinkGps" },
                value: { kind: "Variable", name: { kind: "Name", value: "petlinkGps" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petlinkGps" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownPosition" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                            { kind: "Field", name: { kind: "Name", value: "alt" } },
                            { kind: "Field", name: { kind: "Name", value: "radius" } },
                            { kind: "Field", name: { kind: "Name", value: "speed" } },
                            { kind: "Field", name: { kind: "Name", value: "positionType" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownStatus" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "battery" } },
                            { kind: "Field", name: { kind: "Name", value: "flashlight" } },
                            { kind: "Field", name: { kind: "Name", value: "sound" } },
                            { kind: "Field", name: { kind: "Name", value: "liveTracking" } },
                            { kind: "Field", name: { kind: "Name", value: "geofence" } },
                            { kind: "Field", name: { kind: "Name", value: "inGeofence" } },
                            { kind: "Field", name: { kind: "Name", value: "energySavingMode" } },
                            { kind: "Field", name: { kind: "Name", value: "inEnergySavingZone" } },
                            { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                            { kind: "Field", name: { kind: "Name", value: "offline" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "geofenceCoordinates" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "newFirmwareVersion" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "version" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "settings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "activityProfile" } },
                            { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                            { kind: "Field", name: { kind: "Name", value: "enableGpsOnDefault" } },
                            { kind: "Field", name: { kind: "Name", value: "optimizationDone" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionIsActive" } },
                      { kind: "Field", name: { kind: "Name", value: "logEnabled" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ResetPetlinkGpsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "resetPetlinkGps" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "resetPetlinkGps" },
            arguments: [{ kind: "Argument", name: { kind: "Name", value: "id" }, value: { kind: "Variable", name: { kind: "Name", value: "id" } } }],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdateBillingInfoDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateBillingInfo" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "updateBillingInfoInput" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UpdateBillingInfoInput" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateBillingInfo" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "updateBillingInfoInput" },
                value: { kind: "Variable", name: { kind: "Name", value: "updateBillingInfoInput" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdatePetProtectionDataDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updatePetProtectionData" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "petProtectionId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "owner" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "PetProtectionOwnerIn" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pet" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "PetProtectionPetIn" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updatePetProtectionData" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "petProtectionId" },
                value: { kind: "Variable", name: { kind: "Name", value: "petProtectionId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "owner" }, value: { kind: "Variable", name: { kind: "Name", value: "owner" } } },
              { kind: "Argument", name: { kind: "Name", value: "pet" }, value: { kind: "Variable", name: { kind: "Name", value: "pet" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petProtection" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "chargebeeSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "petOwner" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "surname" } },
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                            { kind: "Field", name: { kind: "Name", value: "fiscalCode" } },
                            { kind: "Field", name: { kind: "Name", value: "city" } },
                            { kind: "Field", name: { kind: "Name", value: "zipCode" } },
                            { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                            { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                            { kind: "Field", name: { kind: "Name", value: "provinceCode" } },
                            { kind: "Field", name: { kind: "Name", value: "homePhone" } },
                            { kind: "Field", name: { kind: "Name", value: "mobilePhone" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pet" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "species" } },
                            { kind: "Field", name: { kind: "Name", value: "breed" } },
                            { kind: "Field", name: { kind: "Name", value: "gender" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                            { kind: "Field", name: { kind: "Name", value: "microchip" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "petFlag" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "country" } },
                            { kind: "Field", name: { kind: "Name", value: "age" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "codiceTessera" } },
                      { kind: "Field", name: { kind: "Name", value: "fileName" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "period" } },
                      { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "reservedCoupon" } },
                      { kind: "Field", name: { kind: "Name", value: "reservedCouponPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "customerServiceContact" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "card" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "expiryMonth" } },
                            { kind: "Field", name: { kind: "Name", value: "expiryYear" } },
                            { kind: "Field", name: { kind: "Name", value: "maskedNumber" } },
                            { kind: "Field", name: { kind: "Name", value: "type" } },
                            { kind: "Field", name: { kind: "Name", value: "brand" } },
                            { kind: "Field", name: { kind: "Name", value: "paymentMethod" } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const StopRenewingSubscriptionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "stopRenewingSubscription" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "subscriptionId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "appBrand" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "AppBrand" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cancelReason" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cancelReasonCode" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "CancelReasonCodeEnum" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "stopRenewingSubscription" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "subscriptionId" },
                value: { kind: "Variable", name: { kind: "Name", value: "subscriptionId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "appBrand" }, value: { kind: "Variable", name: { kind: "Name", value: "appBrand" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "cancelReason" },
                value: { kind: "Variable", name: { kind: "Name", value: "cancelReason" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "cancelReasonCode" },
                value: { kind: "Variable", name: { kind: "Name", value: "cancelReasonCode" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdateUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateUser" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "user" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "UpdateUserIn" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateUser" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "user" }, value: { kind: "Variable", name: { kind: "Name", value: "user" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "surname" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "zipCode" } },
                      { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "stateCode" } },
                      { kind: "Field", name: { kind: "Name", value: "languageId" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "image" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const DeleteUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteUser" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteUser" },
            arguments: [{ kind: "Argument", name: { kind: "Name", value: "id" }, value: { kind: "Variable", name: { kind: "Name", value: "id" } } }],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const SendCommandDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "sendCommand" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "command" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Command" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sendCommand" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "command" }, value: { kind: "Variable", name: { kind: "Name", value: "command" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const SendSettingDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "sendSetting" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "setting" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "Setting" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sendSetting" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "setting" }, value: { kind: "Variable", name: { kind: "Name", value: "setting" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petlinkGps" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownPosition" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                            { kind: "Field", name: { kind: "Name", value: "alt" } },
                            { kind: "Field", name: { kind: "Name", value: "radius" } },
                            { kind: "Field", name: { kind: "Name", value: "speed" } },
                            { kind: "Field", name: { kind: "Name", value: "positionType" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownStatus" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "battery" } },
                            { kind: "Field", name: { kind: "Name", value: "flashlight" } },
                            { kind: "Field", name: { kind: "Name", value: "sound" } },
                            { kind: "Field", name: { kind: "Name", value: "liveTracking" } },
                            { kind: "Field", name: { kind: "Name", value: "geofence" } },
                            { kind: "Field", name: { kind: "Name", value: "inGeofence" } },
                            { kind: "Field", name: { kind: "Name", value: "energySavingMode" } },
                            { kind: "Field", name: { kind: "Name", value: "inEnergySavingZone" } },
                            { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                            { kind: "Field", name: { kind: "Name", value: "offline" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "geofenceCoordinates" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "settings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                            { kind: "Field", name: { kind: "Name", value: "enableGpsOnDefault" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionIsActive" } },
                      { kind: "Field", name: { kind: "Name", value: "endOfLifeDevice" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "energySavingZone" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "icon" } },
                      { kind: "Field", name: { kind: "Name", value: "ssid" } },
                      { kind: "Field", name: { kind: "Name", value: "bssid" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "position" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "radius" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUser" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "chargebeeId" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "contactVerified" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                            { kind: "Field", name: { kind: "Name", value: "phone" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "haveMicrochip" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "image" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "languageId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "mobileDevices" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "os" } },
                            { kind: "Field", name: { kind: "Name", value: "registrationToken" } },
                            { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "notificationSettings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "energySavingZone" },
                              selectionSet: { kind: "SelectionSet", selections: [{ kind: "Field", name: { kind: "Name", value: "push" } }] },
                            },
                            { kind: "Field", name: { kind: "Name", value: "push" } },
                            { kind: "Field", name: { kind: "Name", value: "sms" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "safetyTermsCat" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "settings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "liveDistance" } },
                            { kind: "Field", name: { kind: "Name", value: "liveSpeed" } },
                            { kind: "Field", name: { kind: "Name", value: "liveTrack" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "stateCode" } },
                      { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "surname" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "zipCode" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const CheckContactDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "checkContact" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "contact" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "contactType" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "ContactType" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "checkContact" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "contact" }, value: { kind: "Variable", name: { kind: "Name", value: "contact" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "contactType" },
                value: { kind: "Variable", name: { kind: "Name", value: "contactType" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetPetDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getPet" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getPet" },
            arguments: [{ kind: "Argument", name: { kind: "Name", value: "id" }, value: { kind: "Variable", name: { kind: "Name", value: "id" } } }],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pet" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "species" } },
                      { kind: "Field", name: { kind: "Name", value: "breedType" } },
                      { kind: "Field", name: { kind: "Name", value: "breeds" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "primaryColor" } },
                      { kind: "Field", name: { kind: "Name", value: "weight" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "neutered" } },
                      { kind: "Field", name: { kind: "Name", value: "length" } },
                      { kind: "Field", name: { kind: "Name", value: "dateMarkedAsLost" } },
                      { kind: "Field", name: { kind: "Name", value: "petProtectionId" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetPetsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getPets" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getPets" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pets" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                      { kind: "Field", name: { kind: "Name", value: "species" } },
                      { kind: "Field", name: { kind: "Name", value: "breedType" } },
                      { kind: "Field", name: { kind: "Name", value: "breeds" } },
                      { kind: "Field", name: { kind: "Name", value: "gender" } },
                      { kind: "Field", name: { kind: "Name", value: "primaryColor" } },
                      { kind: "Field", name: { kind: "Name", value: "weight" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "neutered" } },
                      { kind: "Field", name: { kind: "Name", value: "length" } },
                      { kind: "Field", name: { kind: "Name", value: "dateMarkedAsLost" } },
                      { kind: "Field", name: { kind: "Name", value: "petProtectionId" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetColorsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getColors" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "species" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "SpeciesEnum" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getColors" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "species" }, value: { kind: "Variable", name: { kind: "Name", value: "species" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "code" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetBreedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getBreed" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "species" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "SpeciesEnum" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getBreed" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "species" }, value: { kind: "Variable", name: { kind: "Name", value: "species" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "breedName" } },
                      { kind: "Field", name: { kind: "Name", value: "code" } },
                      { kind: "Field", name: { kind: "Name", value: "species" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetPetlinkGpsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getPetlinkGps" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getPetlinkGps" },
            arguments: [{ kind: "Argument", name: { kind: "Name", value: "id" }, value: { kind: "Variable", name: { kind: "Name", value: "id" } } }],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petlinkGps" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownPosition" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                            { kind: "Field", name: { kind: "Name", value: "alt" } },
                            { kind: "Field", name: { kind: "Name", value: "radius" } },
                            { kind: "Field", name: { kind: "Name", value: "speed" } },
                            { kind: "Field", name: { kind: "Name", value: "positionType" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastKnownStatus" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "battery" } },
                            { kind: "Field", name: { kind: "Name", value: "flashlight" } },
                            { kind: "Field", name: { kind: "Name", value: "sound" } },
                            { kind: "Field", name: { kind: "Name", value: "liveTracking" } },
                            { kind: "Field", name: { kind: "Name", value: "geofence" } },
                            { kind: "Field", name: { kind: "Name", value: "inGeofence" } },
                            { kind: "Field", name: { kind: "Name", value: "energySavingMode" } },
                            { kind: "Field", name: { kind: "Name", value: "inEnergySavingZone" } },
                            { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                            { kind: "Field", name: { kind: "Name", value: "offline" } },
                            { kind: "Field", name: { kind: "Name", value: "date" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "geofenceCoordinates" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "lat" } },
                            { kind: "Field", name: { kind: "Name", value: "lng" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "newFirmwareVersion" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "version" } },
                            { kind: "Field", name: { kind: "Name", value: "url" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "settings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "activityProfile" } },
                            { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                            { kind: "Field", name: { kind: "Name", value: "enableGpsOnDefault" } },
                            { kind: "Field", name: { kind: "Name", value: "optimizationDone" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionIsActive" } },
                      { kind: "Field", name: { kind: "Name", value: "logEnabled" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetSubscriptionPlansDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSubscriptionPlans" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "productId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "countryCode" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "serialNumber" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getSubscriptionPlans" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "productId" },
                value: { kind: "Variable", name: { kind: "Name", value: "productId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "countryCode" },
                value: { kind: "Variable", name: { kind: "Name", value: "countryCode" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "serialNumber" },
                value: { kind: "Variable", name: { kind: "Name", value: "serialNumber" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "plans" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "itemId" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pricings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "addonPricings" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "id" } },
                                  { kind: "Field", name: { kind: "Name", value: "name" } },
                                  { kind: "Field", name: { kind: "Name", value: "externalName" } },
                                  { kind: "Field", name: { kind: "Name", value: "itemId" } },
                                  { kind: "Field", name: { kind: "Name", value: "price" } },
                                  { kind: "Field", name: { kind: "Name", value: "period" } },
                                  { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                                  { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                                  { kind: "Field", name: { kind: "Name", value: "itemFamilyId" } },
                                  { kind: "Field", name: { kind: "Name", value: "status" } },
                                  { kind: "Field", name: { kind: "Name", value: "trialPeriod" } },
                                  { kind: "Field", name: { kind: "Name", value: "trialPeriodUnit" } },
                                ],
                              },
                            },
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "externalName" } },
                            { kind: "Field", name: { kind: "Name", value: "itemId" } },
                            { kind: "Field", name: { kind: "Name", value: "price" } },
                            { kind: "Field", name: { kind: "Name", value: "period" } },
                            { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                            { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                            { kind: "Field", name: { kind: "Name", value: "itemFamilyId" } },
                            { kind: "Field", name: { kind: "Name", value: "status" } },
                            { kind: "Field", name: { kind: "Name", value: "trialPeriod" } },
                            { kind: "Field", name: { kind: "Name", value: "trialPeriodUnit" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "careProtectionPlans" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "itemId" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pricings" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "externalName" } },
                            { kind: "Field", name: { kind: "Name", value: "itemId" } },
                            { kind: "Field", name: { kind: "Name", value: "price" } },
                            { kind: "Field", name: { kind: "Name", value: "period" } },
                            { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                            { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                            { kind: "Field", name: { kind: "Name", value: "itemFamilyId" } },
                            { kind: "Field", name: { kind: "Name", value: "status" } },
                            { kind: "Field", name: { kind: "Name", value: "trialPeriod" } },
                            { kind: "Field", name: { kind: "Name", value: "trialPeriodUnit" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "trialDuration" } },
                { kind: "Field", name: { kind: "Name", value: "paymentMethodRequired" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "coupon" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "discountType" } },
                      { kind: "Field", name: { kind: "Name", value: "discountPercentage" } },
                      { kind: "Field", name: { kind: "Name", value: "discountAmount" } },
                      { kind: "Field", name: { kind: "Name", value: "discountQuantity" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetBillingInfoDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getBillingInfo" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getBillingInfo" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "billingInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "firstName" } },
                      { kind: "Field", name: { kind: "Name", value: "lastName" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "address" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "stateCode" } },
                      { kind: "Field", name: { kind: "Name", value: "state" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
                      { kind: "Field", name: { kind: "Name", value: "zip" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetSubscriptionPlanPricingDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSubscriptionPlanPricing" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "planPriceId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "careProtectionPlanId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "addonPriceIds" } },
          type: { kind: "ListType", type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "countryCode" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "productId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getSubscriptionPlanPricing" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "planPriceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "planPriceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "careProtectionPlanId" },
                value: { kind: "Variable", name: { kind: "Name", value: "careProtectionPlanId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "addonPriceIds" },
                value: { kind: "Variable", name: { kind: "Name", value: "addonPriceIds" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "countryCode" },
                value: { kind: "Variable", name: { kind: "Name", value: "countryCode" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "productId" },
                value: { kind: "Variable", name: { kind: "Name", value: "productId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pricing" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "externalName" } },
                      { kind: "Field", name: { kind: "Name", value: "itemId" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "period" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "itemFamilyId" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "trialPeriod" } },
                      { kind: "Field", name: { kind: "Name", value: "trialPeriodUnit" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "careProtectionPricing" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "externalName" } },
                      { kind: "Field", name: { kind: "Name", value: "itemId" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "period" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "itemFamilyId" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "trialPeriod" } },
                      { kind: "Field", name: { kind: "Name", value: "trialPeriodUnit" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "trialDuration" } },
                { kind: "Field", name: { kind: "Name", value: "paymentMethodRequired" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "coupon" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "discountType" } },
                      { kind: "Field", name: { kind: "Name", value: "discountPercentage" } },
                      { kind: "Field", name: { kind: "Name", value: "discountAmount" } },
                      { kind: "Field", name: { kind: "Name", value: "discountQuantity" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetSubscriptionByProductIdDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSubscriptionByProductId" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "productId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getSubscriptionByProductId" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "productId" },
                value: { kind: "Variable", name: { kind: "Name", value: "productId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "subscription" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "nextBillingAt" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "card" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "expiryMonth" } },
                            { kind: "Field", name: { kind: "Name", value: "expiryYear" } },
                            { kind: "Field", name: { kind: "Name", value: "maskedNumber" } },
                            { kind: "Field", name: { kind: "Name", value: "type" } },
                            { kind: "Field", name: { kind: "Name", value: "brand" } },
                            { kind: "Field", name: { kind: "Name", value: "paymentMethod" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "paymentStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "planChangeNotAllowed" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "subscriptionItems" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "amount" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "itemPriceId" } },
                            { kind: "Field", name: { kind: "Name", value: "itemType" } },
                            { kind: "Field", name: { kind: "Name", value: "quantity" } },
                            { kind: "Field", name: { kind: "Name", value: "unitPrice" } },
                            { kind: "Field", name: { kind: "Name", value: "itemId" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "billingPeriod" } },
                      { kind: "Field", name: { kind: "Name", value: "billingPeriodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "addonToStopIds" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetSubscriptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSubscriptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "productId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getSubscriptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "productId" },
                value: { kind: "Variable", name: { kind: "Name", value: "productId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "subscriptions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "billingPeriod" } },
                      { kind: "Field", name: { kind: "Name", value: "billingPeriodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "paymentStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "planChangeNotAllowed" } },
                      { kind: "Field", name: { kind: "Name", value: "totalAmount" } },
                      { kind: "Field", name: { kind: "Name", value: "addonToStopIds" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "card" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "expiryMonth" } },
                            { kind: "Field", name: { kind: "Name", value: "expiryYear" } },
                            { kind: "Field", name: { kind: "Name", value: "maskedNumber" } },
                            { kind: "Field", name: { kind: "Name", value: "type" } },
                            { kind: "Field", name: { kind: "Name", value: "brand" } },
                            { kind: "Field", name: { kind: "Name", value: "paymentMethod" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "subscriptionItems" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "amount" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "itemPriceId" } },
                            { kind: "Field", name: { kind: "Name", value: "itemType" } },
                            { kind: "Field", name: { kind: "Name", value: "itemId" } },
                            { kind: "Field", name: { kind: "Name", value: "quantity" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "invoice" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "status" } },
                            { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                            { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                            { kind: "Field", name: { kind: "Name", value: "total" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "items" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "itemId" } },
                                  { kind: "Field", name: { kind: "Name", value: "itemType" } },
                                  { kind: "Field", name: { kind: "Name", value: "description" } },
                                  { kind: "Field", name: { kind: "Name", value: "quantity" } },
                                  { kind: "Field", name: { kind: "Name", value: "unitPrice" } },
                                  { kind: "Field", name: { kind: "Name", value: "amount" } },
                                ],
                              },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "discountItems" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "couponId" } },
                                  { kind: "Field", name: { kind: "Name", value: "chargebeeInvoiceItemId" } },
                                  { kind: "Field", name: { kind: "Name", value: "discountType" } },
                                  { kind: "Field", name: { kind: "Name", value: "discountPercentage" } },
                                  { kind: "Field", name: { kind: "Name", value: "amount" } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const GetPetProtectionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getPetProtection" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "petProtectionId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getPetProtection" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "petProtectionId" },
                value: { kind: "Variable", name: { kind: "Name", value: "petProtectionId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "petProtection" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "userId" } },
                      { kind: "Field", name: { kind: "Name", value: "chargebeeSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "petOwner" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "surname" } },
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                            { kind: "Field", name: { kind: "Name", value: "fiscalCode" } },
                            { kind: "Field", name: { kind: "Name", value: "city" } },
                            { kind: "Field", name: { kind: "Name", value: "zipCode" } },
                            { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                            { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                            { kind: "Field", name: { kind: "Name", value: "provinceCode" } },
                            { kind: "Field", name: { kind: "Name", value: "homePhone" } },
                            { kind: "Field", name: { kind: "Name", value: "mobilePhone" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pet" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "species" } },
                            { kind: "Field", name: { kind: "Name", value: "breed" } },
                            { kind: "Field", name: { kind: "Name", value: "gender" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "birthDate" } },
                            { kind: "Field", name: { kind: "Name", value: "microchip" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "petFlag" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "country" } },
                            { kind: "Field", name: { kind: "Name", value: "age" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "codiceTessera" } },
                      { kind: "Field", name: { kind: "Name", value: "fileName" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "period" } },
                      { kind: "Field", name: { kind: "Name", value: "periodUnit" } },
                      { kind: "Field", name: { kind: "Name", value: "reservedCoupon" } },
                      { kind: "Field", name: { kind: "Name", value: "reservedCouponPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "customerServiceContact" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "card" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "expiryMonth" } },
                            { kind: "Field", name: { kind: "Name", value: "expiryYear" } },
                            { kind: "Field", name: { kind: "Name", value: "maskedNumber" } },
                            { kind: "Field", name: { kind: "Name", value: "type" } },
                            { kind: "Field", name: { kind: "Name", value: "brand" } },
                            { kind: "Field", name: { kind: "Name", value: "paymentMethod" } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ChangePasswordDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "changePassword" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "oldPassword" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "password" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "changePassword" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "oldPassword" },
                value: { kind: "Variable", name: { kind: "Name", value: "oldPassword" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "password" }, value: { kind: "Variable", name: { kind: "Name", value: "password" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdateEmailUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateEmailUser" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "email" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "appBrand" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "AppBrand" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateEmailUser" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "email" }, value: { kind: "Variable", name: { kind: "Name", value: "email" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "appBrand" }, value: { kind: "Variable", name: { kind: "Name", value: "appBrand" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UpdatePhoneNumberUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updatePhoneNumberUser" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "phone" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "otp" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updatePhoneNumberUser" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "phone" }, value: { kind: "Variable", name: { kind: "Name", value: "phone" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "verificationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "otp" }, value: { kind: "Variable", name: { kind: "Name", value: "otp" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const SendOtpForgotPasswordDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "sendOtpForgotPassword" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "contact" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sendOtpForgotPassword" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "contact" }, value: { kind: "Variable", name: { kind: "Name", value: "contact" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "verificationId" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ChangeForgotPasswordDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "changeForgotPassword" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "otp" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "password" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "changeForgotPassword" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "otp" }, value: { kind: "Variable", name: { kind: "Name", value: "otp" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "verificationId" },
                value: { kind: "Variable", name: { kind: "Name", value: "verificationId" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "password" }, value: { kind: "Variable", name: { kind: "Name", value: "password" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ForgotEmailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "forgotEmail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "productNumber" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "entityType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ProductTypeEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "LanguageId" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "forgotEmail" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "productNumber" },
                value: { kind: "Variable", name: { kind: "Name", value: "productNumber" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "entityType" },
                value: { kind: "Variable", name: { kind: "Name", value: "entityType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "languageId" },
                value: { kind: "Variable", name: { kind: "Name", value: "languageId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "translationCode" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    sendOtp(
      variables: SendOtpMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SendOtpMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SendOtpMutation>({
            document: SendOtpDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "sendOtp",
        "mutation",
        variables,
      );
    },
    checkOtp(
      variables: CheckOtpMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CheckOtpMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CheckOtpMutation>({
            document: CheckOtpDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "checkOtp",
        "mutation",
        variables,
      );
    },
    signUpUser(
      variables: SignUpUserMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SignUpUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SignUpUserMutation>({
            document: SignUpUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "signUpUser",
        "mutation",
        variables,
      );
    },
    utilityIntegrationTest(
      variables: UtilityIntegrationTestMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UtilityIntegrationTestMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UtilityIntegrationTestMutation>({
            document: UtilityIntegrationTestDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "utilityIntegrationTest",
        "mutation",
        variables,
      );
    },
    verifyEmail(
      variables: VerifyEmailMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<VerifyEmailMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<VerifyEmailMutation>({
            document: VerifyEmailDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "verifyEmail",
        "mutation",
        variables,
      );
    },
    createPet(
      variables: CreatePetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CreatePetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CreatePetMutation>({
            document: CreatePetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "createPet",
        "mutation",
        variables,
      );
    },
    updatePet(
      variables: UpdatePetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdatePetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdatePetMutation>({
            document: UpdatePetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updatePet",
        "mutation",
        variables,
      );
    },
    deletePet(
      variables: DeletePetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<DeletePetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<DeletePetMutation>({
            document: DeletePetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "deletePet",
        "mutation",
        variables,
      );
    },
    createPetlinkGps(
      variables: CreatePetlinkGpsMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CreatePetlinkGpsMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CreatePetlinkGpsMutation>({
            document: CreatePetlinkGpsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "createPetlinkGps",
        "mutation",
        variables,
      );
    },
    updatePetlinkGps(
      variables: UpdatePetlinkGpsMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdatePetlinkGpsMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdatePetlinkGpsMutation>({
            document: UpdatePetlinkGpsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updatePetlinkGps",
        "mutation",
        variables,
      );
    },
    resetPetlinkGps(
      variables: ResetPetlinkGpsMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ResetPetlinkGpsMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ResetPetlinkGpsMutation>({
            document: ResetPetlinkGpsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "resetPetlinkGps",
        "mutation",
        variables,
      );
    },
    updateBillingInfo(
      variables: UpdateBillingInfoMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdateBillingInfoMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdateBillingInfoMutation>({
            document: UpdateBillingInfoDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updateBillingInfo",
        "mutation",
        variables,
      );
    },
    updatePetProtectionData(
      variables: UpdatePetProtectionDataMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdatePetProtectionDataMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdatePetProtectionDataMutation>({
            document: UpdatePetProtectionDataDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updatePetProtectionData",
        "mutation",
        variables,
      );
    },
    stopRenewingSubscription(
      variables: StopRenewingSubscriptionMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<StopRenewingSubscriptionMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<StopRenewingSubscriptionMutation>({
            document: StopRenewingSubscriptionDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "stopRenewingSubscription",
        "mutation",
        variables,
      );
    },
    updateUser(
      variables: UpdateUserMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdateUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdateUserMutation>({
            document: UpdateUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updateUser",
        "mutation",
        variables,
      );
    },
    deleteUser(
      variables: DeleteUserMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<DeleteUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<DeleteUserMutation>({
            document: DeleteUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "deleteUser",
        "mutation",
        variables,
      );
    },
    sendCommand(
      variables: SendCommandMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SendCommandMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SendCommandMutation>({
            document: SendCommandDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "sendCommand",
        "mutation",
        variables,
      );
    },
    sendSetting(
      variables: SendSettingMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SendSettingMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SendSettingMutation>({
            document: SendSettingDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "sendSetting",
        "mutation",
        variables,
      );
    },
    getUser(variables?: GetUserQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit["signal"]): Promise<GetUserQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetUserQuery>({
            document: GetUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getUser",
        "query",
        variables,
      );
    },
    checkContact(
      variables: CheckContactQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CheckContactQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CheckContactQuery>({
            document: CheckContactDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "checkContact",
        "query",
        variables,
      );
    },
    getPet(variables: GetPetQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit["signal"]): Promise<GetPetQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetPetQuery>({
            document: GetPetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getPet",
        "query",
        variables,
      );
    },
    getPets(variables?: GetPetsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit["signal"]): Promise<GetPetsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetPetsQuery>({
            document: GetPetsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getPets",
        "query",
        variables,
      );
    },
    getColors(
      variables: GetColorsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetColorsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetColorsQuery>({
            document: GetColorsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getColors",
        "query",
        variables,
      );
    },
    getBreed(
      variables: GetBreedQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetBreedQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetBreedQuery>({
            document: GetBreedDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getBreed",
        "query",
        variables,
      );
    },
    getPetlinkGps(
      variables: GetPetlinkGpsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetPetlinkGpsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetPetlinkGpsQuery>({
            document: GetPetlinkGpsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getPetlinkGps",
        "query",
        variables,
      );
    },
    getSubscriptionPlans(
      variables?: GetSubscriptionPlansQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetSubscriptionPlansQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetSubscriptionPlansQuery>({
            document: GetSubscriptionPlansDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getSubscriptionPlans",
        "query",
        variables,
      );
    },
    getBillingInfo(
      variables?: GetBillingInfoQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetBillingInfoQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetBillingInfoQuery>({
            document: GetBillingInfoDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getBillingInfo",
        "query",
        variables,
      );
    },
    getSubscriptionPlanPricing(
      variables: GetSubscriptionPlanPricingQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetSubscriptionPlanPricingQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetSubscriptionPlanPricingQuery>({
            document: GetSubscriptionPlanPricingDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getSubscriptionPlanPricing",
        "query",
        variables,
      );
    },
    getSubscriptionByProductId(
      variables: GetSubscriptionByProductIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetSubscriptionByProductIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetSubscriptionByProductIdQuery>({
            document: GetSubscriptionByProductIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getSubscriptionByProductId",
        "query",
        variables,
      );
    },
    getSubscriptions(
      variables: GetSubscriptionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetSubscriptionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetSubscriptionsQuery>({
            document: GetSubscriptionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getSubscriptions",
        "query",
        variables,
      );
    },
    getPetProtection(
      variables: GetPetProtectionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetPetProtectionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetPetProtectionQuery>({
            document: GetPetProtectionDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getPetProtection",
        "query",
        variables,
      );
    },
    changePassword(
      variables: ChangePasswordMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ChangePasswordMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ChangePasswordMutation>({
            document: ChangePasswordDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "changePassword",
        "mutation",
        variables,
      );
    },
    updateEmailUser(
      variables: UpdateEmailUserMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdateEmailUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdateEmailUserMutation>({
            document: UpdateEmailUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updateEmailUser",
        "mutation",
        variables,
      );
    },
    updatePhoneNumberUser(
      variables: UpdatePhoneNumberUserMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdatePhoneNumberUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdatePhoneNumberUserMutation>({
            document: UpdatePhoneNumberUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "updatePhoneNumberUser",
        "mutation",
        variables,
      );
    },
    sendOtpForgotPassword(
      variables: SendOtpForgotPasswordMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SendOtpForgotPasswordMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SendOtpForgotPasswordMutation>({
            document: SendOtpForgotPasswordDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "sendOtpForgotPassword",
        "mutation",
        variables,
      );
    },
    changeForgotPassword(
      variables: ChangeForgotPasswordMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ChangeForgotPasswordMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ChangeForgotPasswordMutation>({
            document: ChangeForgotPasswordDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "changeForgotPassword",
        "mutation",
        variables,
      );
    },
    forgotEmail(
      variables: ForgotEmailMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ForgotEmailMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ForgotEmailMutation>({
            document: ForgotEmailDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "forgotEmail",
        "mutation",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;

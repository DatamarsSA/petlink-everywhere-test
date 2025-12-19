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
};

export interface Activity {
  __typename?: "Activity";
  calories: Scalars["Int"]["output"];
  climb: Scalars["Int"]["output"];
  date: Scalars["String"]["output"];
  drink: Scalars["Int"]["output"];
  eat: Scalars["Int"]["output"];
  grooming: Scalars["Int"]["output"];
  jumps: Scalars["Int"]["output"];
  play: Scalars["Int"]["output"];
  rest: Scalars["Int"]["output"];
  run: Scalars["Int"]["output"];
  sleep: Scalars["Int"]["output"];
  steps: Scalars["Int"]["output"];
  walk: Scalars["Int"]["output"];
}

export enum ActivityProfileEnum {
  ModeratelyActive = "MODERATELY_ACTIVE",
  Sedentary = "SEDENTARY",
  VeryActive = "VERY_ACTIVE",
}

export enum AddFreePeriod {
  Add_1Year = "ADD_1_YEAR",
  Add_7Days = "ADD_7_DAYS",
  Add_14Days = "ADD_14_DAYS",
  Add_30Days = "ADD_30_DAYS",
  Add_60Days = "ADD_60_DAYS",
  Add_90Days = "ADD_90_DAYS",
}

export interface AddTicketToIssueResponse {
  __typename?: "AddTicketToIssueResponse";
  code: Scalars["String"]["output"];
  issue?: Maybe<Issue>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

/**  Type */
export interface BaseResponse {
  __typename?: "BaseResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface Breed {
  __typename?: "Breed";
  breedName: Scalars["String"]["output"];
  code: Scalars["String"]["output"];
  species: SpeciesEnum;
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
  paymentMethod: PaymentMethodEnum;
  type?: Maybe<Scalars["String"]["output"]>;
}

export interface Color {
  __typename?: "Color";
  code: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
}

export interface Connection {
  __typename?: "Connection";
  battery: Scalars["Int"]["output"];
  connectionDate: Scalars["String"]["output"];
  csq: Scalars["Int"]["output"];
  device: Scalars["String"]["output"];
  deviceId: Scalars["String"]["output"];
  ephemeridi?: Maybe<Scalars["String"]["output"]>;
  firmware: Scalars["String"]["output"];
  fix: Scalars["String"]["output"];
  lat: Scalars["Float"]["output"];
  lng: Scalars["Float"]["output"];
  notify: Array<Maybe<Scalars["String"]["output"]>>;
  postLink?: Maybe<Scalars["String"]["output"]>;
  preLink?: Maybe<Scalars["String"]["output"]>;
  serialId: Scalars["String"]["output"];
  spareC5: Array<Maybe<Scalars["String"]["output"]>>;
  updateFrequency: Scalars["Int"]["output"];
}

export interface Coupon {
  __typename?: "Coupon";
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
}

/**  Enum */
export enum CouponSetMode {
  Apply = "apply",
  Simulate = "simulate",
}

export interface CreateIssueResponse {
  __typename?: "CreateIssueResponse";
  code: Scalars["String"]["output"];
  issue?: Maybe<Issue>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface CreateUserInput {
  active: Scalars["Boolean"]["input"];
  deviceVisibility: Array<DeviceVisibilityEnum>;
  email: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
  role: Array<RoleEnum>;
  surname: Scalars["String"]["input"];
  username?: InputMaybe<Scalars["String"]["input"]>;
  vodafoneCountryVisibility: Array<VodafoneCountryVisibilityEnum>;
}

export interface CreateUserResponse {
  __typename?: "CreateUserResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface CreditNote {
  __typename?: "CreditNote";
  chargebeeCreditNoteId?: Maybe<Scalars["String"]["output"]>;
  chargebeeInvoiceId?: Maybe<Scalars["String"]["output"]>;
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  currencyCode?: Maybe<Scalars["String"]["output"]>;
  customerId: Scalars["String"]["output"];
  entityType: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  invoiceId: Scalars["String"]["output"];
  productId?: Maybe<Scalars["String"]["output"]>;
  refundItems?: Maybe<Array<RefundItem>>;
  refundReason?: Maybe<Scalars["String"]["output"]>;
  refundedAt?: Maybe<Scalars["String"]["output"]>;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
  status?: Maybe<CreditNoteStatusTypeEnum>;
  subscriptionId?: Maybe<Scalars["String"]["output"]>;
  total: Scalars["Int"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  username: Scalars["String"]["output"];
}

export enum CreditNoteStatusTypeEnum {
  Adjusted = "adjusted",
  RefundDue = "refund_due",
  Refunded = "refunded",
  Voided = "voided",
}

export interface Customer {
  __typename?: "Customer";
  appBrand?: Maybe<Scalars["String"]["output"]>;
  chargebeeId?: Maybe<Scalars["String"]["output"]>;
  countryCode: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  emailConfirmed: Scalars["Boolean"]["output"];
  id: Scalars["String"]["output"];
  language: LanguageId;
  name: Scalars["String"]["output"];
  phone: Scalars["String"]["output"];
  phoneConfirmed: Scalars["Boolean"]["output"];
  registrationDate: Scalars["String"]["output"];
  surname: Scalars["String"]["output"];
}

export enum CustomerMood {
  Collaborative = "COLLABORATIVE",
  Critical = "CRITICAL",
  NonCooperative = "NON_COOPERATIVE",
  VeryCritical = "VERY_CRITICAL",
}

export interface DateFilterInput {
  gte?: InputMaybe<Scalars["String"]["input"]>;
  lte?: InputMaybe<Scalars["String"]["input"]>;
}

export interface Device {
  __typename?: "Device";
  battery?: Maybe<Scalars["Float"]["output"]>;
  brand?: Maybe<Scalars["String"]["output"]>;
  country: Scalars["String"]["output"];
  customerBrand?: Maybe<Scalars["String"]["output"]>;
  customerCountry?: Maybe<Scalars["String"]["output"]>;
  customerEmail?: Maybe<Scalars["String"]["output"]>;
  customerId: Scalars["String"]["output"];
  customerLanguage?: Maybe<LanguageId>;
  customerName?: Maybe<Scalars["String"]["output"]>;
  customerSurname?: Maybe<Scalars["String"]["output"]>;
  deviceId: Scalars["String"]["output"];
  factory?: Maybe<Scalars["String"]["output"]>;
  firmware: Scalars["String"]["output"];
  group?: Maybe<Scalars["String"]["output"]>;
  hardwareType?: Maybe<Scalars["String"]["output"]>;
  hasEverSubscriptionActive?: Maybe<Scalars["Boolean"]["output"]>;
  hasSubscriptionActive?: Maybe<Scalars["Boolean"]["output"]>;
  iccid: Scalars["String"]["output"];
  imei: Scalars["String"]["output"];
  lastActivatedSubscriptionExpiringDate?: Maybe<Scalars["String"]["output"]>;
  lastActivatedSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  lastConnectionDate?: Maybe<Scalars["String"]["output"]>;
  lastOperationInAppDate?: Maybe<Scalars["String"]["output"]>;
  lastPurchasedSubscriptionExpiringDate?: Maybe<Scalars["String"]["output"]>;
  lastPurchasedSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  /**   non so se è un enum */
  lat?: Maybe<Scalars["Float"]["output"]>;
  lng?: Maybe<Scalars["Float"]["output"]>;
  logEnabled?: Maybe<Scalars["Boolean"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  petId: Scalars["String"]["output"];
  planProfileId?: Maybe<Scalars["String"]["output"]>;
  planProfileType?: Maybe<Scalars["String"]["output"]>;
  registrationDate: Scalars["String"]["output"];
  serialId: Scalars["String"]["output"];
  simManufacturer?: Maybe<Scalars["String"]["output"]>;
  simStatus: SimStatusEnum;
  testingDate?: Maybe<Scalars["String"]["output"]>;
  /**   check which object is this */
  timezone?: Maybe<Scalars["String"]["output"]>;
  updateFrequency?: Maybe<Scalars["Float"]["output"]>;
  vodafoneCountry?: Maybe<Scalars["String"]["output"]>;
}

export interface DeviceAction {
  __typename?: "DeviceAction";
  timestamp: Scalars["String"]["output"];
  type: Scalars["String"]["output"];
}

export interface DeviceCoupon {
  __typename?: "DeviceCoupon";
  couponId: Scalars["String"]["output"];
  couponName: Scalars["String"]["output"];
  creationDate?: Maybe<Scalars["String"]["output"]>;
  serialNumber: Scalars["String"]["output"];
  userEmail?: Maybe<Scalars["String"]["output"]>;
  userId?: Maybe<Scalars["String"]["output"]>;
}

export interface DeviceInsuranceInfo {
  __typename?: "DeviceInsuranceInfo";
  action?: Maybe<DeviceAction>;
  id?: Maybe<Scalars["String"]["output"]>;
  imei?: Maybe<Scalars["String"]["output"]>;
  newDeviceId?: Maybe<Scalars["String"]["output"]>;
  registered?: Maybe<Scalars["String"]["output"]>;
  serialNumber: Scalars["String"]["output"];
  subscriptionEnd?: Maybe<Scalars["String"]["output"]>;
}

export interface DeviceMap {
  __typename?: "DeviceMap";
  customerId: Scalars["String"]["output"];
  deviceId: Scalars["String"]["output"];
  lastConnectionDate?: Maybe<Scalars["String"]["output"]>;
  lat?: Maybe<Scalars["Float"]["output"]>;
  lng?: Maybe<Scalars["Float"]["output"]>;
  petId: Scalars["String"]["output"];
  serialId: Scalars["String"]["output"];
}

export enum DeviceVisibilityEnum {
  Kippy = "KIPPY",
  Petlink = "PETLINK",
  Vodafone = "VODAFONE",
}

export interface DiscoutItem {
  __typename?: "DiscoutItem";
  amount: Scalars["Float"]["output"];
  chargebeeInvoiceItemId: Scalars["String"]["output"];
  couponId: Scalars["String"]["output"];
  discountPercentage?: Maybe<Scalars["Float"]["output"]>;
  discountType: Scalars["String"]["output"];
}

export interface DunningAttemptsItem {
  __typename?: "DunningAttemptsItem";
  attempt: Scalars["Int"]["output"];
  createdAt: Scalars["String"]["output"];
  status: Scalars["String"]["output"];
  transactionId: Scalars["String"]["output"];
}

export enum FilterEnum {
  And = "AND",
  Or = "OR",
}

export interface GetActivitiesResponse {
  __typename?: "GetActivitiesResponse";
  code: Scalars["String"]["output"];
  items: Array<Activity>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetConnectionsHistoryInput {
  connectionDate?: InputMaybe<DateFilterInput>;
  device?: InputMaybe<Scalars["String"]["input"]>;
  ephemeridi?: InputMaybe<Scalars["String"]["input"]>;
  filterType: FilterEnum;
  firmware?: InputMaybe<Scalars["String"]["input"]>;
  notify?: InputMaybe<Scalars["String"]["input"]>;
  postLink?: InputMaybe<Scalars["String"]["input"]>;
  preLink?: InputMaybe<Scalars["String"]["input"]>;
  spareC5?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetConnectionsHistoryResponse {
  __typename?: "GetConnectionsHistoryResponse";
  code: Scalars["String"]["output"];
  items: Array<Connection>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetCouponsResponse {
  __typename?: "GetCouponsResponse";
  code: Scalars["String"]["output"];
  coupons: Array<Coupon>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetCustomerResponse {
  __typename?: "GetCustomerResponse";
  code: Scalars["String"]["output"];
  customer?: Maybe<Customer>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetCustomersInput {
  email?: InputMaybe<Scalars["String"]["input"]>;
  emailConfirmed?: InputMaybe<Scalars["Boolean"]["input"]>;
  filterType: FilterEnum;
  id?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  phoneConfirmed?: InputMaybe<Scalars["Boolean"]["input"]>;
  registrationDate?: InputMaybe<DateFilterInput>;
  surname?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetCustomersResponse {
  __typename?: "GetCustomersResponse";
  code: Scalars["String"]["output"];
  items: Array<Customer>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetDeviceResponse {
  __typename?: "GetDeviceResponse";
  code: Scalars["String"]["output"];
  device?: Maybe<Device>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetDevicesInput {
  battery?: InputMaybe<Scalars["Float"]["input"]>;
  customerCountry?: InputMaybe<Scalars["String"]["input"]>;
  customerEmail?: InputMaybe<Scalars["String"]["input"]>;
  customerEmailOrSerialNumber?: InputMaybe<Scalars["String"]["input"]>;
  customerId?: InputMaybe<Scalars["String"]["input"]>;
  customerLanguage?: InputMaybe<LanguageId>;
  customerName?: InputMaybe<Scalars["String"]["input"]>;
  customerSurname?: InputMaybe<Scalars["String"]["input"]>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  filterType: FilterEnum;
  firmware?: InputMaybe<Scalars["String"]["input"]>;
  hardwareType?: InputMaybe<Scalars["String"]["input"]>;
  hasEverSubscriptionActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  hasSubscriptionActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  iccid?: InputMaybe<Scalars["String"]["input"]>;
  imei?: InputMaybe<Scalars["String"]["input"]>;
  lastConnectionDate?: InputMaybe<DateFilterInput>;
  lat?: InputMaybe<Scalars["Float"]["input"]>;
  lng?: InputMaybe<Scalars["Float"]["input"]>;
  petId?: InputMaybe<Scalars["String"]["input"]>;
  planProfileType?: InputMaybe<Scalars["String"]["input"]>;
  registrationDate?: InputMaybe<DateFilterInput>;
  serialId?: InputMaybe<Scalars["String"]["input"]>;
  timezone?: InputMaybe<Scalars["String"]["input"]>;
  updateFrequency?: InputMaybe<Scalars["Float"]["input"]>;
  vodafoneCountry?: InputMaybe<LanguageId>;
}

export interface GetDevicesMapInput {
  lastConnectionDate: Scalars["String"]["input"];
}

export interface GetDevicesMapResponse {
  __typename?: "GetDevicesMapResponse";
  code: Scalars["String"]["output"];
  items: Array<DeviceMap>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetDevicesResponse {
  __typename?: "GetDevicesResponse";
  code: Scalars["String"]["output"];
  items: Array<Device>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetDevicesWithCouponInput {
  couponId?: InputMaybe<Scalars["String"]["input"]>;
  filterType: Scalars["String"]["input"];
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetDevicesWithCouponResponse {
  __typename?: "GetDevicesWithCouponResponse";
  code: Scalars["String"]["output"];
  items: Array<DeviceCoupon>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetInsuranceDevicesInfoResponse {
  __typename?: "GetInsuranceDevicesInfoResponse";
  code: Scalars["String"]["output"];
  items: Array<DeviceInsuranceInfo>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetIssuesResponse {
  __typename?: "GetIssuesResponse";
  code: Scalars["String"]["output"];
  items: Array<Issue>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetLogActivityUserInput {
  activityType?: InputMaybe<Scalars["String"]["input"]>;
  creationDate?: InputMaybe<DateFilterInput>;
  filterType: Scalars["String"]["input"];
  id?: InputMaybe<Scalars["String"]["input"]>;
  userId?: InputMaybe<Scalars["String"]["input"]>;
  userName?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetLogActivityUserResponse {
  __typename?: "GetLogActivityUserResponse";
  code: Scalars["String"]["output"];
  items: Array<LogActivityUser>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetMyInfoResponse {
  __typename?: "GetMyInfoResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface GetOrderResponse {
  __typename?: "GetOrderResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  order?: Maybe<Order>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetOrdersResponse {
  __typename?: "GetOrdersResponse";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<OrderListItem>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetPetResponse {
  __typename?: "GetPetResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  pet?: Maybe<Pet>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetPlanProfilesResponse {
  __typename?: "GetPlanProfilesResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  planProfiles: Array<PlanProfiles>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetShelterOrdersInput {
  billingCompany?: InputMaybe<Scalars["String"]["input"]>;
  dmosBpid?: InputMaybe<Scalars["String"]["input"]>;
  filterType: FilterEnum;
  lastOrderDate?: InputMaybe<DateFilterInput>;
}

export interface GetSubscriptionResponse {
  __typename?: "GetSubscriptionResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  subscription?: Maybe<PetlinkSubscription>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetSubscriptionsCancelled {
  cancelReason?: InputMaybe<Scalars["String"]["input"]>;
  cancelReasonCode?: InputMaybe<CancelReasonCodeEnum>;
  chargebeeSubscriptionId?: InputMaybe<Scalars["String"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  countryCode?: InputMaybe<Scalars["String"]["input"]>;
  creationDate?: InputMaybe<DateFilterInput>;
  customerId?: InputMaybe<Scalars["String"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  filterType: FilterEnum;
  firstname?: InputMaybe<Scalars["String"]["input"]>;
  lastname?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  streetAddress?: InputMaybe<Scalars["String"]["input"]>;
  updateDate?: InputMaybe<DateFilterInput>;
  zipCode?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetSubscriptionsCancelledResponse {
  __typename?: "GetSubscriptionsCancelledResponse";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<Maybe<SubscriptionCancelled>>>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetSubscriptionsPrepaidInput {
  addonId?: InputMaybe<Scalars["String"]["input"]>;
  cancelled?: InputMaybe<Scalars["Boolean"]["input"]>;
  creationDate?: InputMaybe<DateFilterInput>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  filterType: FilterEnum;
  imei?: InputMaybe<Scalars["String"]["input"]>;
  orderId?: InputMaybe<Scalars["String"]["input"]>;
  registered?: InputMaybe<Scalars["Boolean"]["input"]>;
  subscriptionId?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetSubscriptionsPreregistrationResponse {
  __typename?: "GetSubscriptionsPreregistrationResponse";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<PreregistrationSubscription>>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetSubscriptionsResponse {
  __typename?: "GetSubscriptionsResponse";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<PetlinkSubscription>>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface GetUserResponse {
  __typename?: "GetUserResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface GetUsersInput {
  email?: InputMaybe<Scalars["String"]["input"]>;
  filterType: Scalars["String"]["input"];
  id?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  surname?: InputMaybe<Scalars["String"]["input"]>;
}

export interface GetUsersResponse {
  __typename?: "GetUsersResponse";
  code: Scalars["String"]["output"];
  items: Array<User>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface Invoice {
  __typename?: "Invoice";
  billingAddress?: Maybe<InvoiceBillingAddress>;
  businessEntityId: Scalars["String"]["output"];
  chargebeeInvoiceId: Scalars["String"]["output"];
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  currencyCode: Scalars["String"]["output"];
  discountItems?: Maybe<Array<DiscoutItem>>;
  entityType: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  items: Array<InvoiceItem>;
  notes?: Maybe<Scalars["String"]["output"]>;
  status: InvoiceStatusEnum;
  subscriptionId?: Maybe<Scalars["String"]["output"]>;
  total: Scalars["Int"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface InvoiceBillingAddress {
  __typename?: "InvoiceBillingAddress";
  address?: Maybe<Scalars["String"]["output"]>;
  city?: Maybe<Scalars["String"]["output"]>;
  country?: Maybe<Scalars["String"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  firstName?: Maybe<Scalars["String"]["output"]>;
  lastName?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
}

export interface InvoiceItem {
  __typename?: "InvoiceItem";
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

export interface Issue {
  __typename?: "Issue";
  creationDate: Scalars["String"]["output"];
  customerId: Scalars["String"]["output"];
  customerIssues: Array<TicketIssue>;
  deviceId: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  tickets: Array<Ticket>;
  zendeskId: Scalars["String"]["output"];
}

export interface IssueInput {
  customerId: Scalars["String"]["input"];
  customerIssues: Array<TicketIssue>;
  deviceId: Scalars["String"]["input"];
  tickets: Array<TicketInput>;
  zendeskId: Scalars["String"]["input"];
}

export enum LanguageId {
  De = "DE",
  En = "EN",
  Es = "ES",
  Fr = "FR",
  It = "IT",
}

export interface LogActivityUser {
  __typename?: "LogActivityUser";
  activityType: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  request: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  userName: Scalars["String"]["output"];
}

export interface MigrationItem {
  __typename?: "MigrationItem";
  /**   ACTIVITIES */
  activitiesMigrated?: Maybe<Scalars["Int"]["output"]>;
  activitiesTotal?: Maybe<Scalars["Int"]["output"]>;
  /**   ENERGY_SAVING_AREAS */
  areasMigrated?: Maybe<Scalars["Int"]["output"]>;
  areasTotal?: Maybe<Scalars["Int"]["output"]>;
  /**   SUBSCRIPTIONS */
  chargebeeSubscriptionsMigrated?: Maybe<Scalars["Int"]["output"]>;
  chargebeeSubscriptionsTotal?: Maybe<Scalars["Int"]["output"]>;
  creditNotesMigrated?: Maybe<Scalars["Int"]["output"]>;
  creditNotesTotal?: Maybe<Scalars["Int"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  endedAt?: Maybe<Scalars["String"]["output"]>;
  /**   GEOFENCES */
  geofencesMigrated?: Maybe<Scalars["Int"]["output"]>;
  geofencesTotal?: Maybe<Scalars["Int"]["output"]>;
  includedSubscriptionsMigrated?: Maybe<Scalars["Int"]["output"]>;
  includedSubscriptionsTotal?: Maybe<Scalars["Int"]["output"]>;
  invoicesMigrated?: Maybe<Scalars["Int"]["output"]>;
  invoicesTotal?: Maybe<Scalars["Int"]["output"]>;
  migrationTarget: MigrationTargets;
  /**   PET_NOTIFICATIONS */
  notificationsMigrated?: Maybe<Scalars["Int"]["output"]>;
  notificationsTotal?: Maybe<Scalars["Int"]["output"]>;
  petProtectionsMigrated?: Maybe<Scalars["Int"]["output"]>;
  petProtectionsTotal?: Maybe<Scalars["Int"]["output"]>;
  /**   PETS_AND_PRODUCTS */
  petsMigrated?: Maybe<Scalars["Int"]["output"]>;
  petsTotal?: Maybe<Scalars["Int"]["output"]>;
  /**   POSITION_HISTORY */
  positionHistoriesMigrated?: Maybe<Scalars["Int"]["output"]>;
  positionHistoriesTotal?: Maybe<Scalars["Int"]["output"]>;
  productsMigrated?: Maybe<Scalars["Int"]["output"]>;
  productsTotal?: Maybe<Scalars["Int"]["output"]>;
  replacementsMigrated?: Maybe<Scalars["Int"]["output"]>;
  replacementsTotal?: Maybe<Scalars["Int"]["output"]>;
  /**   RESETS_AND_REPLACEMENTS */
  resetsMigrated?: Maybe<Scalars["Int"]["output"]>;
  resetsTotal?: Maybe<Scalars["Int"]["output"]>;
  sessionId: Scalars["String"]["output"];
  startedAt?: Maybe<Scalars["String"]["output"]>;
  userId: Scalars["String"]["output"];
  /**   USER */
  usersMigrated?: Maybe<Scalars["Int"]["output"]>;
}

export interface MigrationItemShortInfo {
  __typename?: "MigrationItemShortInfo";
  sessionId: Scalars["String"]["output"];
  startedAt?: Maybe<Scalars["String"]["output"]>;
}

export enum MigrationTargets {
  Activities = "ACTIVITIES",
  EnergySavingAreas = "ENERGY_SAVING_AREAS",
  Geofences = "GEOFENCES",
  PetsAndProducts = "PETS_AND_PRODUCTS",
  PetNotifications = "PET_NOTIFICATIONS",
  PositionHistory = "POSITION_HISTORY",
  ResetsAndReplacements = "RESETS_AND_REPLACEMENTS",
  Subscriptions = "SUBSCRIPTIONS",
  User = "USER",
}

export interface Mutation {
  __typename?: "Mutation";
  addFreePeriod: BaseResponse;
  addTicketToIssue: AddTicketToIssueResponse;
  createIssue: CreateIssueResponse;
  createSubscription: BaseResponse;
  createUser: CreateUserResponse;
  deleteCustomer: BaseResponse;
  deleteUser: BaseResponse;
  hidePet?: Maybe<BaseResponse>;
  logEnabled?: Maybe<BaseResponse>;
  refundInvoice?: Maybe<BaseResponse>;
  renewInsuranceSubscription?: Maybe<BaseResponse>;
  resetPetlinkGps: BaseResponse;
  setCoupon: SetCouponResponse;
  setPlanProfiles: SetPlanProfilesResponse;
  stopRenewingAddon?: Maybe<BaseResponse>;
  stopRenewingSubscription?: Maybe<BaseResponse>;
  updateCurrentTermEnd: GetSubscriptionResponse;
  updateCustomer: UpdateCustomerResponse;
  /**
   *   updateRoleUser(userInfo: UpdateUserRoleInput!): UpdateUserRoleResponse!
   * @aws_cognito_user_pools (cognito_groups:["SUPERADMIN"])
   */
  updateUser: UpdateUserResponse;
}

export type MutationAddFreePeriodArgs = {
  freePeriod: AddFreePeriod;
  productId?: InputMaybe<Scalars["String"]["input"]>;
  serialNumber?: InputMaybe<Scalars["String"]["input"]>;
};

export type MutationAddTicketToIssueArgs = {
  issueId: Scalars["String"]["input"];
  ticket?: InputMaybe<TicketInput>;
};

export type MutationCreateIssueArgs = {
  issue: IssueInput;
};

export type MutationCreateSubscriptionArgs = {
  customerId: Scalars["String"]["input"];
  planChangeNotAllowed?: InputMaybe<Scalars["Boolean"]["input"]>;
  productId: Scalars["String"]["input"];
};

export type MutationCreateUserArgs = {
  user: CreateUserInput;
};

export type MutationDeleteCustomerArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteUserArgs = {
  id: Scalars["String"]["input"];
};

export type MutationHidePetArgs = {
  hide: Scalars["Boolean"]["input"];
  petId: Scalars["String"]["input"];
};

export type MutationLogEnabledArgs = {
  deviceId: Scalars["String"]["input"];
  enable: Scalars["Boolean"]["input"];
};

export type MutationRefundInvoiceArgs = {
  invoiceId: Scalars["String"]["input"];
  reason: Scalars["String"]["input"];
  refunds: Array<RefundItemInput>;
};

export type MutationRenewInsuranceSubscriptionArgs = {
  notes: Scalars["String"]["input"];
  productId: Scalars["String"]["input"];
};

export type MutationResetPetlinkGpsArgs = {
  id: Scalars["String"]["input"];
};

export type MutationSetCouponArgs = {
  couponId: Scalars["String"]["input"];
  serialNumbers: Array<Scalars["String"]["input"]>;
  setMode?: InputMaybe<CouponSetMode>;
};

export type MutationSetPlanProfilesArgs = {
  planProfileId: Scalars["String"]["input"];
  serialNumbers: Array<Scalars["String"]["input"]>;
};

export type MutationStopRenewingAddonArgs = {
  itemPriceIds: Array<Scalars["String"]["input"]>;
  subscriptionId: Scalars["String"]["input"];
};

export type MutationStopRenewingSubscriptionArgs = {
  subscriptionId: Scalars["String"]["input"];
};

export type MutationUpdateCurrentTermEndArgs = {
  newTermEnd: Scalars["String"]["input"];
  subscriptionId: Scalars["String"]["input"];
};

export type MutationUpdateCustomerArgs = {
  customerId: Scalars["String"]["input"];
  updateCustomer: UpdateCustomerInput;
};

export type MutationUpdateUserArgs = {
  userInfo: UpdateUserInput;
};

export interface Order {
  __typename?: "Order";
  billingAddress: OrderAddress;
  creationDate?: Maybe<Scalars["String"]["output"]>;
  currency: Scalars["String"]["output"];
  customer: OrderCustomer;
  dmosOrderId?: Maybe<Scalars["String"]["output"]>;
  externalOrderId: Scalars["Float"]["output"];
  externalOrderName: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  kippyId: Scalars["Float"]["output"];
  lineItems: Array<OrderLineItem>;
  orderSource: Scalars["String"]["output"];
  packItems?: Maybe<Array<OrderPacksItem>>;
  paymentMethod: Scalars["String"]["output"];
  shippingAddress: OrderAddress;
  status: Scalars["String"]["output"];
  total: Scalars["String"]["output"];
  trackingCode?: Maybe<Scalars["String"]["output"]>;
  trackingService?: Maybe<Scalars["String"]["output"]>;
  trackingUrl?: Maybe<Scalars["String"]["output"]>;
  updateDate?: Maybe<Scalars["String"]["output"]>;
}

export interface OrderAddress {
  __typename?: "OrderAddress";
  address: Scalars["String"]["output"];
  city: Scalars["String"]["output"];
  company?: Maybe<Scalars["String"]["output"]>;
  country: Scalars["String"]["output"];
  firstName: Scalars["String"]["output"];
  lastName: Scalars["String"]["output"];
  province: Scalars["String"]["output"];
  zip: Scalars["String"]["output"];
}

export interface OrderCustomer {
  __typename?: "OrderCustomer";
  chargebeeId?: Maybe<Scalars["String"]["output"]>;
  dmosBpid?: Maybe<Scalars["String"]["output"]>;
  email: Scalars["String"]["output"];
  firstName: Scalars["String"]["output"];
  lastName: Scalars["String"]["output"];
  phone: Scalars["String"]["output"];
}

export enum OrderEnum {
  Asc = "asc",
  Desc = "desc",
}

export interface OrderInput {
  field: Scalars["String"]["input"];
  order: OrderEnum;
}

export interface OrderLineItem {
  __typename?: "OrderLineItem";
  activated?: Maybe<Scalars["Boolean"]["output"]>;
  amount: Scalars["String"]["output"];
  externalItemId: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  imei?: Maybe<Scalars["String"]["output"]>;
  kippyId: Scalars["Int"]["output"];
  kippySku: Scalars["String"]["output"];
  orderId: Scalars["String"]["output"];
  quantity: Scalars["Int"]["output"];
  serialNumber: Scalars["String"]["output"];
}

export interface OrderListItem {
  __typename?: "OrderListItem";
  billingAddress: OrderAddress;
  currency: Scalars["String"]["output"];
  customer: OrderCustomer;
  externalOrderId: Scalars["Float"]["output"];
  externalOrderName: Scalars["String"]["output"];
  kippyId: Scalars["Int"]["output"];
  orderSource: Scalars["String"]["output"];
  paymentMethod: Scalars["String"]["output"];
  shippingAddress: OrderAddress;
  status: Scalars["String"]["output"];
  total: Scalars["String"]["output"];
  trackingCode?: Maybe<Scalars["String"]["output"]>;
  trackingService?: Maybe<Scalars["String"]["output"]>;
  trackingUrl?: Maybe<Scalars["String"]["output"]>;
}

export interface OrderPacksItem {
  __typename?: "OrderPacksItem";
  amount: Scalars["String"]["output"];
  description: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  orderId: Scalars["String"]["output"];
  packId: Scalars["String"]["output"];
  planId?: Maybe<Scalars["String"]["output"]>;
  sku: Scalars["String"]["output"];
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

export enum PaymentMethodEnum {
  Card = "CARD",
  Paypal = "PAYPAL",
}

export enum PaymentStatusTypeEnum {
  Failed = "FAILED",
  Pending = "PENDING",
  Succeeded = "SUCCEEDED",
}

export interface Pet {
  __typename?: "Pet";
  activityProfile: ActivityProfileEnum;
  birthDate?: Maybe<Scalars["String"]["output"]>;
  breedType: Scalars["String"]["output"];
  breeds: Array<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  dateMarkedAsLost?: Maybe<Scalars["String"]["output"]>;
  gender: Scalars["String"]["output"];
  hidden?: Maybe<Scalars["Boolean"]["output"]>;
  id: Scalars["String"]["output"];
  length?: Maybe<Scalars["Float"]["output"]>;
  name: Scalars["String"]["output"];
  neutered?: Maybe<Scalars["Boolean"]["output"]>;
  petProtection?: Maybe<PetProtectionShortInfo>;
  primaryColor?: Maybe<Scalars["String"]["output"]>;
  species: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  weight?: Maybe<Scalars["Float"]["output"]>;
}

export interface PetProtection {
  __typename?: "PetProtection";
  card?: Maybe<Card>;
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  codiceTessera?: Maybe<Scalars["String"]["output"]>;
  creditNotes?: Maybe<Array<CreditNote>>;
  currencyCode: Scalars["String"]["output"];
  currentTermEnd: Scalars["String"]["output"];
  currentTermStart: Scalars["String"]["output"];
  customerId: Scalars["String"]["output"];
  customerServiceContact: Scalars["String"]["output"];
  fileName?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  invoice?: Maybe<Invoice>;
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

export interface PetProtectionPetData {
  __typename?: "PetProtectionPetData";
  birthDate?: Maybe<Scalars["String"]["output"]>;
  breed: Scalars["String"]["output"];
  gender: Scalars["String"]["output"];
  microchip?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  species: Scalars["String"]["output"];
}

export interface PetProtectionShortInfo {
  __typename?: "PetProtectionShortInfo";
  currentTermEnd: Scalars["String"]["output"];
  currentTermStart: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  status: PetProtectionStatus;
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

export interface PetlinkSubscription {
  __typename?: "PetlinkSubscription";
  activatedAt?: Maybe<Scalars["String"]["output"]>;
  addedFreePeriod?: Maybe<Scalars["Int"]["output"]>;
  addonToStopIds?: Maybe<Array<Scalars["String"]["output"]>>;
  availableDeviceProtectionReplacements?: Maybe<Scalars["Int"]["output"]>;
  billingPeriod?: Maybe<Scalars["Int"]["output"]>;
  billingPeriodUnit?: Maybe<Scalars["String"]["output"]>;
  businessEntityId: Scalars["String"]["output"];
  cancelReason?: Maybe<Scalars["String"]["output"]>;
  cancelReasonCode?: Maybe<CancelReasonCodeEnum>;
  cancelledAt?: Maybe<Scalars["String"]["output"]>;
  card?: Maybe<Card>;
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  creditNotes?: Maybe<Array<CreditNote>>;
  currencyCode: Scalars["String"]["output"];
  currentTermEnd?: Maybe<Scalars["String"]["output"]>;
  currentTermStart?: Maybe<Scalars["String"]["output"]>;
  dunningAttempts?: Maybe<Array<DunningAttemptsItem>>;
  entityType: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  imei?: Maybe<Scalars["String"]["output"]>;
  invoice?: Maybe<Invoice>;
  moved?: Maybe<Scalars["String"]["output"]>;
  movedFrom?: Maybe<Scalars["String"]["output"]>;
  nextBillingAt?: Maybe<Scalars["String"]["output"]>;
  nextPaymentRetryAt?: Maybe<Scalars["String"]["output"]>;
  note?: Maybe<Scalars["String"]["output"]>;
  orderId?: Maybe<Scalars["String"]["output"]>;
  paymentStatus?: Maybe<PaymentStatusTypeEnum>;
  planChangeNotAllowed?: Maybe<Scalars["Boolean"]["output"]>;
  productId?: Maybe<Scalars["String"]["output"]>;
  retentionCoupon?: Maybe<RetentionDiscountItem>;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
  startedAt?: Maybe<Scalars["String"]["output"]>;
  status?: Maybe<SubscriptionStatusEnum>;
  subscriptionItems: Array<SubscriptionItem>;
  totalDeviceProtectionReplacements?: Maybe<Scalars["Int"]["output"]>;
  updateDate: Scalars["String"]["output"];
  updatedAt: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
}

export interface PlanProfiles {
  __typename?: "PlanProfiles";
  brands?: Maybe<Array<Scalars["String"]["output"]>>;
  id: Scalars["String"]["output"];
  trialDuration: Scalars["Int"]["output"];
}

export interface PreregistrationSubscription {
  __typename?: "PreregistrationSubscription";
  addedFreePeriod?: Maybe<Scalars["Int"]["output"]>;
  creationDate: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  serialNumber: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
}

export interface Query {
  __typename?: "Query";
  getActivities: GetActivitiesResponse;
  getBreed: ResponseGetBreed;
  getColors: ResponseGetColors;
  getConnectionsHistory: GetConnectionsHistoryResponse;
  getCoupons: GetCouponsResponse;
  getCustomer: GetCustomerResponse;
  getCustomers: GetCustomersResponse;
  getDevice: GetDeviceResponse;
  getDeviceProtectionReplacements: ResponseGetDeviceProtectionReplacements;
  getDevices: GetDevicesResponse;
  getDevicesMap: GetDevicesMapResponse;
  getDevicesWithCoupon: GetDevicesWithCouponResponse;
  getInsuranceDevicesInfo: GetInsuranceDevicesInfoResponse;
  getIssues: GetIssuesResponse;
  getLogActivityUser: GetLogActivityUserResponse;
  getMigrationSession: ResponseGetMigrationSession;
  getMigrationSessions: ResponseGetMigrationSessions;
  getMyInfo: GetMyInfoResponse;
  getOrder: GetOrderResponse;
  getOrders: GetOrdersResponse;
  getPet: GetPetResponse;
  getPetProtection: ResponseGetPetProtection;
  getPetProtections: ResponseGetPetProtections;
  getPlanProfiles: GetPlanProfilesResponse;
  getReplacementPetlinkGpsHistory: ResponseGetReplacementHistory;
  getShelterOrder: ResponseGetShelterOrder;
  getShelterOrders: ResponseGetShelterOrders;
  getSubscription: GetSubscriptionResponse;
  getSubscriptions: GetSubscriptionsResponse;
  getSubscriptionsCancelled: GetSubscriptionsCancelledResponse;
  getSubscriptionsPrepaid?: Maybe<GetSubscriptionsResponse>;
  getSubscriptionsPreregistration?: Maybe<GetSubscriptionsPreregistrationResponse>;
  getUser: GetUserResponse;
  getUsers: GetUsersResponse;
}

export type QueryGetActivitiesArgs = {
  date?: InputMaybe<DateFilterInput>;
  deviceId: Scalars["String"]["input"];
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetBreedArgs = {
  languageId?: InputMaybe<LanguageId>;
  species: SpeciesEnum;
};

export type QueryGetColorsArgs = {
  languageId?: InputMaybe<LanguageId>;
  species: SpeciesEnum;
};

export type QueryGetConnectionsHistoryArgs = {
  deviceId: Scalars["String"]["input"];
  filter?: InputMaybe<GetConnectionsHistoryInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetCustomerArgs = {
  customerId: Scalars["String"]["input"];
};

export type QueryGetCustomersArgs = {
  filter?: InputMaybe<GetCustomersInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetDeviceArgs = {
  deviceId: Scalars["String"]["input"];
};

export type QueryGetDeviceProtectionReplacementsArgs = {
  productId: Scalars["String"]["input"];
};

export type QueryGetDevicesArgs = {
  filter?: InputMaybe<GetDevicesInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetDevicesMapArgs = {
  filter?: InputMaybe<GetDevicesMapInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetDevicesWithCouponArgs = {
  filter?: InputMaybe<GetDevicesWithCouponInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetInsuranceDevicesInfoArgs = {
  deviceList: Array<Scalars["String"]["input"]>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetIssuesArgs = {
  deviceId: Scalars["String"]["input"];
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetLogActivityUserArgs = {
  filter?: InputMaybe<GetLogActivityUserInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetMigrationSessionArgs = {
  sessionId: Scalars["String"]["input"];
};

export type QueryGetMigrationSessionsArgs = {
  email: Scalars["String"]["input"];
};

export type QueryGetOrderArgs = {
  orderId?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryGetOrdersArgs = {
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetPetArgs = {
  petId: Scalars["String"]["input"];
};

export type QueryGetPetProtectionArgs = {
  petProtectionId: Scalars["String"]["input"];
};

export type QueryGetPetProtectionsArgs = {
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
  petId: Scalars["String"]["input"];
};

export type QueryGetReplacementPetlinkGpsHistoryArgs = {
  productId: Scalars["String"]["input"];
};

export type QueryGetShelterOrderArgs = {
  dmosBpid: Scalars["String"]["input"];
};

export type QueryGetShelterOrdersArgs = {
  filter?: InputMaybe<GetShelterOrdersInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetSubscriptionArgs = {
  id: Scalars["String"]["input"];
};

export type QueryGetSubscriptionsArgs = {
  deviceId: Scalars["String"]["input"];
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetSubscriptionsCancelledArgs = {
  filter?: InputMaybe<GetSubscriptionsCancelled>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetSubscriptionsPrepaidArgs = {
  filter?: InputMaybe<GetSubscriptionsPrepaidInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetSubscriptionsPreregistrationArgs = {
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export type QueryGetUserArgs = {
  userId: Scalars["String"]["input"];
};

export type QueryGetUsersArgs = {
  filter?: InputMaybe<GetUsersInput>;
  order?: InputMaybe<OrderInput>;
  pagination?: InputMaybe<PaginationInput>;
};

export interface RefundItem {
  __typename?: "RefundItem";
  amount: Scalars["Int"]["output"];
  chargebeeInvoiceItemId: Scalars["String"]["output"];
}

/**  Input */
export interface RefundItemInput {
  amount: Scalars["Int"]["input"];
  chargebeeInvoiceItemId: Scalars["String"]["input"];
}

export interface ReplacementHistory {
  __typename?: "ReplacementHistory";
  brand?: Maybe<Scalars["String"]["output"]>;
  creationDate: Scalars["String"]["output"];
  customerEmail: Scalars["String"]["output"];
  deviceProtectionId?: Maybe<Scalars["String"]["output"]>;
  expirationDate?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  model?: Maybe<Scalars["String"]["output"]>;
  newSerialNumber?: Maybe<Scalars["String"]["output"]>;
  oldSerialNumber: Scalars["String"]["output"];
  petId: Scalars["String"]["output"];
  planProfileId?: Maybe<Scalars["String"]["output"]>;
  planProfileType?: Maybe<Scalars["String"]["output"]>;
  productId?: Maybe<Scalars["String"]["output"]>;
  reasonCode?: Maybe<Array<TicketActionReason>>;
  registrationDate: Scalars["String"]["output"];
  typeAction?: Maybe<TicketAction>;
  userId?: Maybe<Scalars["String"]["output"]>;
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

export interface ResponseGetDeviceProtectionReplacements {
  __typename?: "ResponseGetDeviceProtectionReplacements";
  code: Scalars["String"]["output"];
  hasProtection?: Maybe<Scalars["Boolean"]["output"]>;
  message: Scalars["String"]["output"];
  replacementsDone?: Maybe<Scalars["Int"]["output"]>;
  replacementsLeft?: Maybe<Scalars["Int"]["output"]>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetMigrationSession {
  __typename?: "ResponseGetMigrationSession";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<MigrationItem>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetMigrationSessions {
  __typename?: "ResponseGetMigrationSessions";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<MigrationItemShortInfo>>;
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

export interface ResponseGetPetProtections {
  __typename?: "ResponseGetPetProtections";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<PetProtection>>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetReplacementHistory {
  __typename?: "ResponseGetReplacementHistory";
  code: Scalars["String"]["output"];
  items?: Maybe<Array<ReplacementHistory>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetShelterOrder {
  __typename?: "ResponseGetShelterOrder";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  orderList?: Maybe<Array<ShelterOrder>>;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface ResponseGetShelterOrders {
  __typename?: "ResponseGetShelterOrders";
  code: Scalars["String"]["output"];
  items: Array<ShelterOrderRecap>;
  message: Scalars["String"]["output"];
  pagination: Pagination;
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface RetentionDiscountItem {
  __typename?: "RetentionDiscountItem";
  amount?: Maybe<Scalars["Float"]["output"]>;
  couponId: Scalars["String"]["output"];
  couponName: Scalars["String"]["output"];
  discountPercentage?: Maybe<Scalars["Float"]["output"]>;
  discountType: Scalars["String"]["output"];
}

export enum RoleEnum {
  L1 = "L1",
  L2 = "L2",
  Superadmin = "SUPERADMIN",
  Superreader = "SUPERREADER",
}

export interface SetCouponResponse {
  __typename?: "SetCouponResponse";
  code: Scalars["String"]["output"];
  failureList: Array<Scalars["String"]["output"]>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  warningList: Array<Scalars["String"]["output"]>;
}

export interface ShelterOrder {
  __typename?: "ShelterOrder";
  description: Scalars["String"]["output"];
  deviceActiveCount: Scalars["Int"]["output"];
  deviceCount: Scalars["Int"]["output"];
  deviceRegisteredCount: Scalars["Int"]["output"];
  dmosOrderId: Scalars["String"]["output"];
  imeiList: Array<Scalars["String"]["output"]>;
  orderDate: Scalars["String"]["output"];
  packId: Scalars["String"]["output"];
  shippingCompany: Scalars["String"]["output"];
  sku: Scalars["String"]["output"];
  subscriptionIncluded: Scalars["Boolean"]["output"];
}

export interface ShelterOrderRecap {
  __typename?: "ShelterOrderRecap";
  billingCompany: Scalars["String"]["output"];
  deviceActiveCount: Scalars["Int"]["output"];
  deviceCount: Scalars["Int"]["output"];
  deviceRegisteredCount: Scalars["Int"]["output"];
  dmosBpid: Scalars["String"]["output"];
  lastName: Scalars["String"]["output"];
  lastOrderDate: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  orderCount: Scalars["Int"]["output"];
}

export enum SimStatusEnum {
  Inactive = "inactive",
  Live = "live",
  Other = "other",
  Ready = "ready",
  Sleep = "sleep",
  StandBy = "standBy",
  Stopped = "stopped",
  Suspended = "suspended",
  Terminated = "terminated",
  Test = "test",
}

export enum SpeciesEnum {
  Cat = "CAT",
  Dog = "DOG",
  Other = "OTHER",
}

export interface SubscriptionCancelled {
  __typename?: "SubscriptionCancelled";
  cancelReason?: Maybe<Scalars["String"]["output"]>;
  cancelReasonCode?: Maybe<CancelReasonCodeEnum>;
  chargebeeSubscriptionId?: Maybe<Scalars["String"]["output"]>;
  city?: Maybe<Scalars["String"]["output"]>;
  countryCode?: Maybe<Scalars["String"]["output"]>;
  creationDate?: Maybe<Scalars["String"]["output"]>;
  customerChargebeeId?: Maybe<Scalars["String"]["output"]>;
  customerId?: Maybe<Scalars["String"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  firstname?: Maybe<Scalars["String"]["output"]>;
  lastname?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
  streetAddress?: Maybe<Scalars["String"]["output"]>;
  subscriptionItems: Array<SubscriptionItem>;
  updateDate?: Maybe<Scalars["String"]["output"]>;
  zipCode?: Maybe<Scalars["String"]["output"]>;
}

export interface SubscriptionItem {
  __typename?: "SubscriptionItem";
  amount: Scalars["Int"]["output"];
  billingCycles?: Maybe<Scalars["Int"]["output"]>;
  itemId: Scalars["String"]["output"];
  itemPriceId: Scalars["String"]["output"];
  itemType: Scalars["String"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  quantity: Scalars["Int"]["output"];
  unitPrice: Scalars["Int"]["output"];
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

export interface Ticket {
  __typename?: "Ticket";
  action?: Maybe<TicketAction>;
  actionReason: Array<TicketActionReason>;
  creationDate: Scalars["String"]["output"];
  customerMood: CustomerMood;
  id: Scalars["String"]["output"];
  inspectionRequired?: Maybe<Scalars["Boolean"]["output"]>;
  /**   Withdrawn for inspection */
  negativeReview?: Maybe<Scalars["Boolean"]["output"]>;
  notes?: Maybe<Scalars["String"]["output"]>;
  productId?: Maybe<Scalars["String"]["output"]>;
  status: TicketStatus;
  suspectedIssues: Array<TicketIssue>;
  techNotes?: Maybe<Scalars["String"]["output"]>;
  userId: Scalars["String"]["output"];
  username: Scalars["String"]["output"];
}

export enum TicketAction {
  Replacement = "REPLACEMENT",
  Reset = "RESET",
  Return = "RETURN",
}

export enum TicketActionReason {
  BatteryBlock = "BATTERY_BLOCK",
  BatteryCharging = "BATTERY_CHARGING",
  CommercialReturn = "COMMERCIAL_RETURN",
  Damaged = "DAMAGED",
  GprsPerformance = "GPRS_PERFORMANCE",
  GpsPerformance = "GPS_PERFORMANCE",
  KippyCareDeviceProtection = "KIPPY_CARE_DEVICE_PROTECTION",
  Lost = "LOST",
  NoCustomerCare = "NO_CUSTOMER_CARE",
  OutOfWarrantyReturn = "OUT_OF_WARRANTY_RETURN",
  Subscription = "SUBSCRIPTION",
}

export interface TicketChangeStatusResponse {
  __typename?: "TicketChangeStatusResponse";
  code: Scalars["String"]["output"];
  issue?: Maybe<Issue>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface TicketInput {
  /**   default OPEN */
  action?: InputMaybe<TicketAction>;
  actionReason: Array<TicketActionReason>;
  customerMood: CustomerMood;
  inspectionRequired?: InputMaybe<Scalars["Boolean"]["input"]>;
  /**   Withdrawn for inspection */
  negativeReview?: InputMaybe<Scalars["Boolean"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  productId?: InputMaybe<Scalars["String"]["input"]>;
  status: TicketStatus;
  suspectedIssues: Array<TicketIssue>;
  techNotes?: InputMaybe<Scalars["String"]["input"]>;
}

export enum TicketIssue {
  ActivityBug = "ACTIVITY_BUG",
  AppBug = "APP_BUG",
  BatteryDrainsQuickly = "BATTERY_DRAINS_QUICKLY",
  BatteryNotCharge = "BATTERY_NOT_CHARGE",
  BatteryPartiallyCharges = "BATTERY_PARTIALLY_CHARGES",
  BatteryWireDisconnected = "BATTERY_WIRE_DISCONNECTED",
  Bluetooth = "BLUETOOTH",
  DamagedNoWarranty = "DAMAGED_NO_WARRANTY",
  DamagedUnderWarranty = "DAMAGED_UNDER_WARRANTY",
  Dimensions = "DIMENSIONS",
  GprsPerformance = "GPRS_PERFORMANCE",
  GpsFixingPerformance = "GPS_FIXING_PERFORMANCE",
  GpsLocationPerformance = "GPS_LOCATION_PERFORMANCE",
  Led = "LED",
  Lost = "LOST",
  NoSound = "NO_SOUND",
  Sim = "SIM",
  Unknown = "UNKNOWN",
  WaterInfiltration = "WATER_INFILTRATION",
  WifiHome = "WIFI_HOME",
  WifiLocation = "WIFI_LOCATION",
}

export enum TicketStatus {
  Closed = "CLOSED",
  Open = "OPEN",
}

export interface UpdateCustomerInput {
  confermationEmail: Scalars["Boolean"]["input"];
  email: Scalars["String"]["input"];
  language: LanguageId;
}

export interface UpdateCustomerResponse {
  __typename?: "UpdateCustomerResponse";
  code: Scalars["String"]["output"];
  customer?: Maybe<Customer>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export interface UpdateUserInput {
  active: Scalars["Boolean"]["input"];
  deviceVisibility: Array<DeviceVisibilityEnum>;
  id: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
  role: Array<RoleEnum>;
  surname: Scalars["String"]["input"];
  vodafoneCountryVisibility: Array<VodafoneCountryVisibilityEnum>;
}

export interface UpdateUserResponse {
  __typename?: "UpdateUserResponse";
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
}

export interface User {
  __typename?: "User";
  active: Scalars["Boolean"]["output"];
  creationDate: Scalars["String"]["output"];
  deviceVisibility: Array<DeviceVisibilityEnum>;
  email: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  name: Scalars["String"]["output"];
  phone: Scalars["String"]["output"];
  role: Array<RoleEnum>;
  surname: Scalars["String"]["output"];
  updateDate: Scalars["String"]["output"];
  username: Scalars["String"]["output"];
  vodafoneCountryVisibility: Array<VodafoneCountryVisibilityEnum>;
}

export enum VodafoneCountryVisibilityEnum {
  De = "DE",
  Es = "ES",
  Eu = "EU",
  Gb = "GB",
  Ie = "IE",
  It = "IT",
  Pt = "PT",
}

export interface SetPlanProfilesResponse {
  __typename?: "setPlanProfilesResponse";
  code: Scalars["String"]["output"];
  invalidSerialNumbers?: Maybe<Array<Scalars["String"]["output"]>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export type GetCustomerQueryVariables = Exact<{
  customerId: Scalars["String"]["input"];
}>;

export type GetCustomerQuery = {
  __typename?: "Query";
  getCustomer: {
    __typename?: "GetCustomerResponse";
    code: string;
    message: string;
    customer?: {
      __typename?: "Customer";
      id: string;
      name: string;
      surname: string;
      email: string;
      emailConfirmed: boolean;
      phone: string;
      phoneConfirmed: boolean;
      language: LanguageId;
      countryCode: string;
      appBrand?: string | null;
    } | null;
  };
};

export type GetCustomersQueryVariables = Exact<{
  filter?: InputMaybe<GetCustomersInput>;
  pagination?: InputMaybe<PaginationInput>;
  order?: InputMaybe<OrderInput>;
}>;

export type GetCustomersQuery = {
  __typename?: "Query";
  getCustomers: {
    __typename?: "GetCustomersResponse";
    code: string;
    message: string;
    items: Array<{
      __typename?: "Customer";
      id: string;
      name: string;
      surname: string;
      email: string;
      emailConfirmed: boolean;
      phone: string;
      phoneConfirmed: boolean;
      language: LanguageId;
      registrationDate: string;
      countryCode: string;
      chargebeeId?: string | null;
      appBrand?: string | null;
    }>;
    pagination: { __typename?: "Pagination"; pageSize: number; totalPage: number; totalItems: number; currentPage: number };
  };
};

export type GetDevicesQueryVariables = Exact<{
  filter?: InputMaybe<GetDevicesInput>;
  pagination?: InputMaybe<PaginationInput>;
  order?: InputMaybe<OrderInput>;
}>;

export type GetDevicesQuery = {
  __typename?: "Query";
  getDevices: {
    __typename?: "GetDevicesResponse";
    code: string;
    message: string;
    items: Array<{
      __typename?: "Device";
      serialId: string;
      deviceId: string;
      petId: string;
      customerId: string;
      customerName?: string | null;
      customerSurname?: string | null;
      customerEmail?: string | null;
      customerBrand?: string | null;
      customerCountry?: string | null;
      customerLanguage?: LanguageId | null;
      imei: string;
      iccid: string;
      registrationDate: string;
      lastPurchasedSubscriptionId?: string | null;
      lastPurchasedSubscriptionExpiringDate?: string | null;
      lastActivatedSubscriptionId?: string | null;
      lastActivatedSubscriptionExpiringDate?: string | null;
      hasSubscriptionActive?: boolean | null;
      hasEverSubscriptionActive?: boolean | null;
      planProfileId?: string | null;
      brand?: string | null;
      model?: string | null;
      planProfileType?: string | null;
      vodafoneCountry?: string | null;
      simStatus: SimStatusEnum;
      lastOperationInAppDate?: string | null;
      lastConnectionDate?: string | null;
      firmware: string;
      battery?: number | null;
      factory?: string | null;
      hardwareType?: string | null;
      simManufacturer?: string | null;
      testingDate?: string | null;
      group?: string | null;
      lat?: number | null;
      lng?: number | null;
      timezone?: string | null;
      updateFrequency?: number | null;
      country: string;
      logEnabled?: boolean | null;
    }>;
    pagination: { __typename?: "Pagination"; pageSize: number; totalPage: number; totalItems: number; currentPage: number };
  };
};

export type GetDeviceQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
}>;

export type GetDeviceQuery = {
  __typename?: "Query";
  getDevice: {
    __typename?: "GetDeviceResponse";
    code: string;
    message: string;
    device?: {
      __typename?: "Device";
      serialId: string;
      deviceId: string;
      petId: string;
      customerId: string;
      customerName?: string | null;
      customerSurname?: string | null;
      customerEmail?: string | null;
      customerBrand?: string | null;
      customerCountry?: string | null;
      customerLanguage?: LanguageId | null;
      imei: string;
      iccid: string;
      registrationDate: string;
      lastPurchasedSubscriptionId?: string | null;
      lastPurchasedSubscriptionExpiringDate?: string | null;
      lastActivatedSubscriptionId?: string | null;
      lastActivatedSubscriptionExpiringDate?: string | null;
      hasSubscriptionActive?: boolean | null;
      hasEverSubscriptionActive?: boolean | null;
      planProfileId?: string | null;
      brand?: string | null;
      model?: string | null;
      planProfileType?: string | null;
      vodafoneCountry?: string | null;
      simStatus: SimStatusEnum;
      lastOperationInAppDate?: string | null;
      lastConnectionDate?: string | null;
      firmware: string;
      battery?: number | null;
      factory?: string | null;
      hardwareType?: string | null;
      simManufacturer?: string | null;
      testingDate?: string | null;
      group?: string | null;
      lat?: number | null;
      lng?: number | null;
      timezone?: string | null;
      updateFrequency?: number | null;
      country: string;
      logEnabled?: boolean | null;
    } | null;
  };
};

export type GetPetQueryVariables = Exact<{
  petId: Scalars["String"]["input"];
}>;

export type GetPetQuery = {
  __typename?: "Query";
  getPet: {
    __typename?: "GetPetResponse";
    code: string;
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
      activityProfile: ActivityProfileEnum;
      hidden?: boolean | null;
      petProtection?: {
        __typename?: "PetProtectionShortInfo";
        id: string;
        currentTermStart: string;
        currentTermEnd: string;
        status: PetProtectionStatus;
        name: string;
      } | null;
    } | null;
  };
};

export type CustomGetCustomerDevicesQueryVariables = Exact<{
  customerId: Scalars["String"]["input"];
}>;

export type CustomGetCustomerDevicesQuery = {
  __typename?: "Query";
  getDevices: {
    __typename?: "GetDevicesResponse";
    code: string;
    message: string;
    items: Array<{
      __typename?: "Device";
      serialId: string;
      deviceId: string;
      petId: string;
      customerId: string;
      hasSubscriptionActive?: boolean | null;
    }>;
  };
};

export type GetCustomDeviceSubscriptionsQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
}>;

export type GetCustomDeviceSubscriptionsQuery = {
  __typename?: "Query";
  getSubscriptions: {
    __typename?: "GetSubscriptionsResponse";
    code: string;
    message: string;
    items?: Array<{
      __typename?: "PetlinkSubscription";
      id: string;
      chargebeeSubscriptionId?: string | null;
      entityType: string;
      status?: SubscriptionStatusEnum | null;
      paymentStatus?: PaymentStatusTypeEnum | null;
      currencyCode: string;
      currentTermStart?: string | null;
      currentTermEnd?: string | null;
      createdAt: string;
      startedAt?: string | null;
      activatedAt?: string | null;
      updatedAt: string;
      cancelledAt?: string | null;
      note?: string | null;
      moved?: string | null;
      creationDate: string;
      updateDate: string;
      subscriptionItems: Array<{
        __typename?: "SubscriptionItem";
        amount: number;
        billingCycles?: number | null;
        name?: string | null;
        itemPriceId: string;
        itemId: string;
        itemType: string;
        quantity: number;
        unitPrice: number;
      }>;
      invoice?: {
        __typename?: "Invoice";
        status: InvoiceStatusEnum;
        businessEntityId: string;
        currencyCode: string;
        creationDate: string;
        updateDate: string;
        notes?: string | null;
      } | null;
    }> | null;
  };
};

export const GetCustomerDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCustomer" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getCustomer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "customer" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "surname" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "emailConfirmed" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "phoneConfirmed" } },
                      { kind: "Field", name: { kind: "Name", value: "language" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "appBrand" } },
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
export const GetCustomersDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCustomers" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "filter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "GetCustomersInput" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pagination" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "PaginationInput" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "order" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "OrderInput" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getCustomers" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "filter" }, value: { kind: "Variable", name: { kind: "Name", value: "filter" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pagination" },
                value: { kind: "Variable", name: { kind: "Name", value: "pagination" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "order" }, value: { kind: "Variable", name: { kind: "Name", value: "order" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "surname" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "emailConfirmed" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "phoneConfirmed" } },
                      { kind: "Field", name: { kind: "Name", value: "language" } },
                      { kind: "Field", name: { kind: "Name", value: "registrationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "countryCode" } },
                      { kind: "Field", name: { kind: "Name", value: "chargebeeId" } },
                      { kind: "Field", name: { kind: "Name", value: "appBrand" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pagination" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "pageSize" } },
                      { kind: "Field", name: { kind: "Name", value: "totalPage" } },
                      { kind: "Field", name: { kind: "Name", value: "totalItems" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPage" } },
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
export const GetDevicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getDevices" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "filter" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "GetDevicesInput" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pagination" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "PaginationInput" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "order" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "OrderInput" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getDevices" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "filter" }, value: { kind: "Variable", name: { kind: "Name", value: "filter" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pagination" },
                value: { kind: "Variable", name: { kind: "Name", value: "pagination" } },
              },
              { kind: "Argument", name: { kind: "Name", value: "order" }, value: { kind: "Variable", name: { kind: "Name", value: "order" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "serialId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                      { kind: "Field", name: { kind: "Name", value: "customerSurname" } },
                      { kind: "Field", name: { kind: "Name", value: "customerEmail" } },
                      { kind: "Field", name: { kind: "Name", value: "customerBrand" } },
                      { kind: "Field", name: { kind: "Name", value: "customerCountry" } },
                      { kind: "Field", name: { kind: "Name", value: "customerLanguage" } },
                      { kind: "Field", name: { kind: "Name", value: "imei" } },
                      { kind: "Field", name: { kind: "Name", value: "iccid" } },
                      { kind: "Field", name: { kind: "Name", value: "registrationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastPurchasedSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "lastPurchasedSubscriptionExpiringDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastActivatedSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "lastActivatedSubscriptionExpiringDate" } },
                      { kind: "Field", name: { kind: "Name", value: "hasSubscriptionActive" } },
                      { kind: "Field", name: { kind: "Name", value: "hasEverSubscriptionActive" } },
                      { kind: "Field", name: { kind: "Name", value: "planProfileId" } },
                      { kind: "Field", name: { kind: "Name", value: "brand" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "planProfileType" } },
                      { kind: "Field", name: { kind: "Name", value: "vodafoneCountry" } },
                      { kind: "Field", name: { kind: "Name", value: "simStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "lastOperationInAppDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastConnectionDate" } },
                      { kind: "Field", name: { kind: "Name", value: "firmware" } },
                      { kind: "Field", name: { kind: "Name", value: "battery" } },
                      { kind: "Field", name: { kind: "Name", value: "factory" } },
                      { kind: "Field", name: { kind: "Name", value: "hardwareType" } },
                      { kind: "Field", name: { kind: "Name", value: "simManufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "testingDate" } },
                      { kind: "Field", name: { kind: "Name", value: "group" } },
                      { kind: "Field", name: { kind: "Name", value: "lat" } },
                      { kind: "Field", name: { kind: "Name", value: "lng" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
                      { kind: "Field", name: { kind: "Name", value: "logEnabled" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pagination" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "pageSize" } },
                      { kind: "Field", name: { kind: "Name", value: "totalPage" } },
                      { kind: "Field", name: { kind: "Name", value: "totalItems" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPage" } },
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
export const GetDeviceDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getDevice" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getDevice" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "deviceId" }, value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "device" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "serialId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                      { kind: "Field", name: { kind: "Name", value: "customerSurname" } },
                      { kind: "Field", name: { kind: "Name", value: "customerEmail" } },
                      { kind: "Field", name: { kind: "Name", value: "customerBrand" } },
                      { kind: "Field", name: { kind: "Name", value: "customerCountry" } },
                      { kind: "Field", name: { kind: "Name", value: "customerLanguage" } },
                      { kind: "Field", name: { kind: "Name", value: "imei" } },
                      { kind: "Field", name: { kind: "Name", value: "iccid" } },
                      { kind: "Field", name: { kind: "Name", value: "registrationDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastPurchasedSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "lastPurchasedSubscriptionExpiringDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastActivatedSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "lastActivatedSubscriptionExpiringDate" } },
                      { kind: "Field", name: { kind: "Name", value: "hasSubscriptionActive" } },
                      { kind: "Field", name: { kind: "Name", value: "hasEverSubscriptionActive" } },
                      { kind: "Field", name: { kind: "Name", value: "planProfileId" } },
                      { kind: "Field", name: { kind: "Name", value: "brand" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "planProfileType" } },
                      { kind: "Field", name: { kind: "Name", value: "vodafoneCountry" } },
                      { kind: "Field", name: { kind: "Name", value: "simStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "lastOperationInAppDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastConnectionDate" } },
                      { kind: "Field", name: { kind: "Name", value: "firmware" } },
                      { kind: "Field", name: { kind: "Name", value: "battery" } },
                      { kind: "Field", name: { kind: "Name", value: "factory" } },
                      { kind: "Field", name: { kind: "Name", value: "hardwareType" } },
                      { kind: "Field", name: { kind: "Name", value: "simManufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "testingDate" } },
                      { kind: "Field", name: { kind: "Name", value: "group" } },
                      { kind: "Field", name: { kind: "Name", value: "lat" } },
                      { kind: "Field", name: { kind: "Name", value: "lng" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      { kind: "Field", name: { kind: "Name", value: "updateFrequency" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "petId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getPet" },
            arguments: [
              { kind: "Argument", name: { kind: "Name", value: "petId" }, value: { kind: "Variable", name: { kind: "Name", value: "petId" } } },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
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
                      { kind: "Field", name: { kind: "Name", value: "activityProfile" } },
                      { kind: "Field", name: { kind: "Name", value: "hidden" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "petProtection" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                            { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                            { kind: "Field", name: { kind: "Name", value: "status" } },
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
      },
    },
  ],
} as unknown as DocumentNode;
export const CustomGetCustomerDevicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "customGetCustomerDevices" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: { kind: "NonNullType", type: { kind: "NamedType", name: { kind: "Name", value: "String" } } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "getDevices" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "customerId" },
                      value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
                    },
                    { kind: "ObjectField", name: { kind: "Name", value: "filterType" }, value: { kind: "EnumValue", value: "OR" } },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pagination" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    { kind: "ObjectField", name: { kind: "Name", value: "pageNumber" }, value: { kind: "IntValue", value: "0" } },
                    { kind: "ObjectField", name: { kind: "Name", value: "pageSize" }, value: { kind: "IntValue", value: "1000" } },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "order" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    { kind: "ObjectField", name: { kind: "Name", value: "field" }, value: { kind: "StringValue", value: "serialId", block: false } },
                    { kind: "ObjectField", name: { kind: "Name", value: "order" }, value: { kind: "EnumValue", value: "asc" } },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "serialId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "petId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "hasSubscriptionActive" } },
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
export const GetCustomDeviceSubscriptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCustomDeviceSubscriptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
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
              { kind: "Argument", name: { kind: "Name", value: "deviceId" }, value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } } },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pagination" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    { kind: "ObjectField", name: { kind: "Name", value: "pageNumber" }, value: { kind: "IntValue", value: "0" } },
                    { kind: "ObjectField", name: { kind: "Name", value: "pageSize" }, value: { kind: "IntValue", value: "1000000" } },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "order" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "field" },
                      value: { kind: "StringValue", value: "creationDate", block: false },
                    },
                    { kind: "ObjectField", name: { kind: "Name", value: "order" }, value: { kind: "EnumValue", value: "desc" } },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "code" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "items" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "chargebeeSubscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "entityType" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "paymentStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentTermEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "startedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "activatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "cancelledAt" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "subscriptionItems" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "amount" } },
                            { kind: "Field", name: { kind: "Name", value: "billingCycles" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "itemPriceId" } },
                            { kind: "Field", name: { kind: "Name", value: "itemId" } },
                            { kind: "Field", name: { kind: "Name", value: "itemType" } },
                            { kind: "Field", name: { kind: "Name", value: "quantity" } },
                            { kind: "Field", name: { kind: "Name", value: "unitPrice" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "invoice" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "status" } },
                            { kind: "Field", name: { kind: "Name", value: "businessEntityId" } },
                            { kind: "Field", name: { kind: "Name", value: "currencyCode" } },
                            { kind: "Field", name: { kind: "Name", value: "creationDate" } },
                            { kind: "Field", name: { kind: "Name", value: "updateDate" } },
                            { kind: "Field", name: { kind: "Name", value: "notes" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "note" } },
                      { kind: "Field", name: { kind: "Name", value: "moved" } },
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

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getCustomer(
      variables: GetCustomerQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetCustomerQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetCustomerQuery>({
            document: GetCustomerDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getCustomer",
        "query",
        variables,
      );
    },
    getCustomers(
      variables?: GetCustomersQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetCustomersQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetCustomersQuery>({
            document: GetCustomersDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getCustomers",
        "query",
        variables,
      );
    },
    getDevices(
      variables?: GetDevicesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetDevicesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetDevicesQuery>({
            document: GetDevicesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getDevices",
        "query",
        variables,
      );
    },
    getDevice(
      variables: GetDeviceQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetDeviceQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetDeviceQuery>({
            document: GetDeviceDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getDevice",
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
    customGetCustomerDevices(
      variables: CustomGetCustomerDevicesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<CustomGetCustomerDevicesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CustomGetCustomerDevicesQuery>({
            document: CustomGetCustomerDevicesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "customGetCustomerDevices",
        "query",
        variables,
      );
    },
    getCustomDeviceSubscriptions(
      variables: GetCustomDeviceSubscriptionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<GetCustomDeviceSubscriptionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetCustomDeviceSubscriptionsQuery>({
            document: GetCustomDeviceSubscriptionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getCustomDeviceSubscriptions",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;

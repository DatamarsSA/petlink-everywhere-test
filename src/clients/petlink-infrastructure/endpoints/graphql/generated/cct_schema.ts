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

export type ActivityProfileEnum = "MODERATELY_ACTIVE" | "SEDENTARY" | "VERY_ACTIVE";

export type AddFreePeriod = "ADD_1_YEAR" | "ADD_7_DAYS" | "ADD_14_DAYS" | "ADD_30_DAYS" | "ADD_60_DAYS" | "ADD_90_DAYS";

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

export type CancelReasonCodeEnum = "DO_NOT_USE" | "DO_NOT_WORK_PROPERLY" | "MISSING_PET" | "NOT_SUITABLE" | "OTHER" | "TOO_EXPENSIVE";

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
export type CouponSetMode = "apply" | "simulate";

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

export type CreditNoteStatusTypeEnum = "adjusted" | "refund_due" | "refunded" | "voided";

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

export type CustomerMood = "COLLABORATIVE" | "CRITICAL" | "NON_COOPERATIVE" | "VERY_CRITICAL";

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

export type DeviceVisibilityEnum = "KIPPY" | "PETLINK" | "VODAFONE";

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

export type FilterEnum = "AND" | "OR";

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

export type InvoiceReasonCodeEnum = "order_cancellation" | "order_change" | "other" | "product_unsatisfactory" | "service_unsatisfactory" | "waiver";

export type InvoiceStatusEnum = "non_paying" | "not_paid" | "paid" | "paid_externally" | "payment_due" | "pending" | "posted" | "voided";

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

export type LanguageId = "DE" | "EN" | "ES" | "FR" | "IT";

export interface LogActivityUser {
  __typename?: "LogActivityUser";
  activityType: Scalars["String"]["output"];
  creationDate: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  request: Scalars["String"]["output"];
  userId: Scalars["String"]["output"];
  userName: Scalars["String"]["output"];
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

export type OrderEnum = "asc" | "desc";

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

export type PaymentMethodEnum = "CARD" | "PAYPAL";

export type PaymentStatusTypeEnum = "FAILED" | "PENDING" | "SUCCEEDED";

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

export type PetProtectionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "IN_PROGRESS" | "IN_REVIEW" | "OPEN" | "REFUNDED" | "REJECTED" | "TO_UPDATE";

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

export type RoleEnum = "L1" | "L2" | "SUPERADMIN" | "SUPERREADER";

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

export type SimStatusEnum = "inactive" | "live" | "other" | "ready" | "sleep" | "standBy" | "stopped" | "suspended" | "terminated" | "test";

export type SpeciesEnum = "CAT" | "DOG" | "OTHER";

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

export type SubscriptionStatusEnum = "active" | "cancelled" | "closed" | "future" | "in_trial" | "non_renewing" | "paused" | "to_stop_renew" | "to_stop_renew_addon" | "transferred";

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

export type TicketAction = "REPLACEMENT" | "RESET" | "RETURN";

export type TicketActionReason =
  | "BATTERY_BLOCK"
  | "BATTERY_CHARGING"
  | "COMMERCIAL_RETURN"
  | "DAMAGED"
  | "GPRS_PERFORMANCE"
  | "GPS_PERFORMANCE"
  | "KIPPY_CARE_DEVICE_PROTECTION"
  | "LOST"
  | "NO_CUSTOMER_CARE"
  | "OUT_OF_WARRANTY_RETURN"
  | "SUBSCRIPTION";

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

export type TicketIssue =
  | "ACTIVITY_BUG"
  | "APP_BUG"
  | "BATTERY_DRAINS_QUICKLY"
  | "BATTERY_NOT_CHARGE"
  | "BATTERY_PARTIALLY_CHARGES"
  | "BATTERY_WIRE_DISCONNECTED"
  | "BLUETOOTH"
  | "DAMAGED_NO_WARRANTY"
  | "DAMAGED_UNDER_WARRANTY"
  | "DIMENSIONS"
  | "GPRS_PERFORMANCE"
  | "GPS_FIXING_PERFORMANCE"
  | "GPS_LOCATION_PERFORMANCE"
  | "LED"
  | "LOST"
  | "NO_SOUND"
  | "SIM"
  | "UNKNOWN"
  | "WATER_INFILTRATION"
  | "WIFI_HOME"
  | "WIFI_LOCATION";

export type TicketStatus = "CLOSED" | "OPEN";

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

export type VodafoneCountryVisibilityEnum = "DE" | "ES" | "EU" | "GB" | "IE" | "IT" | "PT";

export interface SetPlanProfilesResponse {
  __typename?: "setPlanProfilesResponse";
  code: Scalars["String"]["output"];
  invalidSerialNumbers?: Maybe<Array<Scalars["String"]["output"]>>;
  message: Scalars["String"]["output"];
  translationCode?: Maybe<Scalars["String"]["output"]>;
}

export type SdkFunctionWrapper = <T>(action: (requestHeaders?: Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {};
}
export type Sdk = ReturnType<typeof getSdk>;

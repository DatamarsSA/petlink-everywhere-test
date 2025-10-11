/** DEVEXPERIENCE
 * - configure logger (print in locale sdisable in pipeline? choose strategy)
 * - think how to configure global state for all flows (or reset beforeAll file.test?)
 * - manage better fixtures[env.APP_BRAND] in pipeline
 * - ask to add endpoint to createUSer without passing through otp (for testing purpose only)
 * - write rules for cursor/zencoder written well with best practice of naming/design-pattern/organization file & folder/idempotency test etc
 */

/** MISSING TESTS
 * - rest eamil, password and phone number User
 * - pet should not be deleted if has device associated
 */

/** BUG found
 * - sometimes signUpUser() return 422 instead ofinsted 200 also if user does not exist
 *
 */

/** DOCS
 * - add docs flow registration user, pet and device
 * - add schema excalidraw of archtecture
 *
 */

/** TODAY
 * - refactor flow register suer-pet-device idempotent with new createUser() for test
 * - understand how to use ChargeBee test environment (https://www.chargebee.com/docs/payments/2.0/payment-gateways-and-configuration/chargebee-test-gateway?utm_source=chatgpt.com)
 */

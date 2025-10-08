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
 * - sometimes signUpUser() return 422 (o 428?, insted 200) also if user does note exist
 *
 */

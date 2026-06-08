import { config } from "dotenv";
import { z } from "zod";

export const environmentSchema = z.object({
  // AWS general
  AWS_REGION: z.string().min(1, "AWS_REGION è richiesta"),
  // AWS iam core & cct
  AWS_CORE_ACCESS_KEY_ID: z.string().min(1, "AWS_CORE_ACCESS_KEY_ID è richiesta"),
  AWS_CORE_SECRET_ACCESS_KEY: z.string().min(1, "AWS_CORE_SECRET_ACCESS_KEY è richiesta"),
  AWS_CCT_ACCESS_KEY_ID: z.string().min(1, "AWS_CCT_ACCESS_KEY_ID è richiesta"),
  AWS_CCT_SECRET_ACCESS_KEY: z.string().min(1, "AWS_CCT_SECRET_ACCESS_KEY è richiesta"),
  // AWS Cognito
  COGNITO_CLIENT_ID_APP_USER: z.string().min(1, "COGNITO_CLIENT_ID_APP_USER è richiesto"),
  COGNITO_CLIENT_ID_FE_CCT: z.string().min(1, "COGNITO_CLIENT_ID_FE_CCT è richiesto"),
  // USER (app) credentials login
  USER_APP_NAME: z.string().min(1, "USER_APP_NAME è richiesta"),
  USER_APP_SURNAME: z.string().min(1, "USER_APP_SURNAME è richiesta"),
  USER_APP_PASSWORD: z.string().min(1, "USER_APP_PASSWORD è richiesta"),
  // OPERATOR (cct) credentials login
  OPERATOR_CCT_EMAIL: z.string().min(1, "OPERATOR_CCT_EMAIL è richiesta"),
  OPERATOR_CCT_PASSWORD: z.string().min(1, "OPERATOR_CCT_PASSWORD è richiesta"),
  OPERATOR_CCT_PHONE: z.string().min(1, "OPERATOR_CCT_PHONE è richiesta"),
  // CORE API
  CORE_GRAPHQL_API_URL: z.url("CORE_GRAPHQL_API_URL deve essere un URL valido"),
  CORE_GRAPHQL_API_KEY: z.string().min(1, "CORE_GRAPHQL_API_KEY è richiesta"),
  // CORE REST API (order manager)
  CORE_REST_API_URL: z.url("CORE_REST_API_URL deve essere un URL valido"),
  CORE_REST_BASIC_AUTH_USERNAME: z.string().min(1, "CORE_REST_BASIC_AUTH_USERNAME è richiesta"),
  CORE_REST_BASIC_AUTH_PASSWORD: z.string().min(1, "CORE_REST_BASIC_AUTH_PASSWORD è richiesta"),
  // CCT API
  CCT_GRAPHQL_API_URL: z.url("CCT_GRAPHQL_API_URL deve essere un URL valido"),
  CCT_GRAPHQL_API_KEY: z.string().min(1, "CCT_GRAPHQL_API_KEY è richiesta"),
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID è richiesto"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN è richiesto"),
  TWILIO_USER_PHONE_NUMBER: z.string().min(1, "TWILIO_USER_PHONE_NUMBER è richiesto"),
  // Gmail
  GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID è richiesto"),
  GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET è richiesto"),
  GMAIL_REFRESH_TOKEN: z.string().min(1, "GMAIL_REFRESH_TOKEN è richiesto"),
  GMAIL_USER_EMAIL: z.string().min(1, "GMAIL_USER_EMAIL è richiesto"),
  // App Brand
  APP_BRAND: z.enum(["PETLINK", "KIPPY"]).optional().default("KIPPY"),
  // log level console
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("debug"),
  // Sentinel socket tcp
  SENTINEL_HOST: z.string().min(1, "SENTINEL_HOST è richiesto"),
  SENTINEL_PORT: z.string().min(4, "SENTINEL_PORT è richiesta"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function getEnvs(): Environment {
  const nodeEnv = process.env.ENV || "develop";

  const availableEnvs = ["develop", "test", "next"];
  if (!availableEnvs.includes(nodeEnv)) {
    console.error(`❌ Invalid environment: "${nodeEnv}". Available environments: ${availableEnvs.join(", ")}`);
    process.exit(1);
  }
  config({ path: `.env.${nodeEnv}` });

  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Environment validation failed");
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }
  console.log(`Running in environment: ${nodeEnv}`);
  console.log("APP_BRAND: ", result.data.APP_BRAND);
  console.log("LOG_LEVEL: ", result.data.LOG_LEVEL);
  return result.data;
}

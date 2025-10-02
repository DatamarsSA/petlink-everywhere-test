import { z, ZodError } from "zod";

// Schema Zod per le variabili d'ambiente
const envSchemaValidation = z.object({
  // CORE API
  CORE_GRAPHQL_API_URL: z.url("CORE_GRAPHQL_API_URL deve essere un URL valido"),
  CORE_GRAPHQL_API_KEY: z.string().min(1, "CORE_GRAPHQL_API_KEY è richiesta"),
  // CCT API
  CCT_GRAPHQL_API_URL: z.url("CCT_GRAPHQL_API_URL deve essere un URL valido"),
  CCT_GRAPHQL_API_KEY: z.string().min(1, "CCT_GRAPHQL_API_KEY è richiesta"),
  // AWS Cognito (for LOGIN)
  COGNITO_REGION: z.string().min(1, "COGNITO_REGION è richiesta"),
  COGNITO_CLIENT_ID: z.string().min(1, "COGNITO_CLIENT_ID è richiesto"),
  // AWS IAM
  AWS_REGION: z.string().min(1, "AWS_REGION è richiesta"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID è richiesta"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY è richiesta"),
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID è richiesto"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN è richiesto"),
  // Gmail
  GMAIL_CLIENT_ID: z.string().min(1, "GMAIL_CLIENT_ID è richiesto"),
  GMAIL_CLIENT_SECRET: z.string().min(1, "GMAIL_CLIENT_SECRET è richiesto"),
  GMAIL_REFRESH_TOKEN: z.string().min(1, "GMAIL_REFRESH_TOKEN è richiesto"),
  // Performance Tracking (optional)
  ENABLE_PERFORMANCE_TRACKING: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

type EnvConfig = z.infer<typeof envSchemaValidation>;

function validateEnv(): EnvConfig {
  try {
    return envSchemaValidation.parse(process.env);
  } catch (error) {
    console.error("Environment validation failed:");
    if (error instanceof ZodError) {
      error.issues.forEach((issue) => {
        console.error(`   ${issue.path.join(".")}: ${issue.message}`);
      });
    }
    throw error;
  }
}

export const env = validateEnv();

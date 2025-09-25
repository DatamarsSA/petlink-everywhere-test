import { z, ZodError } from "zod";

// Schema Zod per le variabili d'ambiente
const envSchemaValidation = z.object({
  // CORE API
  CORE_GRAPHQL_API_URL: z.url("CORE_GRAPHQL_API_URL deve essere un URL valido"),
  CORE_GRAPHQL_API_KEY: z.string().min(1, "CORE_GRAPHQL_API_KEY è richiesta"),
  // CCT API
  CCT_GRAPHQL_API_URL: z.url("CCT_GRAPHQL_API_URL deve essere un URL valido"),
  CCT_GRAPHQL_API_KEY: z.string().min(1, "CCT_GRAPHQL_API_KEY è richiesta"),
  // AWS Cognito
  COGNITO_REGION: z.string().min(1, "COGNITO_REGION è richiesta"),
  COGNITO_CLIENT_ID: z.string().min(1, "COGNITO_CLIENT_ID è richiesto"),
  // AWS IAM
  AWS_REGION: z.string().min(1, "AWS_REGION è richiesta").optional(),
  // USER
  USER_PHONE_NUMBER: z
    .string()
    .min(10, "USER_PHONE_NUMBER deve essere un numero valida"),
  USER_EMAIL: z.email("USER_EMAIL deve essere un email valida"),
  USER_PASSWORD: z.string().min(1, "COGNITO_PASSWORD è richiesta"),
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID è richiesto"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN è richiesto"),
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

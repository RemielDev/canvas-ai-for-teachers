import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  JWT_SECRET: z.string().min(32),
  KMS_KEY_ID: z.string().optional(),
  PORT: z.coerce.number().default(8787),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;

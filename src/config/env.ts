import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default("3333")
    .transform((val) => parseInt(val, 10)),
  HOST: z.string().default("0.0.0.0"),
  MCP_TRANSPORT: z
    .enum(["stdio", "sse", "both"])
    .default("both"),
  API_BASE_URL: z.string().url().default("http://10.200.1.13:5100"),
  API_FALLBACK_URL: z.string().url().default("https://10.200.1.13:5443"),
  API_REJECT_UNAUTHORIZED: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  API_TIMEOUT_MS: z
    .string()
    .default("15000")
    .transform((val) => parseInt(val, 10)),
  DRY_RUN_MODE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
  AUTH_USERNAME: z.string().default("brayan.vazquez"),
  AUTH_PASSWORD: z.string().default(""),
  DEFAULT_RESPONSIBLE_ID: z
    .string()
    .default("6")
    .transform((val) => parseInt(val, 10)),
  DEFAULT_RESPONSIBLE_NAME: z.string().default("VAZQUEZ HEREDIA BRAYAN ULISES"),
  DEFAULT_PROJECT_ID: z
    .string()
    .default("11")
    .transform((val) => parseInt(val, 10)),
  DEFAULT_SERVICE_ID: z
    .string()
    .default("4")
    .transform((val) => parseInt(val, 10)),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

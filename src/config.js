import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

loadDotEnv();

export const config = {
  port: numberFromEnv("PORT", 8080),
  env: process.env.NODE_ENV || "development",
  gatewayApiKeys: (process.env.GATEWAY_API_KEYS || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
  routingStrategy: process.env.ROUTING_STRATEGY || "balanced",
  requestTimeoutMs: numberFromEnv("REQUEST_TIMEOUT_MS", 30000),
  cacheTtlSeconds: numberFromEnv("CACHE_TTL_SECONDS", 300),
  rateLimitRpm: numberFromEnv("RATE_LIMIT_RPM", 60),
  providers: {
    mock: {
      enabled: booleanFromEnv("MOCK_PROVIDER_ENABLED", true)
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1"
    }
  }
};

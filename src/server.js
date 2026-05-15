import { createServer } from "node:http";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { RateLimiter } from "./middleware/rateLimiter.js";
import { MetricsRegistry } from "./observability/metrics.js";
import { createProviders } from "./providers/index.js";
import { TTLCache } from "./services/cache.js";
import { LlmGateway } from "./services/gateway.js";
import { ProviderRouter } from "./services/router.js";
import { UsageStore } from "./services/usageStore.js";

const providers = createProviders();
const router = new ProviderRouter({ providers, strategy: config.routingStrategy });
const cache = new TTLCache({ ttlSeconds: config.cacheTtlSeconds });
const usageStore = new UsageStore();
const metrics = new MetricsRegistry();
const rateLimiter = new RateLimiter({ limitPerMinute: config.rateLimitRpm });
const gateway = new LlmGateway({ router, cache, usageStore, metrics });
const app = createApp({ config, gateway, rateLimiter, usageStore, router, metrics });

const server = createServer(app);

server.listen(config.port, () => {
  console.log(`LLM Service Gateway listening on http://localhost:${config.port}`);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function shutdown(signal) {
  console.log(`${signal} received. Closing server.`);
  server.close(() => process.exit(0));
}

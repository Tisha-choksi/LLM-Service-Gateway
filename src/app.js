import { sendJson, readJsonBody } from "./http/json.js";
import { toHttpError } from "./http/errors.js";
import { authenticate } from "./middleware/auth.js";

export function createApp({ config, gateway, rateLimiter, usageStore, router, metrics }) {
  return async function handle(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, {
          status: "ok",
          environment: config.env,
          providers: router.health()
        });
      }

      if (req.method === "GET" && url.pathname === "/metrics") {
        authenticate(req, config.gatewayApiKeys);
        return sendJson(res, 200, metrics.snapshot());
      }

      if (req.method === "GET" && url.pathname === "/usage") {
        authenticate(req, config.gatewayApiKeys);
        return sendJson(res, 200, usageStore.snapshot());
      }

      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        const auth = authenticate(req, config.gatewayApiKeys);
        const remoteAddress = req.socket.remoteAddress || "unknown";
        const rateKey = auth.apiKey || remoteAddress;
        const rate = rateLimiter.check(rateKey);

        if (!rate.allowed) {
          return sendJson(
            res,
            429,
            { error: { message: "Rate limit exceeded", resetAt: new Date(rate.resetAt).toISOString() } },
            rateHeaders(rate)
          );
        }

        const body = await readJsonBody(req);
        const response = await gateway.chatCompletion(body, auth);
        return sendJson(res, 200, response, rateHeaders(rate));
      }

      return sendJson(res, 404, { error: { message: "Route not found" } });
    } catch (error) {
      const httpError = toHttpError(error);
      return sendJson(res, httpError.statusCode, {
        error: {
          message: httpError.message,
          details: httpError.details
        }
      });
    }
  };
}

function rateHeaders(rate) {
  return {
    "x-ratelimit-limit": String(rate.limit),
    "x-ratelimit-remaining": String(rate.remaining),
    "x-ratelimit-reset": new Date(rate.resetAt).toISOString()
  };
}

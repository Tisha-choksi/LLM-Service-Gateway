import { HttpError } from "../http/errors.js";

export function authenticate(req, acceptedKeys) {
  if (!acceptedKeys.length) return { apiKey: "anonymous" };

  const apiKey = req.headers["x-api-key"] || bearerToken(req.headers.authorization);
  if (!apiKey || !acceptedKeys.includes(apiKey)) {
    throw new HttpError(401, "Missing or invalid gateway API key");
  }

  return { apiKey };
}

function bearerToken(value) {
  if (!value) return "";
  const [scheme, token] = value.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token ? token : "";
}

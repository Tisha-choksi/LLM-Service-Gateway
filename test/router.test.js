import assert from "node:assert/strict";
import test from "node:test";
import { ProviderRouter } from "../src/services/router.js";
import { MockProvider } from "../src/providers/mockProvider.js";

test("ProviderRouter selects healthy model-compatible providers", () => {
  const provider = new MockProvider({ enabled: true, timeoutMs: 1000 });
  const router = new ProviderRouter({ providers: [provider], strategy: "balanced" });

  const candidates = router.candidatesFor({ model: "mock-fast" });
  assert.equal(candidates[0].id, "mock");
});

test("ProviderRouter respects forced provider", () => {
  const provider = new MockProvider({ enabled: true, timeoutMs: 1000 });
  const router = new ProviderRouter({ providers: [provider], strategy: "balanced" });

  assert.throws(() => router.candidatesFor({ model: "mock-fast", provider: "missing" }), /No healthy provider/);
});

import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../test-native-stub.mjs");
const { searchEngines } = await import("./settings.ts");
const { DEFAULT_SETTINGS } = await import("./settings.ts");
const { resolveInput } = await import("@ardia/core");

const enginesWith = (patch) => searchEngines({ ...DEFAULT_SETTINGS, ...patch }).map((e) => e.id);

test("custom engines with non-http URLs never register", () => {
  for (const url of [
    "javascript:alert(document.domain)//%s",
    "data:text/html,<script>alert(1)</script>%s",
    "file:///tmp/search?q=%s",
    "ftp://example.com/?q=%s",
    "example.com/?q=%s",
  ]) {
    assert.ok(!enginesWith({ customSearchUrl: url }).includes("custom"), url);
    assert.ok(!enginesWith({ customSearchEngines: [{ id: "engine-x", name: "X", keyword: "x", url }] }).includes("engine-x"), url);
  }
});

test("valid custom engines still register", () => {
  assert.ok(enginesWith({ customSearchUrl: "https://example.com/?q=%s" }).includes("custom"));
  assert.ok(
    enginesWith({ customSearchEngines: [{ id: "engine-x", name: "X", keyword: "x", url: "http://example.com/?q=%s" }] }).includes("engine-x"),
  );
});

test("a non-http synced search template never becomes a navigation", () => {
  const settings = { ...DEFAULT_SETTINGS, customSearchUrl: "javascript:alert(document.domain)//%s", searchEngine: "custom" };
  const prefix = searchEngines(settings).find((e) => e.id === "custom")?.url;
  assert.equal(prefix, undefined);
  const first = searchEngines(settings)[0];
  assert.ok(first);
  assert.notEqual(resolveInput("innocent search", first.url).slice(0, 11), "javascript:");
});

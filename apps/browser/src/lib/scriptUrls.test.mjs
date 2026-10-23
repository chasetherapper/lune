import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../test-native-stub.mjs");
const { runsJavaScript } = await import("./scriptUrls.ts");
const { DEFAULT_SETTINGS } = await import("../store/settings.ts");

test("javascript: URLs are caught however they're spelled", () => {
  for (const url of [
    "javascript:alert(1)",
    "javascript://%0Adocument.title=document.querySelector('input[type=password]').value",
    "JaVaScRiPt://%0Aalert(1)",
    "  javascript:alert(1)",
    "\u0001javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript://x%0Aalert(1)",
    "jav\rascript:alert(1)",
  ]) assert.equal(runsJavaScript(url, DEFAULT_SETTINGS), true, JSON.stringify(url));
});

test("ordinary URLs and searches are not", () => {
  for (const url of ["https://example.com/javascript:x", "example.com", "about:blank", "javascript tutorial", "%6Aavascript:alert(1)", "file:///tmp/javascript:x"])
    assert.equal(runsJavaScript(url, DEFAULT_SETTINGS), false, JSON.stringify(url));
});

test("script-capable data: and view-source: URLs are caught", () => {
  for (const url of [
    "data:text/html,<script>alert(1)</script>",
    "data: text/html,<b>x</b>",
    "DATA:TEXT/HTML,<script>alert(1)</script>",
    "data:application/xhtml+xml,<script>alert(1)</script>",
    "view-source:javascript:alert(1)",
    "view-source:data:text/html,<script>alert(1)</script>",
    "VIEW-SOURCE:JAVASCRIPT:alert(1)",
    "view-source:view-source:javascript:alert(1)",
    "view-source: javascript:alert(1)",
    "view-source: view-source: javascript:alert(1)",
    "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>",
    "DATA:IMAGE/SVG+XML,<svg><script>alert(1)</script></svg>",
    "view-source:data:image/svg+xml,<svg><script>alert(1)</script></svg>",
    "  data:text/html,<script>alert(1)</script>",
  ]) assert.equal(runsJavaScript(url, DEFAULT_SETTINGS), true, JSON.stringify(url));
});

test("non-script data: and view-source: URLs are not", () => {
  for (const url of [
    "data:image/png;base64,iVBORw0KGgo=",
    "data:text/plain,hello",
    "view-source:https://example.com",
    "view-source:file:///tmp/javascript:x",
    "https://example.com/?q=data:text/html",
  ]) assert.equal(runsJavaScript(url, DEFAULT_SETTINGS), false, JSON.stringify(url));
});

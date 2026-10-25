import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionLabels } from "./sections.ts";

const page = (url, extra = {}) => ({ kind: "page", url, title: url, favicon: null, ...extra });
const search = (query, extra = {}) => ({ kind: "search", query, url: `https://s/?q=${query}`, engine: "Google", ...extra });

test("the top hit and the typed search carry no label", () => {
  assert.deepEqual(sectionLabels([page("a", { tabId: "t" }), search("a")]), [null, null]);
});

test("runs of open tabs, history and engine suggestions get one label each", () => {
  const items = [
    search("git"),
    page("https://github.com", { tabId: "t1" }),
    page("https://gitlab.com", { tabId: "t2" }),
    search("github", { suggested: true }),
    search("gitlab", { suggested: true }),
    page("https://git-scm.com", { visited: true }),
  ];
  assert.deepEqual(sectionLabels(items), [null, "Open tabs", null, "Google suggestions", null, "History"]);
});

test("a mixed run of tabs and visited pages reads as tabs and history", () => {
  const items = [search("x"), search("x"), page("a", { tabId: "t" }), page("b", { visited: true })];
  assert.deepEqual(sectionLabels(items), [null, null, "Tabs and history", null]);
});

test("unvisited bookmarks and commands keep their own labels", () => {
  const items = [
    search("set"),
    search("set"),
    { kind: "action", id: "settings", title: "Settings" },
    page("a", { bookmarked: true }),
    page("b", { visited: true }),
  ];
  assert.deepEqual(sectionLabels(items), [null, null, "Actions", "Pages", null]);
  assert.deepEqual(sectionLabels([search("a"), page("a", { bookmarked: true })]), [null, "Bookmarks"]);
});

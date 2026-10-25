import type { Suggestion } from "@ardia/core";

type Page = Extract<Suggestion, { kind: "page" }>;

function groupOf(s: Suggestion, index: number): string | null {
  if (index === 0) return null;
  switch (s.kind) {
    case "page":
      return "page";
    case "search":
      return s.suggested ? `${s.engine} suggestions` : null;
    case "calc":
      return null;
    case "action":
    case "create":
      return "Actions";
  }
}

function pagesLabel(pages: Page[]): string {
  const tabs = pages.filter((p) => p.tabId).length;
  if (tabs === pages.length) return "Open tabs";
  const rest = pages.filter((p) => !p.tabId);
  if (rest.every((p) => p.visited)) return tabs ? "Tabs and history" : "History";
  if (!tabs && rest.every((p) => p.bookmarked)) return "Bookmarks";
  return "Pages";
}

export function sectionLabels(items: readonly Suggestion[]): (string | null)[] {
  const groups = items.map(groupOf);
  const labels: (string | null)[] = items.map(() => null);
  for (let start = 0; start < items.length; ) {
    const group = groups[start];
    let end = start + 1;
    while (end < items.length && groups[end] === group) end++;
    if (group === "page") labels[start] = pagesLabel(items.slice(start, end) as Page[]);
    else if (group) labels[start] = group;
    start = end;
  }
  return labels;
}

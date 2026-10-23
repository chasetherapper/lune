import { layout } from "../../lib/theme";
import type { BrowserState } from "../../store/browser";
import { tabLayoutOf } from "../../store/model";
import { groupEntries, sidebarEntries } from "../sidebar/entries";

const LIGHTS_ROW = 2 * 23 + 14;
const LIGHT = 14;

export const RAIL = {
  width: 72,
  tile: 36,
  radius: 10,
  gap: 6,
  toggleTop: 44,
  toggle: 30,
  listTop: 84,
} as const;

export const RAIL_ROW_EDGE = layout.sidebarInset + 2.5;

export const RAIL_LIGHTS_X = (RAIL.width - LIGHTS_ROW) / 2 + LIGHT / 2;

export const collapsesToIcons = (s: Pick<BrowserState, "settings">) => s.settings.sidebarCollapse === "icons";

export function railShown(s: BrowserState, windowId: string): boolean {
  const w = s.windows[windowId];
  return !!w && !w.sidebarOpen && w.kind !== "small" && collapsesToIcons(s) && tabLayoutOf(s, windowId) === "sidebar";
}

export function sidebarOnScreen(s: BrowserState, windowId: string): boolean {
  return !!s.windows[windowId]?.sidebarOpen || railShown(s, windowId);
}

export const sidebarToggleTitle = (s: Pick<BrowserState, "settings">) => (collapsesToIcons(s) ? "Collapse Sidebar" : "Auto-Hide Tabs");

export type RailItems = { pinned: string[]; open: string[] };

const memo = new Map<string, { inputs: unknown[]; result: RailItems }>();

export function railItems(s: BrowserState, windowId: string, profileId?: string): RailItems {
  const entries = sidebarEntries(s, windowId, profileId);
  const inputs = [entries, s.groups, s.splits, s.tabs];
  const key = profileId ? `${windowId}|${profileId}` : windowId;
  const cached = memo.get(key);
  if (cached && cached.inputs.every((v, i) => v === inputs[i])) return cached.result;
  const tabsOf = (entry: string): string[] => {
    const id = entry.slice(2);
    if (entry.startsWith("g:")) return groupEntries(s, id).flatMap(tabsOf);
    if (entry.startsWith("s:")) return (s.splits[id]?.tabIds ?? []).filter((tabId) => s.tabs[tabId] && !s.tabs[tabId]!.pinned);
    return s.tabs[id] ? [id] : [];
  };
  const fresh: RailItems = {
    pinned: [...entries.tiles, ...entries.pinnedRows, ...entries.pinnedGroups.flatMap((id) => tabsOf(`g:${id}`))],
    open: entries.list.flatMap(tabsOf),
  };
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
  const result = cached && same(cached.result.pinned, fresh.pinned) && same(cached.result.open, fresh.open) ? cached.result : fresh;
  memo.set(key, { inputs, result });
  if (memo.size > 8) for (const k of memo.keys()) if (!s.windows[k.split("|")[0]!]) memo.delete(k);
  return result;
}

import type { View } from "react-native";
import { create } from "zustand";

export type Anchor = { x: number; y: number; width: number; height: number };
export type Target = { kind: "tab" | "group" | "live"; id: string };
export type Hover = Target & { windowId: string; anchor: Anchor };

type SidebarUi = {
  renaming: (Target & { windowId: string }) | null;
  iconPicker: (Target & { windowId: string; anchor: Anchor | null }) | null;
  hover: Hover | null;
  searchTabs: string | null;
  switcher: { windowId: string; ids: string[]; index: number; visible: boolean } | null;
  dragWidth: Record<string, number>;
};

export const useSidebarUi = create<SidebarUi>()(() => ({
  renaming: null,
  iconPicker: null,
  hover: null,
  searchTabs: null,
  switcher: null,
  dragWidth: {},
}));

export const sidebarUi = () => useSidebarUi.getState();
export const setSidebarUi = (patch: Partial<SidebarUi>) => useSidebarUi.setState(patch);

const rows = new Map<string, Map<string, View>>();
const railRows = new Map<string, Map<string, View>>();

function register(into: Map<string, Map<string, View>>, windowId: string, id: string, view: View | null) {
  let byId = into.get(windowId);
  if (!byId) into.set(windowId, (byId = new Map()));
  if (view) byId.set(id, view);
  else byId.delete(id);
}

export const registerRow = (windowId: string, id: string, view: View | null) => register(rows, windowId, id, view);
export const registerRailRow = (windowId: string, id: string, view: View | null) => register(railRows, windowId, id, view);

export const rowIds = (windowId: string): string[] => [...(rows.get(windowId)?.keys() ?? [])];

export function rowView(windowId: string, id: string): View | undefined {
  return railRows.get(windowId)?.get(id) ?? rows.get(windowId)?.get(id);
}

export function measureRow(windowId: string, id: string): Promise<Anchor | null> {
  const view = rowView(windowId, id);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => view.measureInWindow((x, y, width, height) => resolve(width ? { x, y, width, height } : null)));
}

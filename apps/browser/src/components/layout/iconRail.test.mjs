import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
const rail = await import("./iconRail.ts");
const dm = await import("./dockMotion.ts");
const { addressBarInSidebar, openingLightsCenter } = await import("./windowLayout.ts");
const { useBrowser } = await import("../../store/browser.ts");

const S = () => useBrowser.getState();

function fresh() {
  S().hydrate({});
  const w = S().createWindow({ url: "a.com" });
  return w;
}

test("the three lights sit centred in the rail with room either side", () => {
  const close = rail.RAIL_LIGHTS_X;
  const left = close - 7;
  const right = close + 46 + 7;
  assert.equal(left, rail.RAIL.width - right, "centred");
  assert.ok(left >= 6, `a margin of ${left} pt`);
  assert.ok((rail.RAIL.width - rail.RAIL.tile) / 2 >= 12, "tiles keep a margin too");
});

test("hide mode is today's: no rail, the sidebar's toggle reads Auto-Hide Tabs", () => {
  const w = fresh();
  assert.equal(S().settings.sidebarCollapse, "hide");
  assert.equal(rail.sidebarToggleTitle(S()), "Auto-Hide Tabs");
  S().toggleSidebar(w);
  assert.equal(rail.railShown(S(), w), false);
  assert.equal(rail.sidebarOnScreen(S(), w), false);
});

test("icons mode: hiding the sidebar shows the rail, only in the sidebar layout", () => {
  const w = fresh();
  S().updateSettings({ sidebarCollapse: "icons" });
  assert.equal(rail.sidebarToggleTitle(S()), "Collapse Sidebar");
  assert.equal(rail.railShown(S(), w), false, "docked: the full sidebar");
  assert.equal(rail.sidebarOnScreen(S(), w), true);
  S().toggleSidebar(w);
  assert.equal(rail.railShown(S(), w), true);
  assert.equal(rail.sidebarOnScreen(S(), w), true);
  S().toggleTabLayout(w);
  assert.equal(rail.railShown(S(), w), false, "top tabs: no rail");
  S().updateSettings({ sidebarCollapse: "hide" });
});

test("with the address bar in the sidebar, the collapsed rail hands it back to the card", () => {
  const w = fresh();
  S().updateSettings({ addressBar: "sidebar", sidebarCollapse: "icons" });
  assert.equal(addressBarInSidebar(S(), w), true, "docked: in the sidebar");
  S().toggleSidebar(w);
  assert.equal(addressBarInSidebar(S(), w), false, "rail: on the card");
  S().updateSettings({ sidebarCollapse: "hide" });
  assert.equal(addressBarInSidebar(S(), w), true, "hide mode keeps it in the sliding sidebar, as before");
  S().updateSettings({ addressBar: "toolbar" });
});

test("a window opening collapsed puts its lights in the rail, not past the edge", () => {
  const w = fresh();
  S().toggleSidebar(w);
  const [hiddenX] = openingLightsCenter(S(), w);
  assert.ok(hiddenX < 0, "hide mode: past the edge");
  S().updateSettings({ sidebarCollapse: "icons" });
  assert.deepEqual(openingLightsCenter(S(), w), [rail.RAIL_LIGHTS_X, dm.LIGHTS_CENTER[1]]);
  S().updateSettings({ sidebarCollapse: "hide" });
});

test("the rail lists pinned tabs, then open tabs with groups and splits flattened into their tabs", () => {
  const w = fresh();
  const first = S().windows[w].tabIds[0];
  const pin = S().newTab(w, { url: "https://pin.example", background: true });
  S().togglePin(pin);
  const g1 = S().newTab(w, { url: "https://g1.example", background: true });
  const g2 = S().newTab(w, { url: "https://g2.example", background: true });
  S().createGroup([g1, g2], { name: "G" });
  const s1 = S().newTab(w, { url: "https://s1.example", background: true });
  const s2 = S().newTab(w, { url: "https://s2.example", background: true });
  S().createSplit([s1, s2]);
  const { pinned, open } = rail.railItems(S(), w);
  assert.deepEqual(pinned, [pin]);
  for (const id of [first, g1, g2, s1, s2]) assert.ok(open.includes(id), `${id} listed`);
  assert.equal(new Set(open).size, open.length, "each tab once");
  assert.ok(!open.includes(pin));
  assert.equal(rail.railItems(S(), w), rail.railItems(S(), w), "stable between calls");
});

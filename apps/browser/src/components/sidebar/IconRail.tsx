import { ContextMenuArea, MouseArea, Surface, Symbol, WindowDragRegion } from "@ardia/shell";
import { memo, useCallback } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { closeTab } from "../../lib/actions";
import { hex, ThemeScope, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { PageProfileContext, useIsActiveTab, useTab, useWindowId, useWindowProfileId } from "../../store/hooks";
import { ToolbarButton } from "../layout/controls";
import { RAIL, RAIL_ROW_EDGE, railItems, sidebarToggleTitle } from "../layout/iconRail";
import { usePagerPages, usePageStyle } from "../layout/profilePager";
import { ProfileSwipeArea } from "../layout/ProfileSwipe";
import { openNewTabInSplit } from "../layout/splitActions";
import { toolbarPalette } from "../layout/toolbarColors";
import { TabBadges } from "../media/TabBadges";
import { toggleNewTabBar } from "../omnibox/newTabBar";
import { useHover } from "../primitives";
import { GLYPH } from "../Toolbar";
import { clickTab, tabTitle } from "./actions";
import { dismissHover, dismissHoverIn, useRowHover } from "./hover";
import { openTabMenu } from "./menus";
import { registerRailRow } from "./state";
import { TabIcon } from "./TabIcon";
import { useSidebarTokens } from "./tokens";
import { clickMods } from "./TabRow";
import { useShallow } from "zustand/react/shallow";

export function IconRail() {
  const windowId = useWindowId();
  const current = useWindowProfileId();
  const { pages } = usePagerPages(windowId);
  const toggle = useBrowser((s) => s.settings.showSidebarButton !== false);
  return (
    <PageProfileContext.Provider value={current}>
      <ThemeScope>
        <View style={{ width: RAIL.width, height: "100%" }}>
          <WindowDragRegion style={StyleSheet.absoluteFill} />
          {toggle ? <RailToggle windowId={windowId} /> : null}
          <View style={{ position: "absolute", left: 0, right: 0, top: toggle ? RAIL.listTop : RAIL.toggleTop, bottom: 0, overflow: "hidden" }}>
            {pages.map((page) => (
              <RailPage key={page.id} windowId={windowId} profileId={page.id} slot={page.slot} current={page.id === current} resting={!!page.resting} />
            ))}
          </View>
          <ProfileSwipeArea surface="rail" pageWidth={RAIL.width} style={StyleSheet.absoluteFill} />
        </View>
      </ThemeScope>
    </PageProfileContext.Provider>
  );
}

function RailPage({ windowId, profileId, slot, current, resting }: { windowId: string; profileId: string; slot: number; current: boolean; resting: boolean }) {
  const pageStyle = usePageStyle(windowId, slot, RAIL.width);
  return (
    <Animated.View pointerEvents={current ? "auto" : "none"} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: RAIL.width, display: resting ? "none" : "flex", ...pageStyle }}>
      <PageProfileContext.Provider value={profileId}>
        <ThemeScope>
          <RailList windowId={windowId} profileId={profileId} />
        </ThemeScope>
      </PageProfileContext.Provider>
    </Animated.View>
  );
}

function RailList({ windowId, profileId }: { windowId: string; profileId: string }) {
  const { pinned, open } = useBrowser(useShallow((s) => railItems(s, windowId, profileId)));
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ alignItems: "center", gap: RAIL.gap, paddingTop: 2, paddingBottom: 10 }}
      showsVerticalScrollIndicator={false}
      onScroll={() => dismissHoverIn(windowId)}
      scrollEventThrottle={100}
    >
      {pinned.map((id) => (
        <RailTile key={id} tabId={id} pinned />
      ))}
      {pinned.length ? <RailDivider /> : null}
      {open.map((id) => (
        <RailTile key={id} tabId={id} pinned={false} />
      ))}
      <RailNewTab windowId={windowId} />
    </ScrollView>
  );
}

function RailToggle({ windowId }: { windowId: string }) {
  const palette = toolbarPalette(useTheme(), null);
  const title = useBrowser((s) => sidebarToggleTitle(s));
  return (
    <ToolbarButton
      style={{ position: "absolute", top: RAIL.toggleTop, left: (RAIL.width - RAIL.toggle) / 2 }}
      palette={palette}
      icon="sidebar.left"
      size={GLYPH}
      box={RAIL.toggle}
      onPress={() => useBrowser.getState().toggleSidebar(windowId)}
      tooltip={`${title} (⌘S)`}
    />
  );
}

function RailDivider() {
  const theme = useTheme();
  return <View style={{ width: RAIL.tile - 12, height: 1, marginVertical: 3, borderRadius: 0.5, backgroundColor: theme.divider }} />;
}

const RailTile = memo(function RailTile({ tabId, pinned }: { tabId: string; pinned: boolean }) {
  const theme = useTheme();
  const windowId = useWindowId();
  const tab = useTab(tabId);
  const active = useIsActiveTab(tabId);
  const tokens = useSidebarTokens();
  const selected = useBrowser((s) => (s.selection[windowId] ?? []).includes(tabId));
  const { hovered, hoverProps } = useRowHover(windowId, { kind: "tab", id: tabId });
  const register = useCallback((v: View | null) => registerRailRow(windowId, tabId, v), [windowId, tabId]);
  if (!tab) return null;
  const icon = (
    <View>
      <TabIcon tabId={tab.id} url={tab.url} favicon={tab.favicon} icon={tab.customIcon} profileId={tab.profileId} />
      <TabBadges tabId={tab.id} />
    </View>
  );
  return (
    <View ref={register} {...hoverProps} style={{ alignSelf: "flex-start", width: RAIL.width - RAIL_ROW_EDGE, paddingLeft: (RAIL.width - RAIL.tile) / 2 }}>
      <MouseArea onMiddleClick={() => void closeTab(tabId)}>
        <ContextMenuArea
          onContextMenu={() => {
            dismissHover();
            void openTabMenu(windowId, tab);
          }}
        >
          <Pressable
            accessibilityLabel={tabTitle(tab)}
            onPress={(e) => {
              dismissHover();
              clickTab(windowId, tabId, clickMods(e));
            }}
          >
            {({ pressed }) =>
              active ? (
                <Surface
                  fill={hex(theme.pinnedSelectedRim)}
                  cornerRadius={RAIL.radius}
                  shadowColor={theme.dark ? "#FFFFFF" : "#000000"}
                  shadowOpacity={theme.dark ? 0.15 : 0.12}
                  shadowRadius={1.5}
                  shadowOffset={[0, 0.5]}
                  style={{ width: RAIL.tile, height: RAIL.tile, padding: 1 }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: RAIL.radius - 1,
                      backgroundColor: theme.pinnedSelectedFill,
                      borderTopWidth: 1,
                      borderColor: theme.pinnedSelectedOutline,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {icon}
                  </View>
                </Surface>
              ) : (
                <View
                  style={{
                    width: RAIL.tile,
                    height: RAIL.tile,
                    borderRadius: RAIL.radius,
                    borderWidth: selected ? 1 : pinned ? 0.5 : 0,
                    borderColor: selected ? tokens.dragBorder : theme.pinnedRestingStroke,
                    backgroundColor: pressed ? theme.tabPressed : hovered || selected ? theme.tabHover : pinned ? theme.pinnedResting : undefined,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {icon}
                </View>
              )
            }
          </Pressable>
        </ContextMenuArea>
      </MouseArea>
    </View>
  );
});

function RailNewTab({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const tokens = useSidebarTokens();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps} tooltip="New Tab (⌘T)">
      <Pressable
        accessibilityLabel="New Tab"
        onPress={(e) => {
          if ((e.nativeEvent as unknown as { altKey?: boolean }).altKey) openNewTabInSplit(windowId);
          else toggleNewTabBar(windowId) || useBrowser.getState().newTab(windowId);
        }}
      >
        {({ pressed }) => (
          <View
            style={{
              width: RAIL.tile,
              height: RAIL.tile,
              borderRadius: RAIL.radius,
              backgroundColor: pressed ? theme.tabPressed : hovered ? theme.tabHover : undefined,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Symbol name="plus" size={13} weight="medium" color={tokens.newTabIcon} style={{ width: 16, height: 16 }} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

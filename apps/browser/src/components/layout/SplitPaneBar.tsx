import { breadcrumb } from "@ardia/core";
import { Symbol, WindowDragRegion } from "@ardia/shell";
import { memo, useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useTabLive } from "../../store/hooks";
import { HistoryButton, ReloadButton, useToolbarTab } from "../Toolbar";
import { ToolbarButton } from "./controls";
import { useHistoryAvailability } from "./history";
import { setPopover, usePages } from "./pageState";
import { closePane, showSplitMenu } from "./splitActions";
import { toolbarPalette } from "./toolbarColors";

export const SPLIT_PANE_BAR_HEIGHT = 36;
const BUTTON_BOX = 28;
const SIDE_ROOM = 3 * BUTTON_BOX + 12;

export const SplitPaneBar = memo(function SplitPaneBar({ tabId, windowId, focused }: { tabId: string; windowId: string; focused: boolean }) {
  const theme = useTheme();
  const tab = useToolbarTab(tabId);
  const isLoading = useTabLive(tabId, (l) => l.isLoading);
  const history = useHistoryAvailability(tabId);
  const siteControlsOpen = usePages((p) => p.popover[tabId] === "siteControls");
  const palette = toolbarPalette(theme, null);
  const dim = useRef(new Animated.Value(focused ? 1 : 0.5)).current;
  useEffect(() => {
    Animated.timing(dim, { toValue: focused ? 1 : 0.5, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [focused]);
  const focus = useCallback(() => {
    if (!focused) useBrowser.getState().activate(tabId);
  }, [focused, tabId]);
  if (!tab) return <View style={{ height: SPLIT_PANE_BAR_HEIGHT }} />;
  const host = !tab.url ? "" : tab.url.startsWith("file:") ? "File" : /^https?:/i.test(tab.url) ? breadcrumb(tab.url).host : tab.title || breadcrumb(tab.url).host;
  const openAddress = () => {
    focus();
    useBrowser.getState().openPanel(windowId, tab.url);
  };
  const toggleSiteControls = () => {
    focus();
    setPopover(tabId, usePages.getState().popover[tabId] === "siteControls" ? null : "siteControls");
  };

  return (
    <View style={{ height: SPLIT_PANE_BAR_HEIGHT }}>
      <WindowDragRegion style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: dim, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }]} pointerEvents="box-none">
        <HistoryButton tabId={tab.id} windowId={tab.windowId} direction={-1} disabled={!history.back} palette={palette} onFocus={focus} />
        <HistoryButton tabId={tab.id} windowId={tab.windowId} direction={1} disabled={!history.forward} palette={palette} onFocus={focus} />
        <ReloadButton tab={tab} loading={isLoading} palette={palette} onFocus={focus} />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        {tab.url ? <ToolbarButton palette={palette} icon="slider.horizontal.3" size={13} box={BUTTON_BOX} onPress={toggleSiteControls} active={siteControlsOpen} tooltip="Site Controls" /> : null}
        <ToolbarButton palette={palette} icon="rectangle.split.2x1" size={14} box={BUTTON_BOX} onPress={() => showSplitMenu(tab.id)} tooltip="Split View" />
        <ToolbarButton palette={palette} icon="xmark" size={12} weight="medium" box={BUTTON_BOX} onPress={() => closePane(tab.id)} tooltip="Close Pane" />
        {host ? (
          <View pointerEvents="box-none" style={{ position: "absolute", left: SIDE_ROOM, right: SIDE_ROOM, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Pressable onPress={openAddress} tooltip={tab.url} style={{ flexDirection: "row", alignItems: "center", maxWidth: "100%", height: BUTTON_BOX, paddingHorizontal: 8 }}>
              <Symbol name="link" size={11} weight="medium" color={palette.secondary} style={{ width: 14, height: 14, marginRight: 5 }} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontWeight: "500", color: palette.text }}>
                {host}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
      {tab.url ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: palette.divider }} /> : null}
    </View>
  );
});

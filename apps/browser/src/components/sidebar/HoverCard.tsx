import { FadeLabel, Surface, Symbol } from "@ardia/shell";
import { useEffect, useLayoutEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { displayUrl } from "@ardia/core";
import { hex, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useStoreWhile } from "../../store/tabWatch";
import { useIsBookmarked } from "../../store/hooks";
import { activeTabId, bookmarkProfileId } from "../../store/model";
import { awayFromPin, groupLabel } from "../../store/organize";
import { openInSplit } from "../layout/splitActions";
import { CalendarPreview, useIsCalendarTab } from "../live/CalendarPreview";
import { LiveItemCard } from "../live/LiveItemCard";
import { useIsSleeping } from "../../lib/tabLifecycle";
import { useHover } from "../primitives";
import { clickTab, tabTitle } from "./actions";
import { cardHoverProps, dismissHover, setHoverSpace } from "./hover";
import { hoverCardOrigin, useHoverCardMotion, useHoverCardPlacement } from "./hoverMotion";
import { springConfig } from "../layout/dockMotion";
import { useSidebarUi, type Anchor, type Hover } from "./state";
import { TabIcon } from "./TabIcon";
import { HoverPlayer, usePlayerEdge, useShowsMiniPlayer } from "../media/HoverPlayer";
import { useMedia, usePictureInPicture } from "../media/state";

const WIDTH = 264;
const ACTION_HOVER_MS = 140;
const ACTION_ENTER_MS = 200;
const ACTION_ENTER_DELAY_MS = 40;
const ACTION_STAGGER_MS = 30;
const ACTION_PRESS_SPRING = springConfig({ response: 0.22, damping: 0.7 });

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then(
  (on) => (reduceMotion = on),
  () => {},
);
AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => (reduceMotion = on));

export function HoverCard({ windowId, width, height }: { windowId: string; width: number; height: number }) {
  const hover = useSidebarUi((u) => (u.hover?.windowId === windowId ? u.hover : null));
  const orphaned = useStoreWhile(useBrowser, !!hover, (s) => (hover?.kind === "tab" && !s.tabs[hover.id]) || (hover?.kind === "group" && !s.groups[hover.id]));
  useLayoutEffect(() => {
    if (orphaned) dismissHover();
  }, [orphaned]);
  useLayoutEffect(() => setHoverSpace(windowId, height), [windowId, height]);
  const target = orphaned ? null : hover;
  const { drawn, leaving, entering, motion } = useHoverCardMotion(windowId, target);
  const shown = drawn ?? target;
  const player = useShowsMiniPlayer(shown?.kind === "tab" ? shown.id : undefined);
  const edge = usePlayerEdge(windowId, shown?.anchor);
  useHoverCardPlacement(motion, shown ? hoverCardOrigin(shown.anchor, player ? edge : undefined) : null, { width, height });
  if (!shown) return null;
  return (
    <Animated.View pointerEvents={leaving || entering ? "none" : "box-none"} style={[StyleSheet.absoluteFill, motion.style]}>
      <HoverContent hover={shown} windowId={windowId} player={player} />
    </Animated.View>
  );
}

function HoverContent({ hover, windowId, player }: { hover: Hover; windowId: string; player: boolean }) {
  const calendar = useIsCalendarTab(hover.kind === "tab" ? hover.id : null);
  if (hover.kind === "live") return <LiveItemCard id={hover.id} windowId={windowId} anchor={hover.anchor} />;
  if (hover.kind === "tab" && player) return <HoverPlayer tabId={hover.id} windowId={windowId} anchor={hover.anchor} />;
  if (hover.kind === "tab" && calendar) return <CalendarPreview tabId={hover.id} windowId={windowId} anchor={hover.anchor} />;
  return hover.kind === "tab" ? <TabCard tabId={hover.id} windowId={windowId} anchor={hover.anchor} /> : <GroupPeek groupId={hover.id} windowId={windowId} anchor={hover.anchor} />;
}

function Card({ anchor, children }: { anchor: Anchor; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Surface
      {...cardHoverProps}
      fill={hex(theme.panel)}
      cornerRadius={12}
      borderColor={hex(theme.panelBorder)}
      borderWidth={0.5}
      shadowColor="#000000"
      shadowOpacity={theme.panelShadowOpacity * 0.8}
      shadowRadius={16}
      shadowOffset={[0, 6]}
      style={{ position: "absolute", ...hoverCardOrigin(anchor), width: WIDTH, padding: 10 }}
    >
      {children}
    </Surface>
  );
}

function TabCard({ tabId, windowId, anchor }: { tabId: string; windowId: string; anchor: Anchor }) {
  const theme = useTheme();
  const tab = useBrowser((s) => s.tabs[tabId]);
  const isActive = useBrowser((s) => activeTabId(s, windowId) === tabId);
  const bookmarked = useIsBookmarked(tab?.url ?? "");
  const video = useMedia((m) => !!m.sessions[tabId]?.hasVideo || !!m.pipOpen[tabId]);
  const [pip, togglePip] = usePictureInPicture(tabId);
  const sleeping = useIsSleeping(tabId);
  if (!tab) return null;
  const s = () => useBrowser.getState();
  const away = awayFromPin(tab);
  let order = 0;
  return (
    <Card anchor={anchor}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: theme.urlPill, alignItems: "center", justifyContent: "center" }}>
          <TabIcon tabId={tabId} url={tab.url} favicon={tab.favicon} icon={tab.customIcon} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <FadeLabel text={tabTitle(tab)} fontSize={13} weight="medium" color={theme.textPrimary} style={{ height: 18 }} />
          {tab.url ? (
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11.5, lineHeight: 15, color: theme.textSecondary }}>
              {displayUrl(tab.url)}
            </Text>
          ) : null}
        </View>
      </View>
      {sleeping ? (
        <View accessible accessibilityLabel="Web content has been discarded" style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <Symbol name="moon.zzz" size={10} color={theme.textTertiary} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>This tab needs to reload</Text>
        </View>
      ) : null}
      {away && tab.pinnedUrl ? (
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, color: theme.textTertiary }}>
          Pinned: {displayUrl(tab.pinnedUrl)}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
        <Action order={order++} icon={tab.pinned ? "pin.slash" : "pin"} label={tab.pinned ? "Unpin" : "Pin"} onPress={() => s().togglePin(tabId)} />
        {tab.url ? (
          <Action
            order={order++}
            icon={bookmarked ? "bookmark.fill" : "bookmark"}
            label={bookmarked ? "Bookmarked" : "Bookmark"}
            onPress={() => s().toggleBookmark(bookmarkProfileId(s(), s().windows[windowId]), { url: tab.url, title: tabTitle(tab), favicon: tab.favicon })}
          />
        ) : null}
        {!isActive && !tab.pinned ? (
          <Action
            order={order++}
            icon="rectangle.split.2x1"
            label="Split"
            onPress={() => {
              dismissHover();
              openInSplit(tabId);
            }}
          />
        ) : null}
        {video ? <Action order={order++} icon={pip ? "pip.exit" : "pip.enter"} label={pip ? "Exit PiP" : "PiP"} onPress={togglePip} /> : null}
        {away ? (
          <Action
            order={order++}
            icon="arrow.uturn.backward"
            label="Reset"
            onPress={() => {
              dismissHover();
              s().returnToPinnedUrl(tabId);
            }}
          />
        ) : null}
      </View>
    </Card>
  );
}

function Action({ icon, label, order, onPress }: { icon: string; label: string; order: number; onPress(): void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const [hover] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(1));
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: ACTION_ENTER_MS,
      delay: ACTION_ENTER_DELAY_MS + order * ACTION_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  useEffect(() => {
    if (reduceMotion) return hover.setValue(hovered ? 1 : 0);
    Animated.timing(hover, { toValue: hovered ? 1 : 0, duration: ACTION_HOVER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [hovered]);
  const squeeze = (to: number) =>
    reduceMotion ? press.setValue(to) : Animated.spring(press, { toValue: to, ...ACTION_PRESS_SPRING, useNativeDriver: true }).start();
  return (
    <Animated.View
      {...hoverProps}
      style={{
        flex: 1,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }, { scale: press }],
      }}
    >
      <Pressable onPress={onPress} onPressIn={() => squeeze(0.94)} onPressOut={() => squeeze(1)}>
        {({ pressed }) => (
          <View style={{ height: 46, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: theme.urlPill }}>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: pressed ? theme.toolbarPressed : theme.toolbarHover, opacity: hover }]}
            />
            <Animated.View style={{ transform: [{ translateY: hover.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }] }}>
              <Symbol name={icon} size={13} color={theme.icon} style={{ width: 18, height: 16 }} />
            </Animated.View>
            <Animated.Text style={{ fontSize: 10.5, color: theme.textPrimary, opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }) }}>
              {label}
            </Animated.Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const PEEK_ROWS = 8;

function GroupPeek({ groupId, windowId, anchor }: { groupId: string; windowId: string; anchor: Anchor }) {
  const theme = useTheme();
  const group = useBrowser((s) => s.groups[groupId]);
  const label = useBrowser((s) => (s.groups[groupId] ? groupLabel(s, s.groups[groupId]!) : ""));
  if (!group) return null;
  const more = group.tabIds.length - PEEK_ROWS;
  return (
    <Card anchor={anchor}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 4, marginLeft: 4 }}>
        {label} · {group.tabIds.length === 1 ? "1 tab" : `${group.tabIds.length} tabs`}
      </Text>
      {group.tabIds.slice(0, PEEK_ROWS).map((id) => (
        <PeekRow key={id} tabId={id} windowId={windowId} />
      ))}
      {more > 0 ? <Text style={{ fontSize: 11.5, color: theme.textTertiary, marginTop: 4, marginLeft: 4 }}>and {more} more</Text> : null}
    </Card>
  );
}

function PeekRow({ tabId, windowId }: { tabId: string; windowId: string }) {
  const theme = useTheme();
  const tab = useBrowser((s) => s.tabs[tabId]);
  const [hovered, setHovered] = useState(false);
  if (!tab) return null;
  return (
    <Pressable
      onPress={() => {
        dismissHover();
        clickTab(windowId, tabId);
      }}
    >
      <View
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ height: 28, borderRadius: 7, flexDirection: "row", alignItems: "center", paddingHorizontal: 5, backgroundColor: hovered ? theme.rowHover : undefined }}
      >
        <TabIcon url={tab.url} favicon={tab.favicon} icon={tab.customIcon} size={14} profileId={tab.profileId} />
        <FadeLabel text={tabTitle(tab)} fontSize={12.5} color={theme.textTab} style={{ flex: 1, height: 17, marginLeft: 7 }} />
      </View>
    </Pressable>
  );
}

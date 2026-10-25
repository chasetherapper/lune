import { displayUrl, type Suggestion } from "@ardia/core";
import { memo, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from "react-native";
import { Surface } from "@ardia/shell";
import { hex, useTheme } from "../../lib/theme";
import { IconButton, useHover } from "../primitives";
import { sectionLabels } from "./sections";
import { SuggestionIcon, isRemovable, sameSuggestion, type RowActions } from "./SuggestionRow";

const ROW_HEIGHT = 46;
const ROW_RADIUS = 11;
const ROW_PAD = 12;
const ROW_GAP = 14;
const TILE = 30;
const TILE_RADIUS = 8;
const ICON = 18;
const ACTION_SHIFT = -6;
const ACTION_FADE_MS = 140;
const ACTION_SLIDE_MS = 180;
const ACTION_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then(
  (on) => (reduceMotion = on),
  () => {},
);
AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => (reduceMotion = on));

const hostOf = (url: string) => displayUrl(url).split(/[/?#]/)[0] ?? "";

function rowText(s: Suggestion): [string, string | null] {
  switch (s.kind) {
    case "page":
      return s.title ? [s.title, hostOf(s.url)] : [displayUrl(s.url), null];
    case "create":
      return [s.title, s.site];
    case "search":
      return [s.bang ? `Search ${s.engine} for ${s.query}` : s.query, null];
    case "calc":
      return [s.value, s.expression];
    case "action":
      return [s.title, s.hint ?? null];
  }
}

function rowAction(s: Suggestion): [string, string] {
  if (s.kind === "page" && s.tabId) return ["Switch to Tab", "→"];
  if (s.kind === "calc") return ["Copy", "↵"];
  if (s.kind === "search") return ["Search", "↵"];
  return ["Open", "↵"];
}

export const CommandBarList = memo(function CommandBarList({
  items,
  selectedIndex,
  trailing,
  actions,
}: {
  items: Suggestion[];
  selectedIndex: number;
  trailing: string | null;
  actions: RowActions;
}) {
  const labels = useMemo(() => sectionLabels(items), [items]);
  if (!items.length) return null;
  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 10, paddingBottom: 10 }}>
      {items.map((s, i) => (
        <CommandBarRow
          key={i}
          suggestion={s}
          section={labels[i] ?? null}
          selected={i === selectedIndex}
          trailing={i === 0 ? trailing : null}
          actions={actions}
        />
      ))}
    </View>
  );
});

function SectionLabel({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={{ height: 28, justifyContent: "flex-end", paddingHorizontal: ROW_PAD, paddingBottom: 6 }}>
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: theme.textTertiary }}>
        {title}
      </Text>
    </View>
  );
}

function useReveal(shown: boolean) {
  const [reveal] = useState(() => new Animated.Value(shown ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return reveal.setValue(shown ? 1 : 0);
    const animation = Animated.timing(reveal, {
      toValue: shown ? 1 : 0,
      duration: shown ? ACTION_SLIDE_MS : ACTION_FADE_MS,
      easing: ACTION_EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [shown, reveal]);
  return reveal;
}

const CommandBarRow = memo(
  function CommandBarRow({
    suggestion: s,
    section,
    selected,
    trailing,
    actions,
  }: {
    suggestion: Suggestion;
    section: string | null;
    selected: boolean;
    trailing: string | null;
    actions: RowActions;
  }) {
    const theme = useTheme();
    const { hovered, hoverProps } = useHover();
    const [title, sub] = rowText(s);
    const [actionLabel, key] = rowAction(s);
    const onRemove = isRemovable(s) ? () => actions.remove(s.url) : undefined;
    const removable = !!onRemove && (hovered || selected);
    const reveal = useReveal(selected && !trailing);
    return (
      <View>
        {section ? <SectionLabel title={section} /> : null}
        <View {...hoverProps}>
          <Pressable onPress={() => actions.choose(s)} accessibilityRole="button" accessibilityLabel={title}>
            <View
              style={{
                height: ROW_HEIGHT,
                borderRadius: ROW_RADIUS,
                borderWidth: 0.5,
                borderColor: selected ? theme.commandBarWashRing : "transparent",
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: ROW_PAD - 0.5,
                gap: ROW_GAP,
                backgroundColor: selected ? theme.commandBarWash : hovered ? theme.commandBarHover : undefined,
              }}
            >
              <Surface
                fill={hex(theme.commandBarTile)}
                cornerRadius={TILE_RADIUS}
                borderColor={hex(theme.commandBarTileRing)}
                borderWidth={0.5}
                shadowColor="#140F1E"
                shadowOpacity={theme.commandBarTileShadowOpacity}
                shadowRadius={1}
                shadowOffset={[0, 1]}
                style={{ width: TILE, height: TILE, alignItems: "center", justifyContent: "center" }}
              >
                <SuggestionIcon suggestion={s} size={ICON} />
              </Surface>
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 8, overflow: "hidden" }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: selected ? "500" : "400", color: theme.textPrimary }}>
                  {title}
                </Text>
                {sub ? (
                  <Text numberOfLines={1} style={{ flexShrink: 0, maxWidth: "45%", fontSize: 13, color: theme.textTertiary }}>
                    {sub}
                  </Text>
                ) : null}
              </View>
              {trailing ? <Text style={{ fontSize: 13, color: theme.textTertiary }}>{trailing}</Text> : null}
              <Animated.View
                pointerEvents="none"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity: reveal,
                  transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [ACTION_SHIFT, 0] }) }],
                }}
              >
                {trailing ? null : (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: theme.textPrimary }}>{actionLabel}</Text>
                    <Surface
                      fill={hex(theme.panel)}
                      cornerRadius={6}
                      borderColor={hex(theme.divider)}
                      borderWidth={0.5}
                      shadowColor="#000000"
                      shadowOpacity={0.12}
                      shadowRadius={1}
                      shadowOffset={[0, 1]}
                      style={{ width: 24, height: 22, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 12, color: theme.textPrimary }}>{key}</Text>
                    </Surface>
                  </>
                )}
              </Animated.View>
              {removable ? (
                <IconButton icon="xmark" size={10} box={22} radius={6} color={theme.textSecondary} tooltip="Remove from History" onPress={onRemove} />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>
    );
  },
  (a, b) =>
    a.selected === b.selected &&
    a.section === b.section &&
    a.trailing === b.trailing &&
    a.actions === b.actions &&
    sameSuggestion(a.suggestion, b.suggestion),
);

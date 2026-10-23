import { Surface, Symbol } from "@ardia/shell";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { create } from "zustand";
import { useTheme } from "../../lib/theme";
import { useHover } from "../primitives";
import { PersonalizeTheme } from "./PersonalizeTheme";

const INSET = 16;
const BUTTON = 30;

const usePanel = create<{ windowId: string | null }>(() => ({ windowId: null }));
const setOpen = (windowId: string | null) => usePanel.setState({ windowId });

export const PERSONALIZE_BUTTON = BUTTON;

export function PersonalizePanelHost({ windowId }: { windowId: string }) {
  const open = usePanel((s) => s.windowId === windowId);
  useEffect(() => () => {
    if (usePanel.getState().windowId === windowId) setOpen(null);
  }, [windowId]);
  return open ? <PersonalizePanel windowId={windowId} onClose={() => setOpen(null)} /> : null;
}

export function PersonalizeButton({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const open = usePanel((s) => s.windowId === windowId);
  return (
    <>
      <View {...hoverProps} tooltip="Personalize">
        <Pressable onPress={() => setOpen(open ? null : windowId)} accessibilityRole="button" accessibilityLabel="Personalize" accessibilityState={{ expanded: open }}>
          {({ pressed }) => (
            <View
              style={{
                width: BUTTON,
                height: BUTTON,
                borderRadius: BUTTON / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? theme.toolbarPressed : hovered || open ? theme.toolbarHover : undefined,
              }}
            >
              <Symbol name="paintpalette" size={14} color={hovered || open ? theme.icon : theme.textTertiary} style={{ width: BUTTON, height: BUTTON }} />
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}

function PersonalizePanel({ windowId, onClose }: { windowId: string; onClose: () => void }) {
  const panel = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  const [room, setRoom] = useState<number | null>(null);
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, []);
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} onLayout={(e) => setRoom(e.nativeEvent.layout.height - 2 * INSET)} accessibilityLabel="Close Personalize" />
      <Animated.View
        style={{
          position: "absolute",
          left: INSET,
          bottom: INSET,
          width: 340,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
        }}
      >
        <Surface
          fill={panel.dark ? "#1E1D22" : "#FCFBF9F7"}
          cornerRadius={24}
          borderColor={panel.dark ? "#FFFFFF1A" : "#1E18281A"}
          borderWidth={0.5}
          shadowColor="#140F1E"
          shadowOpacity={panel.dark ? 0.5 : 0.22}
          shadowRadius={25}
          shadowOffset={[0, 18]}
        >
          <ScrollView style={{ maxHeight: room ?? undefined }} contentContainerStyle={{ padding: 14 }}>
            <PersonalizeTheme windowId={windowId} />
          </ScrollView>
        </Surface>
      </Animated.View>
    </>
  );
}

if (__DEV__) (globalThis as { acPersonalize?: unknown }).acPersonalize = { open: setOpen };

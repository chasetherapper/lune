import { ThemeSwatch } from "@ardia/shaders";
import { Symbol } from "@ardia/shell";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { colorHex, flatColors, glassTint, isGlass, MAX_LIGHTNESS, MIN_LIGHTNESS, themeGrainAlpha, themeLightness, withStopAt } from "../../lib/profileTheme";
import { setProfileTheme } from "../../lib/profileThemeActions";
import { useTheme } from "../../lib/theme";
import type { ProfileTheme, ThemeMaterial, ThemeMode, ThemeTexture } from "../../store/types";
import { liquidGlass } from "../glass";
import { useHover } from "../primitives";
import { useFormColors } from "../settings/controls";

export const KNOB = 22;

export const MODES: { value: ThemeMode; symbol: string; title: string }[] = [
  { value: "auto", symbol: "sparkles", title: "Match System" },
  { value: "light", symbol: "sun.max", title: "Light" },
  { value: "dark", symbol: "moon", title: "Dark" },
];

export const MATERIALS: { value: ThemeMaterial; title: string; disabled?: boolean; tooltip?: string }[] = [
  { value: "gradient", title: "Gradient" },
  { value: "glass", title: "Liquid Glass", disabled: !liquidGlass, tooltip: liquidGlass ? undefined : "Needs macOS 26" },
];

export const TEXTURE_NAMES: Record<ThemeTexture, string> = { grain: "Grain", sand: "Sand", denim: "Denim", tweed: "Tweed" };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const lightnessSlider = (theme: ProfileTheme) => (themeLightness(theme) - MIN_LIGHTNESS) / (MAX_LIGHTNESS - MIN_LIGHTNESS);
export const sliderLightness = (v: number) => MIN_LIGHTNESS + clamp01(v) * (MAX_LIGHTNESS - MIN_LIGHTNESS);

export type ThemeChange = (next: ProfileTheme, settle?: boolean) => void;

export function useLiveTheme(profileId: string, theme: ProfileTheme | null | undefined) {
  const [draft, setDraft] = useState<ProfileTheme | null>(null);
  const pending = useRef<ProfileTheme | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => void (frame.current !== null && cancelAnimationFrame(frame.current)), []);
  const flush = () => {
    frame.current = null;
    if (pending.current) setProfileTheme(profileId, pending.current);
  };
  const change: ThemeChange = (next, settle = false) => {
    pending.current = next;
    setDraft(settle ? null : next);
    if (settle) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      flush();
    } else if (frame.current === null) frame.current = requestAnimationFrame(flush);
  };
  return { theme: draft ?? theme ?? null, change };
}

export function swatchColors(theme: ProfileTheme): number[] {
  return isGlass(theme) && theme.stops.length < 2 ? glassTint(theme).slice(0, 3).concat(1) : flatColors(theme);
}

export function Preview({ theme, height = 58 }: { theme: ProfileTheme; height?: number }) {
  const ui = useTheme();
  return (
    <View style={{ height, borderRadius: 9, overflow: "hidden" }}>
      <ThemeSwatch colors={swatchColors(theme)} grain={themeGrainAlpha(theme)} texture={theme.texture} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", left: 8, top: 10, width: 34, gap: 5 }}>
        {[1, 0.7, 0.85].map((w, i) => (
          <View key={i} style={{ width: `${w * 100}%`, height: 4, borderRadius: 2, backgroundColor: ui.dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)" }} />
        ))}
      </View>
      <View style={{ position: "absolute", left: 50, top: 6, right: 6, bottom: 6, borderRadius: 6, backgroundColor: ui.dark ? "rgba(18,18,18,0.72)" : "rgba(255,255,255,0.82)" }} />
    </View>
  );
}

export function usePadDrag({
  theme,
  width,
  height,
  selected,
  onSelect,
  onChange,
  circle,
}: {
  theme: ProfileTheme;
  width: number;
  height: number;
  selected: number;
  onSelect: (index: number) => void;
  onChange: ThemeChange;
  circle?: boolean;
}) {
  const ref = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const dragging = useRef(0);
  const latest = useRef(theme);
  latest.current = theme;
  const measure = () => ref.current?.measureInWindow((x, y) => (origin.current = { x, y }));
  const point = (e: GestureResponderEvent) => ({
    x: clamp01((e.nativeEvent.pageX - origin.current.x) / width),
    y: clamp01((e.nativeEvent.pageY - origin.current.y) / height),
  });
  const insideCircle = (p: { x: number; y: number }) => {
    const dx = p.x - 0.5, dy = p.y - 0.5, r = Math.hypot(dx, dy);
    return !circle || r <= 0.5 ? p : { x: 0.5 + (dx / r) * 0.5, y: 0.5 + (dy / r) * 0.5 };
  };
  const move = (e: GestureResponderEvent, settle = false) => {
    const p = insideCircle(point(e));
    onChange(withStopAt(latest.current, dragging.current, p.x, p.y), settle);
  };
  return {
    ref,
    onLayout: measure,
    onMouseEnter: measure,
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      measure();
      const p = point(e);
      const stops = latest.current.stops;
      const hit = stops.findIndex((s) => Math.hypot((s.x - p.x) * width, (s.y - p.y) * height) <= KNOB / 2 + 6);
      dragging.current = hit >= 0 ? hit : selected;
      onSelect(dragging.current);
      if (hit < 0) move(e);
    },
    onResponderMove: (e: GestureResponderEvent) => move(e),
    onResponderRelease: (e: GestureResponderEvent) => move(e, true),
    onResponderTerminate: () => onChange(latest.current, true),
  };
}

export function ColorPad({
  theme,
  size = 172,
  selected,
  onSelect,
  onChange,
}: {
  theme: ProfileTheme;
  size?: number;
  selected: number;
  onSelect: (index: number) => void;
  onChange: ThemeChange;
}) {
  const drag = usePadDrag({ theme, width: size, height: size, selected, onSelect, onChange, circle: true });
  return (
    <View {...drag} style={{ width: size, height: size }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <ThemeSwatch colors={[]} padLightness={themeLightness(theme)} style={StyleSheet.absoluteFill} />
      </View>
      {theme.stops.map((s, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: s.x * size - KNOB / 2,
            top: s.y * size - KNOB / 2,
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            borderWidth: i === selected ? 3 : 2,
            borderColor: "#FFFFFF",
            backgroundColor: colorHex(s.color),
          }}
        >
          <View style={{ position: "absolute", left: -3, top: -3, right: -3, bottom: -3, borderRadius: KNOB / 2 + 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.25)" }} />
        </View>
      ))}
    </View>
  );
}

export function SmallButton({ symbol, tooltip, disabled, onPress, width = 24, height = 20 }: { symbol: string; tooltip: string; disabled?: boolean; onPress: () => void; width?: number; height?: number }) {
  const ui = useTheme();
  const colors = useFormColors();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps} style={{ opacity: disabled ? 0.4 : 1 }}>
      <Pressable disabled={disabled} onPress={onPress} tooltip={tooltip}>
        {({ pressed }) => (
          <View
            style={{
              width,
              height,
              borderRadius: height >= 24 ? height / 2 : 5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.controlPressed : hovered ? colors.controlHover : colors.control,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.controlBorder,
            }}
          >
            <Symbol name={symbol} size={10} weight="semibold" color={ui.icon} style={{ width: 12, height: 12 }} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function Slider({
  label,
  value,
  onChange,
  labelWidth = 112,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number, settle: boolean) => void;
  labelWidth?: number;
  children?: ReactNode;
}) {
  const ui = useTheme();
  const colors = useFormColors();
  const ref = useRef<View>(null);
  const frame = useRef({ x: 0, width: 1 });
  const measure = () => ref.current?.measureInWindow((x, _y, width) => (frame.current = { x, width: Math.max(1, width) }));
  const at = (e: GestureResponderEvent) => clamp01((e.nativeEvent.pageX - frame.current.x) / frame.current.width);
  const thumb = 14;
  const v = clamp01(value);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text numberOfLines={1} style={{ width: labelWidth, fontSize: 12, color: ui.textPrimary }}>{label}</Text>
      <View
        ref={ref}
        onLayout={measure}
        onMouseEnter={measure}
        style={{ flex: 1, height: 20, justifyContent: "center" }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          measure();
          onChange(at(e), false);
        }}
        onResponderMove={(e) => onChange(at(e), false)}
        onResponderRelease={(e) => onChange(at(e), true)}
        onResponderTerminate={() => onChange(value, true)}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.switchOff, overflow: "hidden" }}>
          <View style={{ width: `${v * 100}%`, height: 4, backgroundColor: colors.accent }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${v * 100}%`,
            marginLeft: -thumb / 2,
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            backgroundColor: "#FFFFFF",
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: "rgba(0,0,0,0.2)",
          }}
        />
      </View>
      {children}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  segment,
  fill,
  height = 20,
}: {
  value: T | null;
  options: { value: T; title?: string; symbol?: string; tooltip?: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  segment?: number;
  fill?: boolean;
  height?: number;
}) {
  const ui = useTheme();
  const colors = useFormColors();
  return (
    <View style={{ flex: fill ? 1 : undefined, flexDirection: "row", borderRadius: 6, backgroundColor: colors.control, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.controlBorder, padding: 1 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} disabled={o.disabled} tooltip={o.tooltip ?? (o.title ? undefined : o.value)} onPress={() => onChange(o.value)} style={fill ? { flex: 1 } : undefined}>
            <View
              style={{
                width: segment,
                height,
                paddingHorizontal: o.title ? 10 : 0,
                borderRadius: 5,
                alignItems: "center",
                justifyContent: "center",
                opacity: o.disabled ? 0.4 : 1,
                backgroundColor: on ? colors.accent : undefined,
              }}
            >
              {o.symbol ? (
                <Symbol name={o.symbol} size={11} color={on ? "#FFFFFF" : ui.icon} style={{ width: 14, height: 14 }} />
              ) : (
                <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: on ? "600" : "400", color: on ? "#FFFFFF" : ui.textPrimary }}>{o.title}</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

import { ThemeSwatch } from "@ardia/shaders";
import { ContextMenuArea, showMenu, Surface, Symbol } from "@ardia/shell";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import { colorHex, isGlass, MAX_THEME_STOPS, resolveTheme, startingTheme, THEME_TEXTURES, themeDark, withAddedStop, withLightness, withoutStop, withSwatch } from "../../lib/profileTheme";
import { PROFILE_COLORS, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import type { ProfileTheme, ThemeColor, ThemeTexture } from "../../store/types";
import { liquidGlass } from "../glass";
import { clamp01, lightnessSlider, MODES, sliderLightness, TEXTURE_NAMES, useLiveTheme, usePadDrag, type ThemeChange } from "../theme/editorParts";

const PAD_W = 312;
const PAD_H = 300;
const SWATCH = 28;

export const SWATCH_PAGES: { name: string; swatches: string[] }[] = [
  { name: "Classic", swatches: ["#EFE6E1", "#E59ABA", "#9D6B98", "#E0595F", "#EF8955", "#F2D36A", "#6CDB93"] },
  { name: "Pastel", swatches: ["#F6D6E2", "#D9CCF5", "#C8E3F7", "#C9F0E1", "#F7EDC4", "#F8D3C3", "#E4E1DC"] },
  { name: "Neon", swatches: ["#FF3EA5", "#8A5CFF", "#2EC5FF", "#22F2A8", "#E6FF3D", "#FF8A1F", "#FF3D3D"] },
  { name: "Jewel", swatches: ["#1F5E57", "#2C3E8F", "#6B2D7A", "#9B2242", "#B5651D", "#2F7D4F", "#4B2E83"] },
  { name: "Earth", swatches: ["#C66B3D", "#D9A15B", "#8C8A4F", "#5E7D5A", "#7A5C46", "#B9A58F", "#A44A3F"] },
  { name: "Mono", swatches: ["#F4F2EF", "#D5D2CD", "#A9A5A0", "#7B7873", "#4E4B48", "#2C2A28", "#151413"] },
];

const CLEAR_BLOBS = ["#B9B6BD", "#D7D5DA", "#A3A0A8"];

export type PanelTokens = ReturnType<typeof panelTokens>;

export function panelTokens(dark: boolean) {
  return dark
    ? { dark, panel: "#1E1D22", ink: "#F2F0F5", inkSoft: "#B9B5C0", line: "rgba(255,255,255,0.10)", chip: "rgba(255,255,255,0.08)", plate: "rgba(255,255,255,0.18)", modeBg: "#26242CE0", lineHex: "#FFFFFF1A", padBtn: "rgba(255,255,255,0.14)", wave: "#8F8A98", thumb: "#E9E6EE", knob: ["#3A3740", "#6A6672"], ground: "#2A2830", dots: "#FFFFFF29", dotOn: "#E9E6EE", dotOff: "rgba(255,255,255,0.18)" }
    : { dark, panel: "rgba(252,251,249,0.97)", ink: "#24212A", inkSoft: "#5E5A64", line: "rgba(30,24,40,0.10)", chip: "rgba(30,24,40,0.06)", plate: "rgba(30,24,40,0.10)", modeBg: "#FFFFFFE0", lineHex: "#1E18281A", padBtn: "rgba(30,24,40,0.14)", wave: "#8A8690", thumb: "#FFFFFF", knob: ["#C9C6CC", "#F2F1F3"], ground: "#F3F0EB", dots: "#28243038", dotOn: "#55515B", dotOff: "rgba(30,24,40,0.16)" };
}

const hexA = (c: ThemeColor | string, a: number) => `${typeof c === "string" ? c.slice(0, 7) : colorHex(c)}${Math.round(clamp01(a) * 255).toString(16).padStart(2, "0").toUpperCase()}`;

const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

export function PersonalizeTheme({ windowId }: { windowId: string }) {
  const ui = useTheme();
  const t = panelTokens(ui.dark);
  const profileId = useBrowser((s) => s.windows[windowId]?.profileId);
  const incognito = useBrowser((s) => !!s.windows[windowId]?.incognito);
  const profile = useBrowser((s) => (profileId ? s.profiles[profileId] : undefined));
  const appDark = useBrowser((s) => s.ui.appDark);
  const live = useLiveTheme(profileId ?? "", profile?.theme);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  if (!profileId || !profile || incognito) return null;
  const stored = live.theme;
  const custom = stored?.dark ? resolveTheme(stored, themeDark(stored, appDark)) : stored;
  const theme: ProfileTheme = custom ?? startingTheme(PROFILE_COLORS[profile.color]?.swatch ?? PROFILE_COLORS.plum.swatch);
  const glass = isGlass(theme);
  const clear = glass && theme.intensity === 0;
  const index = Math.min(selected, theme.stops.length - 1);
  const change = live.change;
  const set = SWATCH_PAGES[page]!;
  const pickSwatch = (hex: string) => {
    let next = withSwatch({ ...theme, intensity: clear ? 0.62 : theme.intensity }, hex);
    if (theme.stops.length === 1) next = { ...next, stops: next.stops.slice(0, 1) };
    if (theme.stops.length === 3) next = withAddedStop(next);
    change(next, true);
  };
  const isPicked = (hex: string) => !!custom && !clear && colorHex(withSwatch(theme, hex).stops[0]!.color) === colorHex(custom.stops[0]!.color);
  const turn = (by: number) => setPage((page + by + SWATCH_PAGES.length) % SWATCH_PAGES.length);
  return (
    <View style={{ gap: 12 }}>
      <PreviewPad theme={theme} t={t} selected={index} onSelect={setSelected} onChange={change}>
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 12, alignItems: "center" }}>
          <Surface fill={t.modeBg} cornerRadius={12} borderColor={t.lineHex} borderWidth={0.5} shadowColor="#140F1E" shadowOpacity={0.16} shadowRadius={7} shadowOffset={[0, 4]}>
          <View onStartShouldSetResponder={() => true} style={{ flexDirection: "row", gap: 4, padding: 3 }}>
            {MODES.map((m) => {
              const on = (custom ? theme.mode : "auto") === m.value;
              return (
                <Pressable key={m.value} tooltip={m.title} accessibilityRole="button" accessibilityLabel={m.title} accessibilityState={{ selected: on }} onPress={() => change({ ...theme, mode: m.value }, true)}>
                  <View style={{ width: 38, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.plate : undefined }}>
                    <Symbol name={m.value === "auto" ? "sparkles" : m.value === "light" ? "sun.max" : "moon"} size={15} color={t.ink} style={{ width: 18, height: 18 }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          </Surface>
        </View>
        <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <PadButton
            t={t}
            symbol="minus"
            label="Remove a colour"
            disabled={theme.stops.length <= 1}
            onPress={() => {
              change(withoutStop(theme, index), true);
              setSelected(Math.max(0, index - 1));
            }}
          />
          <Pressable
            disabled={!glass && !liquidGlass}
            tooltip={!glass && !liquidGlass ? "Liquid Glass needs macOS 26" : undefined}
            accessibilityRole="button"
            accessibilityLabel="Switch material"
            onPress={() => change({ ...theme, material: glass ? "gradient" : "glass" }, true)}
          >
            <View style={{ height: 32, paddingLeft: 10, paddingRight: 12, gap: 6, flexDirection: "row", alignItems: "center", borderRadius: 16, backgroundColor: t.padBtn, borderWidth: 0.5, borderColor: t.line }}>
              <Symbol name={glass ? "drop" : "circle.lefthalf.filled"} size={12} weight="medium" color={t.ink} style={{ width: 15, height: 15 }} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: t.ink }}>{glass ? "Liquid Glass" : "Gradient"}</Text>
            </View>
          </Pressable>
          <PadButton
            t={t}
            symbol="plus"
            label="Add a colour"
            disabled={theme.stops.length >= MAX_THEME_STOPS}
            onPress={() => {
              change(withAddedStop(theme), true);
              setSelected(theme.stops.length);
            }}
          />
        </View>
      </PreviewPad>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Chevron t={t} symbol="chevron.left" label="Previous colour set" onPress={() => turn(-1)} />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {glass ? <Swatch t={t} color={null} label="Clear glass" selected={clear} onPress={() => change({ ...theme, intensity: 0 }, true)} /> : null}
            {set.swatches.slice(0, glass ? 6 : 7).map((hex, i) => (
              <Swatch key={hex} t={t} color={hex} label={`${set.name} ${i + 1}`} selected={isPicked(hex)} onPress={() => pickSwatch(hex)} />
            ))}
          </View>
          <Chevron t={t} symbol="chevron.right" label="Next colour set" onPress={() => turn(1)} />
        </View>
        <Text style={{ textAlign: "center", fontSize: 11, fontWeight: "600", letterSpacing: 0.3, color: t.inkSoft }}>{`${set.name.toUpperCase()}  ·  ${page + 1} / ${SWATCH_PAGES.length}`}</Text>
      </View>
      <NoiseWave
        t={t}
        value={theme.grain}
        texture={theme.texture}
        onChange={(v, settle) => change({ ...theme, grain: v }, settle)}
        onTexture={(texture) => change({ ...theme, texture, grain: theme.grain || 0.5 }, true)}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 }}>
        <Dial t={t} label={glass ? "Tint" : "Intensity"} value={theme.intensity} onChange={(v, settle) => change({ ...theme, intensity: v }, settle)} />
        <Dial t={t} label="Light" value={lightnessSlider(theme)} onChange={(v, settle) => change(withLightness(theme, sliderLightness(v)), settle)} />
        <Dial t={t} label="Clarity" value={theme.translucency} onChange={(v, settle) => change({ ...theme, translucency: v }, settle)} />
      </View>
    </View>
  );
}

function PreviewPad({ theme, t, selected, onSelect, onChange, children }: { theme: ProfileTheme; t: PanelTokens; selected: number; onSelect: (i: number) => void; onChange: ThemeChange; children: ReactNode }) {
  const drag = usePadDrag({ theme, width: PAD_W, height: PAD_H, selected, onSelect, onChange });
  const glass = isGlass(theme);
  const clear = glass && theme.intensity === 0;
  const blobs = theme.stops.flatMap((s, i) => {
    const [r, g, b] = clear ? rgbOf(CLEAR_BLOBS[i] ?? CLEAR_BLOBS[0]!) : [s.color.r, s.color.g, s.color.b];
    const a = glass ? (clear ? 0.5 : (i === 0 ? 0.35 : 0.3) + 0.6 * theme.intensity) : 0.3 + 0.65 * theme.intensity;
    const blob = [s.x, s.y, glass ? 0.42 : 0.58, clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
    return glass ? [...blob, s.x, s.y, 0.24, clamp01(r), clamp01(g), clamp01(b), clamp01(a)] : blob;
  });
  const frost = !glass ? "#00000000" : t.dark ? hexA("#222028", 0.62 - 0.45 * theme.translucency) : hexA("#FFFFFF", 0.6 - 0.42 * theme.translucency);
  return (
    <View {...drag} style={{ width: PAD_W, height: PAD_H, borderRadius: 18, overflow: "hidden" }}>
      <ThemeSwatch colors={[]} ground={t.ground} blobs={blobs} frost={frost} dots={t.dots} style={{ position: "absolute", left: 0, top: 0, width: PAD_W, height: PAD_H }} />
      {glass ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderTopColor: "rgba(255,255,255,0.55)" }} />
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 0.5, borderColor: t.line }} />
      {theme.stops.map((s, i) => {
        const big = i === selected;
        const size = big ? 40 : 28, ring = big ? 5 : 3, outer = size + 2 * ring;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: s.x * PAD_W - outer / 2, top: s.y * PAD_H - outer / 2, width: outer, height: outer }}>
            <Surface fill="#FFFFFFF5" cornerRadius={outer / 2} shadowColor="#140F1E" shadowOpacity={0.28} shadowRadius={7} shadowOffset={[0, 4]} style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorHex(s.color) }} />
            </Surface>
          </View>
        );
      })}
      {children}
    </View>
  );
}

function PadButton({ t, symbol, label, disabled, onPress }: { t: PanelTokens; symbol: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} tooltip={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      {({ pressed }) => (
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.padBtn, borderWidth: 0.5, borderColor: t.line, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }}>
          <Symbol name={symbol} size={13} weight="semibold" color={t.ink} style={{ width: 16, height: 16 }} />
        </View>
      )}
    </Pressable>
  );
}

function Chevron({ t, symbol, label, onPress }: { t: PanelTokens; symbol: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} tooltip={label} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={{ width: 28, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 }}>
          <Symbol name={symbol} size={12} weight="bold" color={t.inkSoft} style={{ width: 14, height: 14 }} />
        </View>
      )}
    </Pressable>
  );
}

function Swatch({ t, color, label, selected, onPress }: { t: PanelTokens; color: string | null; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} tooltip={label} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={{ width: SWATCH, height: SWATCH, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.92 : 1 }] }}>
          {selected ? <View style={{ position: "absolute", left: -4, top: -4, width: SWATCH + 8, height: SWATCH + 8, borderRadius: SWATCH / 2 + 4, borderWidth: 2, borderColor: t.ink }} /> : null}
          <View
            style={{
              width: SWATCH,
              height: SWATCH,
              borderRadius: SWATCH / 2,
              backgroundColor: color ?? t.chip,
              borderWidth: 0.5,
              borderColor: t.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {color ? null : <View style={{ width: 16, height: 1.8, borderRadius: 0.9, backgroundColor: t.inkSoft, transform: [{ rotate: "-45deg" }] }} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const WAVE_W = 312;
const WAVE_H = 44;

function wavePoints(noise: number): [number, number][] {
  const amp = 2 + clamp01(noise) * 12;
  const points: [number, number][] = [];
  for (let x = 16; x <= 296; x += 4) points.push([x, 22 + Math.sin(((x - 16) / 280) * Math.PI * 12) * amp]);
  return points;
}

function NoiseWave({ t, value, texture, onChange, onTexture }: { t: PanelTokens; value: number; texture: ThemeTexture; onChange: (v: number, settle: boolean) => void; onTexture: (t: ThemeTexture) => void }) {
  const ref = useRef<View>(null);
  const left = useRef(0);
  const measure = () => ref.current?.measureInWindow((x) => (left.current = x));
  const at = (e: GestureResponderEvent) => clamp01((e.nativeEvent.pageX - left.current - 18) / 284);
  const points = wavePoints(value);
  const chooseTexture = async () => {
    const choice = await showMenu(THEME_TEXTURES.map((x) => ({ id: x, title: TEXTURE_NAMES[x], checked: x === texture })));
    if (choice && choice !== texture) onTexture(choice as ThemeTexture);
  };
  const step = (by: number) => onChange(clamp01(Math.round((value + by) * 100) / 100), true);
  return (
    <ContextMenuArea onContextMenu={() => void chooseTexture()}>
      <View
        ref={ref}
        onLayout={measure}
        onMouseEnter={measure}
        tooltip={`Noise · ${TEXTURE_NAMES[texture]} (right-click for texture)`}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Noise, ${TEXTURE_NAMES[texture]}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 0.05 : -0.05)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          measure();
          onChange(at(e), false);
        }}
        onResponderMove={(e) => onChange(at(e), false)}
        onResponderRelease={(e) => onChange(at(e), true)}
        onResponderTerminate={() => onChange(value, true)}
        style={{ width: WAVE_W, height: WAVE_H, borderRadius: WAVE_H / 2, backgroundColor: t.chip }}
      >
        {points.slice(1).map(([x2, y2], i) => {
          const [x1, y1] = points[i]!;
          const len = Math.hypot(x2 - x1, y2 - y1) + 3;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{ position: "absolute", left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, width: len, height: 3, borderRadius: 1.5, backgroundColor: t.wave, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }}
            />
          );
        })}
        <View pointerEvents="none" style={{ position: "absolute", top: 5, left: Math.round(8 + clamp01(value) * 284), width: 20, height: 34 }}>
          <Surface fill={t.thumb} cornerRadius={10} shadowColor="#140F1E" shadowOpacity={0.25} shadowRadius={4} shadowOffset={[0, 2]} style={{ width: 20, height: 34 }} />
        </View>
      </View>
    </ContextMenuArea>
  );
}

const DIAL_KEYS = [{ key: "ArrowUp" }, { key: "ArrowDown" }, { key: "ArrowLeft" }, { key: "ArrowRight" }];

function Dial({ t, label, value, onChange }: { t: PanelTokens; label: string; value: number; onChange: (v: number, settle: boolean) => void }) {
  const start = useRef({ x: 0, y: 0, v: 0 });
  const v = clamp01(value);
  const at = (e: GestureResponderEvent) => clamp01(start.current.v + (start.current.y - e.nativeEvent.pageY + e.nativeEvent.pageX - start.current.x) / 160);
  const step = (by: number) => onChange(clamp01(Math.round((v + by) * 100) / 100), true);
  const [knobLow, knobHigh] = t.knob as [string, string];
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View
        focusable
        keyDownEvents={DIAL_KEYS}
        onKeyDown={(e) => step(e.nativeEvent.key === "ArrowUp" || e.nativeEvent.key === "ArrowRight" ? 0.05 : -0.05)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 0.05 : -0.05)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, v };
        }}
        onResponderMove={(e) => onChange(at(e), false)}
        onResponderRelease={(e) => onChange(at(e), true)}
        onResponderTerminate={() => onChange(v, true)}
        style={{ width: 72, height: 72 }}
      >
        {Array.from({ length: 19 }, (_, k) => {
          const f = k / 18;
          const a = (-135 + 270 * f - 90) * (Math.PI / 180);
          return (
            <View
              key={k}
              pointerEvents="none"
              style={{ position: "absolute", left: 36 + Math.cos(a) * 32 - 2, top: 36 + Math.sin(a) * 32 - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: f <= v + 0.001 ? t.dotOn : t.dotOff }}
            />
          );
        })}
        <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 14, width: 44, height: 44 }}>
          <Surface fill={knobLow} cornerRadius={22} shadowColor="#140F1E" shadowOpacity={0.22} shadowRadius={3} shadowOffset={[0, 2]} style={{ position: "absolute", left: 0, top: 0, width: 44, height: 44 }} />
          <View style={{ transform: [{ rotate: `${Math.round(-135 + 270 * v)}deg` }], width: 44, height: 44, borderRadius: 22, overflow: "hidden", borderWidth: 0.5, borderColor: t.line, borderTopColor: t.dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.6)" }}>
            <ThemeSwatch colors={[]} ground={knobLow} blobs={[0.35, 0.3, 0.75, ...rgbOf(knobHigh), 1]} style={{ position: "absolute", left: 0, top: 0, width: 44, height: 44 }} />
            <View style={{ position: "absolute", left: 21, top: 5, width: 2, height: 9, borderRadius: 1, backgroundColor: t.inkSoft }} />
          </View>
        </View>
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: t.inkSoft }}>{label}</Text>
    </View>
  );
}

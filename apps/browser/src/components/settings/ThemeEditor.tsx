import { ThemeSwatch } from "@ardia/shaders";
import { showMenu, type MenuItem } from "@ardia/shell";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  isGlass,
  MAX_THEME_STOPS,
  resolveTheme,
  startingTheme,
  THEME_TEXTURES,
  themeAccent,
  themeDark,
  withAddedStop,
  withLightness,
  withoutStop,
} from "../../lib/profileTheme";
import { PROFILE_COLORS, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { choosePresetColor, setProfileTheme } from "../../lib/profileThemeActions";
import type { ProfileColor, ProfileTheme } from "../../store/types";
import { parseArcTheme } from "../import/arcTheme";
import { importModule } from "../import/module";
import { ColorPad, lightnessSlider, MATERIALS, MODES, Preview, Segmented, SmallButton, Slider, sliderLightness, swatchColors, TEXTURE_NAMES, useLiveTheme, type ThemeChange } from "../theme/editorParts";
import { Button, Group, PopUp, Row, SectionHeader } from "./controls";

const SWATCH = 20;
const LABEL = 112;

export function ThemeSection({ profileId }: { profileId: string }) {
  const profile = useBrowser((s) => s.profiles[profileId]);
  const live = useLiveTheme(profileId, profile?.theme);
  const appDark = useBrowser((s) => s.ui.appDark);
  if (!profile) return null;
  const stored = live.theme;
  const custom = stored?.dark ? resolveTheme(stored, themeDark(stored, appDark)) : stored;
  const choosePreset = (color: ProfileColor) => choosePresetColor(profileId, color);
  const chooseCustom = () => {
    if (!custom) live.change(startingTheme(PROFILE_COLORS[profile.color]?.swatch ?? PROFILE_COLORS.plum.swatch), true);
  };
  return (
    <>
      <SectionHeader
        title="Theme"
        description="Tints this profile's windows, New Tab page and highlights."
        action={<Button title="Import from Arc…" onPress={() => void importArcTheme(profileId)} />}
      />
      <Group>
        <Row
          title="Colour"
          description={
            stored?.dark
              ? `Separate light and dark looks. Editing keeps the ${themeDark(stored, appDark) ? "dark" : "light"} one.`
              : custom
                ? "Custom gradient"
                : PROFILE_COLORS[profile.color]?.name
          }
        >
          <View style={{ flexDirection: "row", gap: 7 }}>
            {(Object.keys(PROFILE_COLORS) as ProfileColor[]).map((c) => (
              <Pressable key={c} onPress={() => choosePreset(c)} tooltip={PROFILE_COLORS[c].name}>
                <SwatchRing selected={!custom && profile.color === c} ring={PROFILE_COLORS[c].swatch}>
                  <View style={{ flex: 1, borderRadius: 8, backgroundColor: PROFILE_COLORS[c].swatch }} />
                </SwatchRing>
              </Pressable>
            ))}
            <Pressable onPress={chooseCustom} tooltip="Custom">
              <SwatchRing selected={!!custom} ring={custom ? themeAccent(custom) : "#8E8E93"}>
                <CustomSwatch theme={custom} />
              </SwatchRing>
            </Pressable>
          </View>
        </Row>
        {custom ? <ThemeEditor theme={custom} onChange={live.change} /> : null}
      </Group>
    </>
  );
}

function SwatchRing({ selected, ring, children }: { selected: boolean; ring: string; children: ReactNode }) {
  return (
    <View style={{ width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, padding: 2, borderWidth: 2, borderColor: selected ? ring : "transparent" }}>
      {children}
    </View>
  );
}

const RAINBOW: ProfileTheme = {
  stops: [
    { x: 1, y: 0.5, color: { r: 0.93, g: 0.45, b: 0.62, a: 1 } },
    { x: 0, y: 0.5, color: { r: 0.42, g: 0.66, b: 0.95, a: 1 } },
    { x: 0.5, y: 1, color: { r: 0.62, g: 0.9, b: 0.58, a: 1 } },
  ],
  intensity: 1,
  mode: "auto",
  grain: 0,
  texture: "grain",
  translucency: 0,
};

function CustomSwatch({ theme }: { theme: ProfileTheme | null }) {
  return (
    <View style={{ flex: 1, borderRadius: 8, overflow: "hidden" }}>
      <ThemeSwatch colors={swatchColors(theme ?? RAINBOW)} style={{ flex: 1 }} />
    </View>
  );
}

function ThemeEditor({ theme, onChange }: { theme: ProfileTheme; onChange: ThemeChange }) {
  const ui = useTheme();
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, theme.stops.length - 1);
  const glass = isGlass(theme);
  return (
    <View style={{ padding: 12, flexDirection: "row", gap: 18 }}>
      <View style={{ gap: 8 }}>
        <ColorPad theme={theme} selected={index} onSelect={setSelected} onChange={onChange} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11.5, color: ui.textSecondary }}>
            {theme.stops.length} of {MAX_THEME_STOPS} colours
          </Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <SmallButton
              symbol="minus"
              tooltip="Remove Colour"
              disabled={theme.stops.length <= 1}
              onPress={() => {
                onChange(withoutStop(theme, index), true);
                setSelected(Math.max(0, index - 1));
              }}
            />
            <SmallButton
              symbol="plus"
              tooltip="Add Colour"
              disabled={theme.stops.length >= MAX_THEME_STOPS}
              onPress={() => {
                onChange(withAddedStop(theme), true);
                setSelected(theme.stops.length);
              }}
            />
          </View>
        </View>
      </View>
      <View style={{ flex: 1, gap: 11 }}>
        <Preview theme={theme} />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ width: LABEL + 10, fontSize: 12, color: ui.textPrimary }}>Material</Text>
          <Segmented value={glass ? "glass" : "gradient"} options={MATERIALS} onChange={(m) => onChange({ ...theme, material: m }, true)} />
        </View>
        <Slider label={glass ? "Tint" : "Intensity"} value={theme.intensity} onChange={(v, settle) => onChange({ ...theme, intensity: v }, settle)} />
        <Slider label="Lightness" value={lightnessSlider(theme)} onChange={(v, settle) => onChange(withLightness(theme, sliderLightness(v)), settle)} />
        <Slider
          label="Pass-through blur"
          value={theme.translucency}
          onChange={(v, settle) => onChange({ ...theme, translucency: v }, settle)}
        />
        <Slider label="Noise" value={theme.grain} onChange={(v, settle) => onChange({ ...theme, grain: v }, settle)}>
          <PopUp
            value={theme.texture}
            minWidth={78}
            options={THEME_TEXTURES.map((t) => ({ value: t, title: TEXTURE_NAMES[t] }))}
            onChange={(texture) => onChange({ ...theme, texture, grain: theme.grain || 0.5 }, true)}
          />
        </Slider>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ width: LABEL + 10, fontSize: 12, color: ui.textPrimary }}>Appearance</Text>
          <Segmented value={theme.mode} segment={30} options={MODES.map((m) => ({ value: m.value, symbol: m.symbol, tooltip: m.title }))} onChange={(mode) => onChange({ ...theme, mode }, true)} />
        </View>
      </View>
    </View>
  );
}

export async function arcThemeChoices(): Promise<{ id: string; name: string; emoji?: string; color?: string; theme: ProfileTheme }[]> {
  const api = importModule();
  if (!api) return [];
  const browsers = await api.listBrowsers().catch(() => []);
  const arc = browsers.find((b) => b.id === "arc");
  return (arc?.profiles ?? []).flatMap((p) =>
    (p.spaces ?? []).flatMap((s) => {
      const theme = s.theme ? parseArcTheme(s.theme) : null;
      return theme ? [{ id: s.id, name: s.name, emoji: s.emoji, color: s.color, theme }] : [];
    }),
  );
}

export async function importArcTheme(profileId: string): Promise<boolean> {
  const choices = await arcThemeChoices();
  const items: MenuItem[] = choices.length
    ? choices.map((c) => ({ id: c.id, title: c.emoji ? `${c.emoji}  ${c.name}` : c.name, swatch: themeAccent(c.theme) }))
    : [{ id: "none", title: "No Arc spaces with a theme found", enabled: false }];
  const choice = await showMenu(items);
  const picked = choices.find((c) => c.id === choice);
  if (!picked) return false;
  setProfileTheme(profileId, picked.theme);
  return true;
}



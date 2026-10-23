import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;

const t = await import("./profileTheme.ts");

const base = () => t.startingTheme("#4691C3");
const lightnessOf = (c) => t.rgbToHsl(c.r, c.g, c.b)[2];

test("themes without lightness keep today's pad colours", () => {
  const theme = base();
  assert.equal(theme.lightness, undefined);
  assert.equal(t.themeLightness(theme), t.PAD_LIGHTNESS);
  assert.deepEqual(t.padColor(0.8, 0.3), t.padColor(0.8, 0.3, 0.6));
  for (const s of theme.stops) assert.ok(Math.abs(lightnessOf(s.color) - 0.6) < 1e-9);
});

test("lightness recolours every stop at its pad position and round-trips hue", () => {
  const theme = t.withLightness(base(), 0.9);
  assert.equal(theme.lightness, 0.9);
  theme.stops.forEach((s, i) => {
    assert.equal(s.x, base().stops[i].x);
    assert.ok(Math.abs(lightnessOf(s.color) - 0.9) < 1e-9);
  });
  const p = t.padPosition(t.padColor(0.7, 0.2, 0.3));
  assert.ok(Math.abs(p.x - 0.7) < 0.01 && Math.abs(p.y - 0.2) < 0.01);
  assert.equal(t.withLightness(base(), 5).lightness, t.MAX_LIGHTNESS);
  assert.equal(t.withLightness(base(), -1).lightness, t.MIN_LIGHTNESS);
  const moved = t.withStopAt(theme, 0, 0.1, 0.5);
  assert.ok(Math.abs(lightnessOf(moved.stops[0].color) - 0.9) < 1e-9);
  const added = t.withAddedStop(theme);
  assert.ok(Math.abs(lightnessOf(added.stops[2].color) - 0.9) < 1e-9);
});

test("swatches carry their own lightness, greys stay grey", () => {
  const pastel = t.withSwatch(base(), "#F6C1D4");
  assert.ok(pastel.lightness > 0.8);
  const grey = t.withSwatch(base(), "#7D7B77");
  for (const s of grey.stops) assert.ok(t.rgbToHsl(s.color.r, s.color.g, s.color.b)[1] < 0.05);
  assert.equal(t.withSwatch(base(), "#000000").lightness, t.MIN_LIGHTNESS);
  assert.equal(t.startingTheme("#4691C3", 0.3).lightness, 0.3);
});

test("lightness and material are sanitised", () => {
  const stops = [{ color: { r: 0.2, g: 0.3, b: 0.4 }, x: 0.5, y: 0.5 }];
  assert.equal(t.sanitizeTheme({ stops }).lightness, undefined);
  assert.equal(t.sanitizeTheme({ stops }).material, undefined);
  assert.equal(t.sanitizeTheme({ stops, lightness: 0.3 }).lightness, 0.3);
  assert.equal(t.sanitizeTheme({ stops, lightness: 9 }).lightness, t.MAX_LIGHTNESS);
  assert.equal(t.sanitizeTheme({ stops, lightness: "x" }).lightness, undefined);
  assert.equal(t.sanitizeTheme({ stops, lightness: Number.NaN }).lightness, undefined);
  assert.equal(t.sanitizeTheme({ stops, material: "glass" }).material, "glass");
  assert.equal(t.sanitizeTheme({ stops, material: "metal" }).material, undefined);
  assert.equal(t.sanitizeTheme({ stops, dark: { stops, material: "glass", lightness: 0.2 } }).dark.material, "glass");
});

test("glass themes drive the native glass tint and stay sensible for sidebar tints", () => {
  const gradient = base();
  assert.equal(t.themeBackdrop(gradient, false).themeMaterial, "gradient");
  assert.deepEqual(t.themeBackdrop(gradient, false).themeGlassTint, []);
  const glass = { ...base(), material: "glass", intensity: 1, translucency: 1 };
  const props = t.themeBackdrop(glass, false);
  assert.equal(props.themeMaterial, "glass");
  assert.equal(props.themeGlassTint.length, 4);
  assert.ok(Math.abs(props.themeGlassTint[3] - 0.5) < 1e-9);
  assert.ok(Math.abs(props.themeBaseAlpha - 0.14) < 1e-9);
  const clear = t.themeBackdrop({ ...glass, intensity: 0 }, false);
  assert.equal(clear.themeGlassTint[3], 0);
  assert.equal(clear.themeOpacity, 0);
  assert.ok(Math.abs(t.themeBackdrop({ ...glass, translucency: 0 }, true).themeBaseAlpha - 0.72) < 1e-9);
  for (const dark of [false, true])
    for (const tint of t.opaqueThemeTint(glass, dark)) assert.match(tint, /^#[0-9A-F]{6}$/);
  const [light] = t.opaqueThemeTint({ ...glass, intensity: 0 }, false);
  assert.equal(light, "#EDEDED");
});

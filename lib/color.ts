/**
 * Pure color-math helpers backing the admin "brand colors" setting.
 * Admins pick colors as hex (native <input type="color"> pickers); the app's
 * theme (app/globals.css) is built on HSL CSS custom properties in the
 * format "H S% L%" (e.g. --primary: 158 45% 22%), so everything here
 * converts hex -> HSL and derives the values globals.css can't express on
 * its own: a readable foreground per color, and a dark-mode-safe variant.
 */

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

export const BRAND_COLOR_KEYS = ["primary", "secondary", "accent"] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}

export function isValidBrandColors(value: unknown): value is BrandColors {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return BRAND_COLOR_KEYS.every((key) => typeof v[key] === "string" && isValidHex(v[key] as string));
}

export function hexToHsl(hex: string): HslColor {
  if (!isValidHex(hex)) {
    throw new Error(`Not a valid 6-digit hex color: ${hex}`);
  }

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToCssValue({ h, s, l }: HslColor): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Picks near-black or near-white text for a hex color using the standard
 * WCAG relative-luminance formula, so admins never have to separately
 * choose a readable foreground alongside each brand color.
 */
export function contrastForeground(hex: string): HslColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

  return luminance > 0.5 ? { h: 0, s: 0, l: 4 } : { h: 0, s: 0, l: 100 };
}

/**
 * Derives a dark-mode-safe variant of a light-mode brand color by nudging
 * lightness into a band that stays visible against this app's dark
 * background (.dark's --background: 158 30% 8% in globals.css), without
 * making the admin pick every color twice. Hue and saturation carry over
 * unchanged so it still reads as "the same" brand color.
 */
export function deriveDarkVariant(hsl: HslColor): HslColor {
  const MIN_DARK_L = 45;
  const MAX_DARK_L = 80;
  return { ...hsl, l: Math.min(MAX_DARK_L, Math.max(MIN_DARK_L, hsl.l)) };
}

export interface BrandCssVariables {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Expands the three admin-chosen brand colors into every CSS custom
 * property they affect (base + foreground, light + dark), ready to render
 * as inline styles / a stylesheet override in app/layout.tsx.
 */
export function buildBrandCssVariables(colors: BrandColors): BrandCssVariables {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  for (const key of BRAND_COLOR_KEYS) {
    const hex = colors[key];
    const baseHsl = hexToHsl(hex);
    const fgHsl = contrastForeground(hex);
    const darkHsl = deriveDarkVariant(baseHsl);
    // Foreground is recomputed against the dark variant's own lightness,
    // since lightening a color for dark mode can flip which text color
    // stays readable on it.
    const darkFgHsl = contrastForeground(hslToHex(darkHsl));

    light[`--${key}`] = hslToCssValue(baseHsl);
    light[`--${key}-foreground`] = hslToCssValue(fgHsl);
    dark[`--${key}`] = hslToCssValue(darkHsl);
    dark[`--${key}-foreground`] = hslToCssValue(darkFgHsl);
  }

  return { light, dark };
}

function hslToHex({ h, s, l }: HslColor): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

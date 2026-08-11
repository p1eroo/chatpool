const LEGACY_LABEL_COLORS: Record<string, string> = {
  purple: "#A855F7",
  blue: "#3B82F6",
  green: "#10B981",
  yellow: "#F59E0B",
  red: "#EF4444",
  pink: "#EC4899",
  orange: "#F97316",
};

export const DEFAULT_LABEL_COLOR = "#1F93FF";

export const LABEL_PRESET_COLORS = [
  "#1F93FF",
  "#0045FF",
  "#2586D1",
  "#10B981",
  "#FFE900",
  "#FF6000",
  "#FF0000",
  "#630303",
  "#E805AF",
  "#A855F7",
  "#14B8A6",
] as const;

/** Colores vivos para pastillas (sin grises). */
const VIVID_LABEL_COLORS = LABEL_PRESET_COLORS;

export function isHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export function normalizeHexColor(value: string): string {
  if (!value) return DEFAULT_LABEL_COLOR;

  if (isHexColor(value)) {
    if (value.length === 4) {
      const [, r, g, b] = value;
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return value.toUpperCase();
  }

  return LEGACY_LABEL_COLORS[value] ?? DEFAULT_LABEL_COLOR;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = normalizeHexColor(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  const toHex = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function cnColor(color: string): string {
  if (isHexColor(color)) return "";
  const colors: Record<string, string> = {
    purple: "bg-purple-500",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    pink: "bg-pink-500",
    orange: "bg-orange-500",
  };
  return colors[color] || "bg-gray-500";
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Grises / casi sin saturación → no sirven como color de etiqueta. */
export function isNeutralLabelColor(color: string): boolean {
  const { s } = hexToHsl(normalizeHexColor(color));
  return s < 14;
}

/**
 * Si la etiqueta quedó en gris, asigna un color vivo estable según el nombre/id.
 */
export function resolveLabelAccentColor(color: string, seed = ""): string {
  const hex = normalizeHexColor(color);
  if (!isNeutralLabelColor(hex)) return hex;

  const key = seed.trim() || hex;
  return VIVID_LABEL_COLORS[hashSeed(key) % VIVID_LABEL_COLORS.length];
}

function buildExpandedPalette(count: number): string[] {
  const palette = [...VIVID_LABEL_COLORS];
  let i = 0;
  while (palette.length < count) {
    const hue = (i * 47 + 13) % 360;
    const candidate = hslToHex(hue, 72, 55);
    if (!palette.includes(candidate)) {
      palette.push(candidate);
    }
    i += 1;
  }
  return palette;
}

/**
 * Asigna un color único por etiqueta dentro de un conjunto (p. ej. una bandeja).
 * Conserva colores propios no grises cuando no chocan; el resto toma huecos de la paleta.
 */
export function assignUniqueLabelAccentColors(
  labels: Array<{ id: string; name: string; color: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  const pending: Array<{ id: string; name: string; color: string }> = [];

  const sorted = [...labels].sort((a, b) => a.id.localeCompare(b.id));

  for (const label of sorted) {
    const hex = normalizeHexColor(label.color);
    if (!isNeutralLabelColor(hex) && !used.has(hex)) {
      result[label.id] = hex;
      used.add(hex);
    } else {
      pending.push(label);
    }
  }

  const palette = buildExpandedPalette(labels.length + 4);
  const remaining = palette.filter((color) => !used.has(color));

  for (const label of pending) {
    const pick =
      remaining.shift() ??
      hslToHex(hashSeed(label.id || label.name) % 360, 72, 55);
    result[label.id] = pick;
    used.add(pick);
  }

  return result;
}

/**
 * Estilo de pastilla con fondo tintado visible y texto legible en tema oscuro.
 */
export function getLabelChipStyle(
  color: string,
  seed = "",
  accentOverride?: string
): { backgroundColor: string; color: string; accentColor: string } {
  const accentColor = accentOverride || resolveLabelAccentColor(color, seed);
  const { h, s } = hexToHsl(accentColor);
  const saturation = Math.min(Math.max(s, 45), 72);

  return {
    accentColor,
    // Fondo sólido con tono bajo del color (mejor contraste que alpha).
    backgroundColor: hslToHex(h, saturation, 26),
    // Texto claro del mismo matiz.
    color: hslToHex(h, Math.min(saturation + 8, 80), 84),
  };
}

/**
 * React Native theme mirroring packages/ui/tokens.css (BRAND.md — cadastral drawing).
 * Keep hex values in sync with tokens.css; `tokens.test.ts` checks the light/dark contrast pairs.
 */
export const palette = {
  plaster: '#EDF0EB',
  basalt: '#17201D',
  mtatsminda: '#1E4A42',
  sulfur: '#D8A31A',
  blueprint: '#2F5FB8',
  stone: '#8A968F',
  brick: '#B4492F',
} as const;

export type ThemeColors = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryHover: string;
  primaryContrast: string;
  accent: string;
  accentContrast: string;
  link: string;
  danger: string;
  success: string;
  focus: string;
  overlay: string;
  mapWater: string;
  mapPark: string;
  sulfur: string;
};

export const lightColors: ThemeColors = {
  bg: palette.plaster,
  surface: '#F7F9F5',
  surface2: '#E3E8E1',
  text: palette.basalt,
  textMuted: '#56625C',
  border: '#CFD6D0',
  borderStrong: palette.stone,
  primary: palette.mtatsminda,
  primaryHover: '#163A34',
  primaryContrast: '#F7F9F5',
  accent: palette.sulfur,
  accentContrast: palette.basalt,
  link: palette.blueprint,
  danger: '#A3402A',
  success: '#2C6B4F',
  focus: palette.blueprint,
  overlay: 'rgba(23, 32, 29, 0.48)',
  mapWater: '#B9CBE6',
  mapPark: '#C9DBC8',
  sulfur: palette.sulfur,
};

export const darkColors: ThemeColors = {
  bg: palette.basalt,
  surface: '#1D2825',
  surface2: '#26332F',
  text: palette.plaster,
  textMuted: '#A9B4AE',
  border: '#33413C',
  borderStrong: '#5B6A64',
  primary: '#6FB3A2',
  primaryHover: '#86C3B3',
  primaryContrast: '#0F1614',
  accent: '#E3B43A',
  accentContrast: '#17201D',
  link: '#8FB0EA',
  danger: '#E0826B',
  success: '#7CC29F',
  focus: '#8FB0EA',
  overlay: 'rgba(0, 0, 0, 0.6)',
  mapWater: '#253A57',
  mapPark: '#22362D',
  sulfur: palette.sulfur,
};

export const radius = { button: 6, card: 12, modal: 20, photo: 4 } as const;
/** 8 px base spacing (BRAND.md). */
export const space = (n: number) => n * 8;

export const fonts = {
  light: 'NotoSansGeorgian_300Light',
  regular: 'NotoSansGeorgian_400Regular',
  medium: 'NotoSansGeorgian_500Medium',
  semibold: 'NotoSansGeorgian_600SemiBold',
  bold: 'NotoSansGeorgian_700Bold',
} as const;

/** size / line-height px (BRAND.md scale; Georgian body line-height 1.6). */
export const typeScale = {
  display: { fontSize: 56, lineHeight: 60 },
  h1: { fontSize: 40, lineHeight: 48 },
  h2: { fontSize: 28, lineHeight: 36 },
  h3: { fontSize: 20, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 26 },
  small: { fontSize: 13, lineHeight: 20 },
} as const;

export type Theme = { dark: boolean; colors: ThemeColors };

/** WCAG relative luminance contrast ratio for #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

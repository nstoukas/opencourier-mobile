// A COPY of opencourier-design-system/native/theme.ts (spec 0007). The design system is the source:
// change a token there and copy the file again (then run Prettier on it), keeping the app additions at the end.
//
// OpenCourier tokens for React Native (opencourier-mobile). Generated from tokens.json.
// Use with NativeWind / React Native Reusables via ../web/tailwind4/globals.css, or directly:
//   import { colors, space, radius, control, type } from "@/styles/theme"
import { Platform, type TextStyle } from 'react-native';

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const colors = {
  light: {
    background: '#ffffff',
    foreground: '#393938',
    card: '#ffffff',
    'card-foreground': '#393938',
    popover: '#ffffff',
    'popover-foreground': '#393938',
    primary: '#393938',
    'primary-foreground': '#ffffff',
    secondary: '#ebebeb',
    'secondary-foreground': '#393938',
    muted: '#f6f6f6',
    'muted-foreground': '#62615f',
    accent: '#f6f6f6',
    'accent-foreground': '#393938',
    destructive: '#c8453e',
    'destructive-foreground': '#ffffff',
    border: '#e9e7e2',
    input: '#d0d5dd',
    ring: '#393938',
    'chart-1': '#2a78d6',
    'chart-2': '#eb6834',
    'chart-3': '#1baf7a',
    'chart-4': '#eda100',
    'chart-5': '#e87ba4',
    sidebar: '#f6f6f6',
    'sidebar-foreground': '#393938',
    'sidebar-primary': '#393938',
    'sidebar-primary-foreground': '#ffffff',
    'sidebar-accent': '#ebebeb',
    'sidebar-accent-foreground': '#393938',
    'sidebar-border': '#e9e7e2',
    'sidebar-ring': '#393938',
    success: '#458155',
    'success-foreground': '#ffffff',
    'success-soft': '#f0f7f1',
    warning: '#fae48e',
    'warning-foreground': '#393938',
    'warning-soft': '#fdf7dc',
    info: '#2f5981',
    'info-foreground': '#ffffff',
    'info-soft': '#ecf2f8',
    'destructive-soft': '#fcedec',
    overlay: 'rgba(0, 0, 0, 0.5)',
    route: '#5096f0',
    'online-tint': '#65c466',
    'offline-tint': '#919296',
  },
  dark: {
    background: '#1c1c1b',
    foreground: '#f4f3f0',
    card: '#242423',
    'card-foreground': '#f4f3f0',
    popover: '#242423',
    'popover-foreground': '#f4f3f0',
    primary: '#f4f3f0',
    'primary-foreground': '#393938',
    secondary: '#33322f',
    'secondary-foreground': '#f4f3f0',
    muted: '#2a2a28',
    'muted-foreground': '#a9a7a1',
    accent: '#33322f',
    'accent-foreground': '#f4f3f0',
    destructive: '#e5675f',
    'destructive-foreground': '#1c1c1b',
    border: '#3a3936',
    input: '#55534f',
    ring: '#f4f3f0',
    'chart-1': '#3987e5',
    'chart-2': '#d95926',
    'chart-3': '#199e70',
    'chart-4': '#c98500',
    'chart-5': '#d55181',
    sidebar: '#222221',
    'sidebar-foreground': '#f4f3f0',
    'sidebar-primary': '#f4f3f0',
    'sidebar-primary-foreground': '#393938',
    'sidebar-accent': '#33322f',
    'sidebar-accent-foreground': '#f4f3f0',
    'sidebar-border': '#3a3936',
    'sidebar-ring': '#f4f3f0',
    success: '#3f7a4f',
    'success-foreground': '#ffffff',
    'success-soft': '#1f2c22',
    warning: '#e8cf6a',
    'warning-foreground': '#1c1c1b',
    'warning-soft': '#322c15',
    info: '#8ab4e0',
    'info-foreground': '#1c1c1b',
    'info-soft': '#1d2733',
    'destructive-soft': '#3a2220',
    overlay: 'rgba(0, 0, 0, 0.5)',
    route: '#5096f0',
    'online-tint': '#65c466',
    'offline-tint': '#919296',
  },
} as const;

export type ColorName = keyof typeof colors.light;

/** Tailwind's 4px scale by class step: space[4] = 16 */
export const space = {
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '3': 12,
  '4': 16,
  '6': 24,
  '8': 32,
  '12': 48,
} as const;

/** shadcn radius math on a 10px base; full = pill */
export const radius = {
  base: 10,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  '2xl': 18,
  full: 9999,
} as const;

/** Control heights. Mobile controls use xl (48); offer is Accept/Decline only. */
export const control = {
  xs: 24,
  sm: 32,
  default: 36,
  lg: 40,
  xl: 48,
  offer: 100,
} as const;

export const type = {
  display: {
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.75 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: '600', letterSpacing: -0.6 },
  h3: { fontSize: 18, lineHeight: 28, fontWeight: '600' },
  h4: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  lead: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  'body-sm': { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 14, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  'button-lg': { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  amount: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  code: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: monoFamily,
  },
} satisfies Record<string, TextStyle>;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

// ─── App additions (spec 0007) ────────────────────────────────────────────────

// The app is light only, so screens read `color.<token>`: the light set under a short name.
export const color = colors.light;

// A token at an opacity, for the few translucent colors: withAlpha(color.muted, 0.5).
// It takes a 6 digit hex ("#rrggbb"), which every color token except `overlay` is.
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// The text styles again under a name that never clashes: many components have a `type` prop or
// variable, and `type` is also a TypeScript keyword. App code reads `typeScale.body.fontSize`.
export const typeScale = type;

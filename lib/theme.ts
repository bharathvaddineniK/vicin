export const theme = {
  colors: {
    bg: "#FFFFFF",
    text: "#0F172A", // deep slate
    subtext: "#475569",
    primary: "#2563EB", // accessible blue
    primaryHover: "#1D4ED8",
    border: "#CBD5E1",
    muted: "#F1F5F9",
    danger: "#EF4444",
    success: "#16A34A",
    focus: "#94A3B8", // focus outline for keyboard/TV
  },
  radii: { sm: 10, md: 12, lg: 16, pill: 999 },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  type: {
    // a11y-friendly type scale
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    display: 28,
  },
  touch: 44, // min touch target px per WCAG
};

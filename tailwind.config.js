/** Design-Token als Tailwind-Farbe: rgb(var(--gm-x) / <alpha-value>), Werte in src/index.css. */
const c = (v) => `rgb(var(--gm-${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: c("canvas"),
        surface: { DEFAULT: c("surface"), 2: c("surface-2") },
        line: { DEFAULT: c("line"), subtle: c("line-subtle"), control: c("line-control") },
        fg: { DEFAULT: c("fg"), soft: c("fg-soft"), muted: c("fg-muted") },
        accent: { DEFAULT: c("accent"), text: c("accent-text"), soft: c("accent-soft") },
        danger: { DEFAULT: c("danger"), soft: c("danger-soft") },
        status: {
          open: c("status-open"),
          "open-soft": c("status-open-soft"),
          vote: c("status-vote"),
          "vote-soft": c("status-vote-soft"),
          done: c("status-done"),
          "done-soft": c("status-done-soft"),
          received: c("status-received"),
          "received-soft": c("status-received-soft"),
        },
        wish: { DEFAULT: c("wish"), text: c("wish-text"), soft: c("wish-soft") },
        glow: c("glow"),
      },
      // 9 Stufen, Minimum 11 px. xs/sm/base behalten die Tailwind-Zeilenhöhen,
      // lg ebenfalls (28 px), damit bestehende Seiten unverändert bleiben.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem" }], // 11 / 14
        xs: ["0.75rem", { lineHeight: "1rem" }], // 12 / 16
        meta: ["0.8125rem", { lineHeight: "1.125rem" }], // 13 / 18
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14 / 20
        body: ["0.9375rem", { lineHeight: "1.375rem" }], // 15 / 22
        base: ["1rem", { lineHeight: "1.5rem" }], // 16 / 24
        lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18 / 28
        title: ["1.375rem", { lineHeight: "1.75rem" }], // 22 / 28
        display: ["2rem", { lineHeight: "2.25rem" }], // 32 / 36
      },
      borderRadius: {
        tile: "10px",
        btn: "14px",
        card: "20px",
        sheet: "24px",
      },
      backgroundImage: {
        "grad-primary": "var(--gm-grad-primary)",
        "grad-hero": "var(--gm-grad-hero)",
        // Violetter Schein oben (Login, Boot, Links) – dunkel über --gm-glow gedämpft.
        "glow-top": "radial-gradient(120% 60% at 50% 0%, rgb(var(--gm-glow)) 0%, rgb(var(--gm-canvas)) 55%)",
      },
      boxShadow: {
        card: "var(--gm-shadow-card)",
        primary: "var(--gm-shadow-primary)",
      },
      // Mindest-Trefferfläche für Touch (WCAG 2.5.5 / Apple HIG).
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
    },
  },
  plugins: [],
};

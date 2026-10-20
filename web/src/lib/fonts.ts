import localFont from "next/font/local";

// Aarka Tech typography: Manrope (OFL, vendored latin + latin-ext variable files,
// so no network at build or runtime), chosen as the closest free geometric sans
// to the brand reference. The previous Inter / Instrument Serif export names are
// kept so every existing component switches to Manrope without per-file edits.
export const inter = localFont({
  src: [
    { path: "../assets/fonts/manrope/manrope-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "../assets/fonts/manrope/manrope-latin-ext-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

// Display headings: same family, heavier weight (no decorative serif). A single "700" face clamps the variable wght axis, so headings render bold even where components ask for 400.
export const instrumentSerif = localFont({
  src: [
    { path: "../assets/fonts/manrope/manrope-latin-wght-normal.woff2", weight: "700", style: "normal" },
    { path: "../assets/fonts/manrope/manrope-latin-ext-wght-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const instrumentSerifItalic = localFont({
  src: [
    { path: "../assets/fonts/manrope/manrope-latin-wght-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-instrument-serif-italic",
  display: "swap",
});

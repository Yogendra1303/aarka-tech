# Third-party licenses (summary)

Generated at release time from a clean `npm install` (root) and `npm --prefix web ci` on macOS arm64. These packages are installed on your machine by npm; none are bundled in this repository. Each package keeps its own license, found in its folder under `node_modules`.

| License | Packages |
|---|---|
| MIT | 136 |
| Apache-2.0 | 14 |
| ISC | 5 |
| MPL-2.0 | 2 |
| PSF-2.0 | 1 |
| BSD-2-Clause | 1 |
| LGPL-3.0-or-later | 1 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| BSD-3-Clause | 1 |
| 0BSD | 1 |

## Packages not under a permissive MIT/BSD/ISC/Apache license

| Package | License | Notes |
|---|---|---|
| lightningcss-darwin-arm64@1.32.0 | MPL-2.0 | Build tool (CSS) pulled in by Tailwind; file-level copyleft applies only to its own files. |
| lightningcss@1.32.0 | MPL-2.0 | Build tool (CSS) pulled in by Tailwind; file-level copyleft applies only to its own files. |
| argparse@3.0.3 | PSF-2.0 | argparse (Python Software Foundation license, permissive). |
| @img/sharp-libvips-darwin-arm64@1.3.4 | LGPL-3.0-or-later | Image library (libvips) used by Next.js image optimisation; dynamically linked prebuilt binary. |
| @img/sharp-wasm32@0.35.5 | Apache-2.0 AND LGPL-3.0-or-later AND MIT | WebAssembly build of sharp/libvips (optional). |
| argparse@2.0.1 | Python-2.0 | argparse (permissive). |
| caniuse-lite@1.0.30001799 | CC-BY-4.0 | Browser-support data (caniuse); attribution: caniuse.com. |

Fonts: Manrope, Inter and Instrument Serif are vendored under `web/src/assets/fonts/` with their SIL Open Font License 1.1 files.

Regenerate this list before each release (see docs/RELEASING.md).

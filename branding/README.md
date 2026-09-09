# Clip Squeezer brand kit

Open [the visual gallery](index.html) in a browser. It works offline. Assets are original vector artwork created for this project and are provided under the repository's MIT OR Apache-2.0 license.

## Direction

**A little less video admin.** A small utility with four clear jobs. The gently pinched video frame gives “Squeezer” a visual meaning; inward pressure marks add a little personality. Rounded corners and generous space keep it approachable. No mascot, confetti or editing-workstation imagery.

**Product line:** Four useful things for video files.  
**Promise:** Free. Local. No uploads.  
**Actions:** Make smaller · Convert · Trim · Extract audio.

## Files

| Asset | Location / format |
|---|---|
| Visual guide and download gallery | `index.html` |
| Mark, monochrome and reversed marks | `logos/logo-mark*.svg`, transparent PNG equivalents |
| Horizontal, reversed and stacked lockups | `logos/logo-horizontal*.svg`, `logos/logo-stacked.svg`, PNG equivalents |
| App tile and favicon master | `logos/app-icon.svg`, `logos/favicon.svg` |
| Empty-state illustration | `logos/drop-video.svg` and PNG |
| 27 interface icons | `icons/*.svg`, 24 × 24 |
| Desktop icon sizes | `app-icons/app-{16,24,32,48,64,128,256,512,1024}.png` |
| Windows and macOS containers | `app-icons/icon.ico`, `app-icons/icon.icns` |
| Social / Open Graph | `social/social-card.svg` and PNG, 1200 × 630 |
| Repository / release banner | `social/repository-banner.svg` and PNG, 1280 × 640 |
| Profile / project avatar | `social/avatar.svg` and PNG, 512 × 512 |

The installed desktop assets live in `../src-tauri/icons/`. Web-ready copies, ICO favicon and 180 px touch icon live in `../public/brand/` and the landing page's `brand/` directory. The desktop app and site use the same source artwork.

## Logo use

Use the horizontal ink logo on light surfaces. Use the reversed lockup on ink or another plain dark surface. Reserve the mint tile for the app icon, avatar and favicon. Use the single-colour mark for single-ink reproduction.

Leave clear space of at least one-quarter of the mark's height around a lockup. Minimum horizontal lockup width: 172 px. Minimum standalone mark: 24 px; use the dedicated favicon tile at 16 px. Do not stretch, rotate or add shadows to the logo itself. Avoid busy photographic backgrounds. Keep the play cutout transparent.

## Colour and typography

| Colour | Hex | Role |
|---|---|---|
| Ink | `#182D28` | Main text and mark |
| Chalk | `#F7F8F2` | Default canvas |
| Mint | `#B9EB93` | App tile and brand highlights; ink text |
| Fern | `#216B50` | Light-theme primary buttons and links; white button text |
| Slate | `#586B63` | Secondary text on light surfaces |
| Soft green | `#E4F3D9` | Make smaller, ink `#355C27` |
| Soft blue | `#E2EEF8` | Convert, ink `#315F80` |
| Apricot | `#FBE9DA` | Trim, ink `#8B4A21` |
| Lilac | `#EEE7F6` | Extract audio, ink `#71538B` |

Use the operating system's sans-serif font: Segoe UI on Windows, the system font on macOS, with a generic sans-serif fallback. Body: regular, 14–16 px. Buttons: medium/semibold. Headings: semibold/bold with slightly tighter spacing. Exported lockups and campaign graphics use outlined DejaVu Sans so they need no installed font; font files are not distributed. UI colour tokens, including dark-theme values, live in `../src/App.css`.

## Icon use

24 px drawing grid, 1.8 px strokes, round caps and joins. Default UI sizes: 16–20 px in buttons, 26–32 px in action tiles. Inherit the surrounding text colour through `currentColor`. Do not use a fixed-width stroke when scaling the artwork.

Use the same action glyph in the selector and its submit button. Keep the visible action label. Icons are decorative in React; icon-only controls must have a specific accessible button label. Provide visible keyboard focus and honour reduced-motion preferences. Use text, not colour alone, for disabled states and errors.

Primary metaphors: inward pressure for Make smaller; opposing arrows for Convert; a kept section between two handles for Trim; sound leaving a track for Extract audio. Utility icons cover file choice, folders, playback, history, navigation, privacy, copying, cancellation, deletion, status and downloads. Segmented text choices stay text-only.

## Voice

Be calm, direct and lightly warm. Say “Drop a video here”, “Your original stays untouched”, “Show in folder”, “Done”. Explain an error literally; no jokes when someone may be worried about a file.

Avoid codec language in headlines, “magic”, fixed savings, instant-processing promises, “lossless” compression or trimming, and uploading imagery. The brand describes all four jobs, even though the name nods to compression.

**Short description:** Clip Squeezer is a free desktop utility for making videos smaller, converting formats, trimming the beginning or end, and extracting audio. Everything happens on your computer, and the original file stays untouched.

**Release / social copy:** Big file? Wrong format? A bit too long? Clip Squeezer does four useful things for video files: make smaller, convert, trim, and extract audio. Free. Local. No uploads.

## Rebuilding the kit

Run from `video-editor/`:

```sh
node scripts/build-brand.mjs
# Install export tools separately; they are not app dependencies.
npm install --prefix /tmp/clipsqueezer-brand @resvg/resvg-js@2.6.2 opentype.js@2.0.0
node scripts/export-brand.mjs /tmp/clipsqueezer-brand/node_modules
```

The SVG builder uses `source/mark.svg` and `../src/assets/brand-icons.json`. The export step outlines text, renders PNGs, and assembles ICO/ICNS containers. It updates desktop and website copies. Run both steps after changing the sources. The exporter defaults to DejaVu Sans under `/usr/share/fonts/truetype/dejavu/`; set `BRAND_FONT_REGULAR` and `BRAND_FONT_BOLD` to equivalent local font paths on other systems. No new runtime dependencies are required.

The landing page is local HTML/CSS with no font or styling CDN. Its deploy scripts allow AWS CLI to infer each asset's MIME type. Branding updates are prepared locally; publishing remains a separate action.

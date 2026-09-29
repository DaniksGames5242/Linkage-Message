Manual helpers (not part of `npm run e2e`), run against running emulators and
`python3 -m http.server 8765 --directory ../public`:

- `explore*.cjs` — walk through the screens on a phone-sized viewport and save
  screenshots to `$OUT`, printing any console errors.
- `touch.cjs`, `rec-touch.cjs` — touch-gesture walks (long press, swipes, the
  record button) with screenshots.
- `en-scan.cjs` — switches to English and lists any Russian text left on screen.

# tSearch — Multi-Search Torrents (MV3)

Chrome extension for searching multiple torrent trackers from one interface. Built for Manifest V3 and powered by Vite.

## Install / Run

- Requirements: Node.js + pnpm.
- Commands:
  - `pnpm run build:data` — refresh `explorers.json` and `trackers.json`.
- `pnpm run build` — production build to `dist/` and archive to `release/tms.zip` (via CRXJS + `vite-plugin-zip-pack`).
- `pnpm run build:data && pnpm run build` — full release pipeline (refresh data -> typecheck -> build).
- `pnpm run typecheck` — run TypeScript check for build configs (`vite.config.ts`, `manifest.config.ts`).
- `pnpm run dev` — run Vite development mode.
- `pnpm run release` — `build:data` and `build`.

## Chrome installation

Use **Load unpacked** and select the `dist` folder.

## Compatibility

- Chrome 88+ (Manifest V3)

## Screenshots

| ![Search result screen](media/screen1.png) | ![Tracker list and options](media/screen2.png) |
| --- | --- |

## Notes

- Request processing and tracker updates run in the background process (no content scripts).
- Page injections use `chrome.scripting.executeScript`.

## License

See `LICENSE.md`.

## Credits

- Original project: [tSearch](https://github.com/Feverqwe/tSearch) by Anton, 2016.
- Fork: [tSearch-manifestv3](https://github.com/Feverqwe/tSearch) by reslear, 2026.

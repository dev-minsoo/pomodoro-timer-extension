# Pomodoro Timer (Chrome Extension)

Simple Pomodoro timer built with React, TypeScript, Tailwind CSS, and Vite. The timer state is managed by an MV3 **service worker** and the Popup/Options UIs communicate with it via runtime messages.

---

## Features

### Popup
- **Timer controls**: Start / Pause / Reset / Skip
- **Phases**: Focus / Break / **Long Break**
- **Display modes**: Text timer or **ring progress**
- **Compact mode** for tighter popup sizing
- **Cycle info**
  - Total completed Pomodoros
  - “Until long break” progress when long breaks are enabled

### Options
- **Session lengths**
  - Focus minutes / Break minutes
  - Long break minutes / Long break interval
  - Enable/disable long breaks
- **Automation**
  - Auto switch sessions
- **Alerts**
  - Notifications (with preview)
  - Sound alerts: enable/disable, sound type (beep/bell/chime/soft/tick), repeat count, preview
- **Badge**
  - Show countdown on the extension icon
- **Theme**
  - Light / Dark

---

## Quick Start

1. Click the extension icon and press **Start** in the popup.
2. Open **Settings (⚙)** to configure durations, alerts, and display mode.
3. When a session ends, notifications/sounds are triggered based on your settings and the timer switches automatically if enabled.

---

## Architecture (High-level)

- **Popup UI**: `src/app/popup/` — Timer UI and controls
- **Options UI**: `src/app/options/` — Settings page and previews
- **Background (MV3 Service Worker)**: `src/scripts/background/index.ts` — Single source of truth for timer state, alarms, notifications, badge
- **Offscreen Document**: `src/app/offscreen/` — Plays audio via AudioContext (MV3 limitation workaround)
- **Content Script**: `src/scripts/content/index.ts` — Minimal script

### Storage
- State: `pomodoroState`
- Settings: `pomodoroSettings`

### Alarms
- `pomodoro-end` (session end)
- `pomodoro-tick` (badge updates)

### Messaging (core)
Popup/Options → Background:
- `POMODORO_GET_STATE`
- `POMODORO_START` / `POMODORO_PAUSE` / `POMODORO_RESET` / `POMODORO_SKIP`

Options → Background (previews):
- `POMODORO_SETTINGS_UPDATED`
- `POMODORO_PREVIEW_SOUND`
- `POMODORO_PREVIEW_NOTIFICATION`

Background → Offscreen:
- `POMODORO_PLAY_SOUND`

---

## Development

```bash
npm install
```

```bash
npm run dev      # Vite dev server
npm run build    # Type-check + build + copy manifest to dist/
npm run lint     # ESLint
```

The production build outputs to `dist/`.

---

## Load Unpacked (Chrome)

1. Build the extension:
   ```bash
   npm run build
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `dist/` folder.

---

## Project Structure (Summary)

```txt
manifest.json
src/
  app/
    popup/       # Popup UI
    options/     # Options UI
    offscreen/   # Audio playback
  scripts/
    background/  # MV3 service worker
    content/     # Content script
  shared/
    utils/       # Pomodoro types and helpers
```

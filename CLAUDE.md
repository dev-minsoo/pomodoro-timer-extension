# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check + build + copy manifest to dist/
npm run lint     # Run ESLint
```

To load the extension in Chrome: build, then go to `chrome://extensions`, enable Developer mode, click "Load unpacked", and select the `dist/` folder.

## Architecture

This is a Chrome Extension (Manifest V3) Pomodoro timer built with React, TypeScript, Tailwind CSS, and Vite.

### Entry Points

The extension has multiple entry points configured in `vite.config.ts`:

- **Popup** (`src/app/popup/`) - Main timer UI shown when clicking the extension icon
- **Options** (`src/app/options/`) - Settings page for configuring session lengths, alerts, and theme
- **Offscreen** (`src/app/offscreen/`) - Hidden document for playing audio alerts (MV3 workaround for audio in service workers)
- **Background** (`src/scripts/background/index.ts`) - Service worker managing timer state, alarms, and notifications
- **Content** (`src/scripts/content/index.ts`) - Content script (minimal, runs on all pages)

### State Management

All timer state flows through the background service worker:

1. **Storage**: State and settings are persisted in `chrome.storage.local` under keys `pomodoroState` and `pomodoroSettings`
2. **Alarms**: Chrome alarms API handles timer expiration (`pomodoro-end`) and badge updates (`pomodoro-tick`)
3. **Messaging**: Popup/options communicate with background via `chrome.runtime.sendMessage` using typed messages like `POMODORO_START`, `POMODORO_PAUSE`, `POMODORO_GET_STATE`

### Key Types (src/shared/utils/pomodoro.ts)

- `PomodoroState` - Current timer status (idle/running/paused), phase (focus/break), remaining time
- `PomodoroSettings` - User preferences (durations, auto-switch, notifications, sound settings, badge)
- `PomodoroRuntimeMessage` - Union type for all background worker messages

### Build Pipeline

A custom Vite plugin (`vite-plugin-chrome-extension.ts`) relocates HTML files from nested `src/app/*/index.html` paths to `dist/*.html` (e.g., `dist/popup.html`) so they match manifest expectations. The manifest itself is copied separately via `copy-manifest` script.

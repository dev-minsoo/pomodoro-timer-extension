# Pomodoro Timer Extension (Chrome MV3)

A Pomodoro timer Chrome extension built with React, TypeScript, and Vite.  
The main goal is to provide a **reliable timer that continues when the popup closes**, with full session flow support (notifications, sound, and badge updates).

## What This Repository Contains

- MV3 service-worker-centric timer state management
- Separate Popup and Options UIs
- Session completion handling using `chrome.alarms`, `chrome.notifications`, and `chrome.offscreen`
- State/settings recovery with `chrome.storage.local`

## Core Features

- Session types: Focus / Break / Long Break
- Controls: Start / Pause / Reset / Skip
- Auto switch option to start the next session automatically
- Options page:
  - Focus/break/long-break duration, long-break interval, long-break enable toggle
  - Notification toggle + preview
  - Sound toggle + sound type + repeat count + preview
  - Badge countdown toggle
  - Popup display mode (Text/Ring), Compact mode
  - Theme (Light/Dark)
- Popup UI:
  - Text timer or ring-progress timer
  - Current status/session display
  - Progress-until-long-break indicator

## Runtime Architecture

```txt
Popup UI  ─┐
           ├─ runtime message ─> Background Service Worker
Options UI ─┘                         ├─ chrome.storage.local (state/settings)
                                      ├─ chrome.alarms (end/tick)
                                      ├─ chrome.notifications
                                      ├─ chrome.action badge
                                      └─ Offscreen Document (audio playback)
```

### Component Responsibilities

- `src/scripts/background/index.ts`
  - Single source of truth for timer state
  - Session transition rules (including long breaks), alarm scheduling, notification/sound trigger, badge updates
- `src/app/popup/Popup.tsx`
  - Timer rendering and controls
  - 1-second local countdown + 5-second state synchronization
- `src/app/options/Options.tsx`
  - Settings edit and save
  - Notification/sound preview requests
- `src/app/offscreen/main.ts`
  - AudioContext-based sound playback (MV3 offscreen workaround)

## Data Model

- `pomodoroState`
  - `status`, `phase`, `remainingMs`, `endTime`, `completedFocusSessions`, `totalCycles`
- `pomodoroSettings`
  - Session durations, auto-switch, notification/sound, badge, UI display options

## Message Contracts (Main)

- Popup/Options -> Background
  - `POMODORO_GET_STATE`
  - `POMODORO_START`
  - `POMODORO_PAUSE`
  - `POMODORO_RESET`
  - `POMODORO_SKIP`
  - `POMODORO_SETTINGS_UPDATED`
  - `POMODORO_PREVIEW_SOUND`
  - `POMODORO_PREVIEW_NOTIFICATION`
- Background -> Offscreen
  - `POMODORO_PLAY_SOUND`

## Chrome Permissions Used

- `storage`: store state/settings
- `alarms`: session-end and periodic tick handling
- `notifications`: session completion alerts
- `offscreen`: background audio playback
- `tabs`, `host_permissions(<all_urls>)`, `content_scripts`
  - Currently includes baseline content-script messaging; not central to Pomodoro logic

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

- Build output: `dist/`

## Load Unpacked Extension

1. `npm run build`
2. Go to `chrome://extensions`
3. Enable Developer mode
4. Click Load unpacked
5. Select the `dist/` folder

## Project Structure

```txt
manifest.json
src/
  app/
    popup/       # Popup UI
    options/     # Settings UI
    offscreen/   # Audio playback runtime
  scripts/
    background/  # MV3 service worker (timer state machine)
    content/     # Minimal content script
  shared/
    utils/       # Types and shared helpers
```

import type { PomodoroPhase, PomodoroRuntimeMessage, PomodoroSettings, PomodoroSoundType, PomodoroState, PomodoroStatePayload } from "../../shared/utils/pomodoro";

type RuntimeMessage =
  | PomodoroRuntimeMessage
  | { type: "PING" }
  | { type: "CONTENT_SCRIPT_READY"; url: string }
  | { type: "POMODORO_SETTINGS_UPDATED" }
  | { type: "POMODORO_PLAY_SOUND"; soundType: PomodoroSoundType; repeatCount: number }
  | { type: "POMODORO_PREVIEW_SOUND"; soundType: PomodoroSoundType; repeatCount: number }
  | { type: "POMODORO_PREVIEW_NOTIFICATION" };

const EXTENSION_NAME = "React Chrome Extension Boilerplate";
const STORAGE_KEYS = {
  state: "pomodoroState",
  settings: "pomodoroSettings",
};

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  autoSwitch: true,
  notificationsEnabled: true,
  soundEnabled: false,
  soundType: "beep",
  soundRepeatCount: 1,
  openOptionsOnComplete: false,
  badgeEnabled: true,
};

const END_ALARM_NAME = "pomodoro-end";
const TICK_ALARM_NAME = "pomodoro-tick";
const LONG_BREAK_INTERVAL = 4;

function ensureActionOpensPopup() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error: unknown) => {
      console.warn("Failed to set side panel behavior", error);
    });
}

function getPhaseDurationMs(settings: PomodoroSettings, phase: PomodoroPhase) {
  if (phase === "focus") {
    return settings.focusMinutes * 60 * 1000;
  }

  if (phase === "longBreak") {
    return settings.longBreakMinutes * 60 * 1000;
  }

  return settings.breakMinutes * 60 * 1000;
}

function getDefaultState(settings: PomodoroSettings): PomodoroState {
  return {
    status: "idle",
    phase: "focus",
    remainingMs: getPhaseDurationMs(settings, "focus"),
    completedFocusSessions: 0,
  };
}

function computeRemaining(state: PomodoroState): PomodoroState {
  if (state.status === "running" && typeof state.endTime === "number") {
    const remainingMs = Math.max(0, state.endTime - Date.now());
    return { ...state, remainingMs };
  }

  return state;
}

async function loadStateAndSettings(): Promise<PomodoroStatePayload> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.state,
    STORAGE_KEYS.settings,
  ]);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEYS.settings] as Partial<PomodoroSettings> | undefined),
  };
  const storedState = stored[STORAGE_KEYS.state] as PomodoroState | undefined;
  const state = storedState
    ? {
        ...storedState,
        completedFocusSessions: storedState.completedFocusSessions ?? 0,
      }
    : getDefaultState(settings);

  return {
    state: computeRemaining(state),
    settings,
  };
}

async function saveStateAndSettings(payload: PomodoroStatePayload) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.state]: payload.state,
    [STORAGE_KEYS.settings]: payload.settings,
  });
}

async function clearAlarms() {
  await chrome.alarms.clear(END_ALARM_NAME);
  await chrome.alarms.clear(TICK_ALARM_NAME);
}

async function scheduleAlarms(endTime: number) {
  await chrome.alarms.create(END_ALARM_NAME, { when: endTime });
  await chrome.alarms.create(TICK_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 1,
  });
}

async function updateBadge(state: PomodoroState, settings: PomodoroSettings = DEFAULT_SETTINGS) {
  if (!settings.badgeEnabled) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  if (state.status !== "running") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMinutes = Math.max(1, Math.ceil(state.remainingMs / 60000));
  const text = `${remainingMinutes}`;
  await chrome.action.setBadgeText({ text: text.slice(0, 4) });
  await chrome.action.setBadgeBackgroundColor({
    color: state.phase === "focus" ? "#EF4444" : "#10B981",
  });
}


async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    return;
  }

  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play pomodoro alert sound",
  });
}

async function showPhaseCompleteNotification(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
  { forceNotify = false } = {}
) {
  if (settings.soundEnabled) {
    try {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        type: "POMODORO_PLAY_SOUND",
        soundType: settings.soundType,
        repeatCount: settings.soundRepeatCount,
      });
    } catch (error) {
      console.warn("Failed to play sound", error);
    }
  }

  if (settings.openOptionsOnComplete) {
    chrome.runtime.openOptionsPage();
  }

  if (!settings.notificationsEnabled && !forceNotify) {
    return;
  }

  const title =
    phase === "focus"
      ? "Focus complete"
      : phase === "longBreak"
        ? "Long break complete"
        : "Break complete";
  const message = phase === "focus" ? "Time to take a break." : "Time to focus again.";
  const notificationId = await chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
  });

  setTimeout(() => {
    void chrome.notifications.clear(notificationId);
  }, 3000);
}

function getNextPhaseAndCount(
  phase: PomodoroPhase,
  completedFocusSessions: number,
  { countCompleted }: { countCompleted: boolean }
) {
  if (phase === "focus") {
    const nextCount = countCompleted
      ? Math.min(LONG_BREAK_INTERVAL, completedFocusSessions + 1)
      : completedFocusSessions;
    const nextPhase = nextCount >= LONG_BREAK_INTERVAL ? "longBreak" : "break";
    return { nextPhase, nextCompletedFocusSessions: nextCount };
  }

  if (phase === "longBreak") {
    return { nextPhase: "focus", nextCompletedFocusSessions: 0 };
  }

  return { nextPhase: "focus", nextCompletedFocusSessions: completedFocusSessions };
}

async function handlePhaseComplete(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = computeRemaining(payload.state);

  if (currentState.status !== "running") {
    await updateBadge(currentState, payload.settings);
    return { ...payload, state: currentState };
  }

  await showPhaseCompleteNotification(currentState.phase, payload.settings);

  const { nextPhase, nextCompletedFocusSessions } = getNextPhaseAndCount(
    currentState.phase,
    currentState.completedFocusSessions,
    { countCompleted: true }
  );

  if (!payload.settings.autoSwitch) {
    const nextState: PomodoroState = {
      status: "idle",
      phase: nextPhase,
      remainingMs: getPhaseDurationMs(payload.settings, nextPhase),
      completedFocusSessions: nextCompletedFocusSessions,
    };

    await clearAlarms();
    await saveStateAndSettings({ ...payload, state: nextState });
    await updateBadge(nextState, payload.settings);

    return { ...payload, state: nextState };
  }

  const remainingMs = getPhaseDurationMs(payload.settings, nextPhase);
  const endTime = Date.now() + remainingMs;
  const nextState: PomodoroState = {
    status: "running",
    phase: nextPhase,
    remainingMs,
    endTime,
    completedFocusSessions: nextCompletedFocusSessions,
  };

  await saveStateAndSettings({ ...payload, state: nextState });
  await scheduleAlarms(endTime);
  await updateBadge(nextState, payload.settings);

  return { ...payload, state: nextState };
}

async function startPomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = payload.state;
  if (currentState.status === "running" && currentState.endTime) {
    await updateBadge(currentState, payload.settings);
    return payload;
  }

  const remainingMs =
    currentState.status === "paused"
      ? currentState.remainingMs
      : getPhaseDurationMs(payload.settings, currentState.phase);
  const endTime = Date.now() + remainingMs;
  const nextState: PomodoroState = {
    status: "running",
    phase: currentState.phase,
    remainingMs,
    endTime,
    completedFocusSessions: currentState.completedFocusSessions,
  };

  await saveStateAndSettings({ ...payload, state: nextState });
  await scheduleAlarms(endTime);
  await updateBadge(nextState, payload.settings);

  return { ...payload, state: nextState };
}

async function pausePomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = computeRemaining(payload.state);

  if (currentState.status !== "running") {
    await updateBadge(currentState, payload.settings);
    return { ...payload, state: currentState };
  }

  const nextState: PomodoroState = {
    ...currentState,
    status: "paused",
    endTime: undefined,
  };

  await clearAlarms();
  await saveStateAndSettings({ ...payload, state: nextState });
  await updateBadge(nextState, payload.settings);

  return { ...payload, state: nextState };
}

async function resetPomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const nextState = getDefaultState(payload.settings);

  await clearAlarms();
  await saveStateAndSettings({ ...payload, state: nextState });
  await updateBadge(nextState, payload.settings);

  return { ...payload, state: nextState };
}

async function getPomodoroState(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const computedState = computeRemaining(payload.state);

  if (
    computedState.status === "running" &&
    typeof computedState.endTime === "number" &&
    computedState.endTime <= Date.now()
  ) {
    return handlePhaseComplete();
  }

  await updateBadge(computedState, payload.settings);
  return { ...payload, state: computedState };
}

async function initializePomodoro() {
  const payload = await loadStateAndSettings();
  const state = computeRemaining(payload.state);

  if (state.status === "running" && typeof state.endTime === "number") {
    if (state.endTime <= Date.now()) {
      await handlePhaseComplete();
      return;
    }

    await scheduleAlarms(state.endTime);
  }

  await updateBadge(state, payload.settings);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log(`[${EXTENSION_NAME}] installed`);
  ensureActionOpensPopup();
  void initializePomodoro();
});

chrome.runtime.onStartup.addListener(() => {
  ensureActionOpensPopup();
  void initializePomodoro();
});

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === END_ALARM_NAME) {
    void handlePhaseComplete();
    return;
  }

  if (alarm.name === TICK_ALARM_NAME) {
    void getPomodoroState();
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: PomodoroStatePayload | { type: "PONG"; timestamp: number }) => void
  ) => {
    if (message?.type === "PING") {
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return false;
    }

    if (message?.type === "POMODORO_GET_STATE") {
      void getPomodoroState().then(sendResponse);
      return true;
    }

    if (message?.type === "POMODORO_START") {
      void startPomodoro().then(sendResponse);
      return true;
    }

    if (message?.type === "POMODORO_PAUSE") {
      void pausePomodoro().then(sendResponse);
      return true;
    }

    if (message?.type === "POMODORO_RESET") {
      void resetPomodoro().then(sendResponse);
      return true;
    }

    if (message?.type === "POMODORO_SETTINGS_UPDATED") {
      void loadStateAndSettings().then(({ state, settings }) => {
        void updateBadge(state, settings);
      });
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return false;
    }

    if (message?.type === "POMODORO_PREVIEW_SOUND") {
      void (async () => {
        try {
          await ensureOffscreenDocument();
          await chrome.runtime.sendMessage({
            type: "POMODORO_PLAY_SOUND",
            soundType: message.soundType,
            repeatCount: message.repeatCount,
          });
        } catch (error) {
          console.warn("Failed to preview sound", error);
        }
      })();
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return false;
    }

    if (message?.type === "POMODORO_PREVIEW_NOTIFICATION") {
      void (async () => {
        try {
          const payload = await loadStateAndSettings();
          const phase = payload.state.phase;
          const title =
            phase === "focus"
              ? "Focus complete"
              : phase === "longBreak"
                ? "Long break complete"
                : "Break complete";
          const body = phase === "focus" ? "Time to take a break." : "Time to focus again.";
          const notificationId = await chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon-128.png",
            title,
            message: body,
          });
          setTimeout(() => {
            void chrome.notifications.clear(notificationId);
          }, 3000);
        } catch (error) {
          console.warn("Failed to preview notification", error);
        }
      })();
      sendResponse({ type: "PONG", timestamp: Date.now() });
      return false;
    }

    return false;
  }
);

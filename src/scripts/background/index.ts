import type { PomodoroPhase, PomodoroRuntimeMessage, PomodoroSettings, PomodoroState, PomodoroStatePayload } from "../../shared/utils/pomodoro";

type RuntimeMessage =
  | PomodoroRuntimeMessage
  | { type: "PING" }
  | { type: "CONTENT_SCRIPT_READY"; url: string };

const EXTENSION_NAME = "React Chrome Extension Boilerplate";
const STORAGE_KEYS = {
  state: "pomodoroState",
  settings: "pomodoroSettings",
};

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  autoSwitch: true,
};

const END_ALARM_NAME = "pomodoro-end";
const TICK_ALARM_NAME = "pomodoro-tick";

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
  return (phase === "focus" ? settings.focusMinutes : settings.breakMinutes) * 60 * 1000;
}

function getDefaultState(settings: PomodoroSettings): PomodoroState {
  return {
    status: "idle",
    phase: "focus",
    remainingMs: getPhaseDurationMs(settings, "focus"),
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
  const settings = (stored[STORAGE_KEYS.settings] as PomodoroSettings) ||
    DEFAULT_SETTINGS;
  const storedState = stored[STORAGE_KEYS.state] as PomodoroState | undefined;
  const state = storedState || getDefaultState(settings);

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

async function updateBadge(state: PomodoroState) {
  if (state.status !== "running") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const remainingMinutes = Math.max(1, Math.ceil(state.remainingMs / 60000));
  const text = state.phase === "break" ? `B${remainingMinutes}` : `${remainingMinutes}`;
  await chrome.action.setBadgeText({ text: text.slice(0, 4) });
  await chrome.action.setBadgeBackgroundColor({
    color: state.phase === "break" ? "#10B981" : "#EF4444",
  });
}

async function showPhaseCompleteNotification(phase: PomodoroPhase) {
  const title = phase === "focus" ? "집중 종료" : "휴식 종료";
  const message = phase === "focus" ? "휴식 시간을 시작할게요." : "다시 집중할 시간이에요.";
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "vite.svg",
    title,
    message,
  });
}

function getNextPhase(phase: PomodoroPhase): PomodoroPhase {
  return phase === "focus" ? "break" : "focus";
}

async function handlePhaseComplete(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = computeRemaining(payload.state);

  if (currentState.status !== "running") {
    await updateBadge(currentState);
    return { ...payload, state: currentState };
  }

  await showPhaseCompleteNotification(currentState.phase);

  if (!payload.settings.autoSwitch) {
    const nextPhase = getNextPhase(currentState.phase);
    const nextState: PomodoroState = {
      status: "idle",
      phase: nextPhase,
      remainingMs: getPhaseDurationMs(payload.settings, nextPhase),
    };

    await clearAlarms();
    await saveStateAndSettings({ ...payload, state: nextState });
    await updateBadge(nextState);
    return { ...payload, state: nextState };
  }

  const nextPhase = getNextPhase(currentState.phase);
  const remainingMs = getPhaseDurationMs(payload.settings, nextPhase);
  const endTime = Date.now() + remainingMs;
  const nextState: PomodoroState = {
    status: "running",
    phase: nextPhase,
    remainingMs,
    endTime,
  };

  await saveStateAndSettings({ ...payload, state: nextState });
  await scheduleAlarms(endTime);
  await updateBadge(nextState);

  return { ...payload, state: nextState };
}

async function startPomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = payload.state;
  if (currentState.status === "running" && currentState.endTime) {
    await updateBadge(currentState);
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
  };

  await saveStateAndSettings({ ...payload, state: nextState });
  await scheduleAlarms(endTime);
  await updateBadge(nextState);

  return { ...payload, state: nextState };
}

async function pausePomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const currentState = computeRemaining(payload.state);

  if (currentState.status !== "running") {
    await updateBadge(currentState);
    return { ...payload, state: currentState };
  }

  const nextState: PomodoroState = {
    ...currentState,
    status: "paused",
    endTime: undefined,
  };

  await clearAlarms();
  await saveStateAndSettings({ ...payload, state: nextState });
  await updateBadge(nextState);

  return { ...payload, state: nextState };
}

async function resetPomodoro(): Promise<PomodoroStatePayload> {
  const payload = await loadStateAndSettings();
  const nextState = getDefaultState(payload.settings);

  await clearAlarms();
  await saveStateAndSettings({ ...payload, state: nextState });
  await updateBadge(nextState);

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

  await updateBadge(computedState);
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

  await updateBadge(state);
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

    return false;
  }
);

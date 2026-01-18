import { useEffect, useMemo, useState } from "react";
import type {
  PomodoroRuntimeMessage,
  PomodoroSettings,
  PomodoroState,
  PomodoroStatePayload,
  PomodoroTheme,
} from "../../shared/utils/pomodoro";

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  autoSwitch: true,
};

const THEME_STORAGE_KEY = "pomodoroTheme";

async function openSidePanel() {
  if (!chrome.sidePanel?.open) {
    return;
  }

  const currentWindow = await chrome.windows.getCurrent();

  if (typeof currentWindow.id !== "number") {
    return;
  }

  await chrome.sidePanel.open({ windowId: currentWindow.id });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function isPomodoroTheme(value: unknown): value is PomodoroTheme {
  return value === "light" || value === "dark";
}

async function loadTheme(): Promise<PomodoroTheme> {
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const theme = stored[THEME_STORAGE_KEY];
  return isPomodoroTheme(theme) ? theme : "light";
}

async function saveTheme(theme: PomodoroTheme) {
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
}

async function sendPomodoroMessage(message: PomodoroRuntimeMessage) {
  return chrome.runtime.sendMessage(message) as Promise<PomodoroStatePayload>;
}

function computeRemaining(state: PomodoroState, now: number) {
  if (state.status === "running" && typeof state.endTime === "number") {
    return Math.max(0, state.endTime - now);
  }

  return state.remainingMs;
}

function formatRemaining(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function usePomodoroState() {
  const [payload, setPayload] = useState<PomodoroStatePayload | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let isActive = true;
    void sendPomodoroMessage({ type: "POMODORO_GET_STATE" }).then((data) => {
      if (isActive) {
        setPayload(data);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void sendPomodoroMessage({ type: "POMODORO_GET_STATE" }).then(setPayload);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const state = payload?.state ?? {
    status: "idle",
    phase: "focus",
    remainingMs: DEFAULT_SETTINGS.focusMinutes * 60 * 1000,
  };
  const remainingMs = computeRemaining(state, now);

  const display = useMemo(() => formatRemaining(remainingMs), [remainingMs]);

  const start = async () => {
    const data = await sendPomodoroMessage({ type: "POMODORO_START" });
    setPayload(data);
  };

  const pause = async () => {
    const data = await sendPomodoroMessage({ type: "POMODORO_PAUSE" });
    setPayload(data);
  };

  const reset = async () => {
    const data = await sendPomodoroMessage({ type: "POMODORO_RESET" });
    setPayload(data);
  };

  return {
    state,
    remainingMs,
    display,
    start,
    pause,
    reset,
  };
}

function useTheme() {
  const [theme, setTheme] = useState<PomodoroTheme>("light");

  useEffect(() => {
    let isActive = true;
    void loadTheme().then((storedTheme) => {
      if (!isActive) {
        return;
      }
      setTheme(storedTheme);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = async () => {
    const nextTheme: PomodoroTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    await saveTheme(nextTheme);
  };

  return { theme, toggleTheme };
}

export default function Popup() {
  const { state, display, start, pause, reset } = usePomodoroState();
  const { theme, toggleTheme } = useTheme();
  const isRunning = state.status === "running";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-[400px] max-w-[420px] px-5 py-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pomodoro
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {state.phase === "focus" ? "Focus" : "Break"} Session
            </h1>
          </div>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            onClick={toggleTheme}
            type="button"
          >
            Theme: {theme}
          </button>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span>Status</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
              {state.status}
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-4xl font-semibold tabular-nums text-slate-900">
              {display}
            </span>
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              {state.phase}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={isRunning ? pause : start}
              type="button"
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={reset}
              type="button"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick Actions
          </h2>
          <div className="mt-3 grid gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={openSidePanel}
              type="button"
            >
              Open Side Panel
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={openOptions}
              type="button"
            >
              Open Options
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

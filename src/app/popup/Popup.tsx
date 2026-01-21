import { useEffect, useMemo, useState } from "react";
import type {
  PomodoroRuntimeMessage,
  PomodoroState,
  PomodoroStatePayload,
  PomodoroTheme,
} from "../../shared/utils/pomodoro";

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const DEFAULT_LONG_BREAK_MINUTES = 15;

const THEME_STORAGE_KEY = "pomodoroTheme";


function isPomodoroTheme(value: unknown): value is PomodoroTheme {
  return value === "light" || value === "dark";
}

async function loadTheme(): Promise<PomodoroTheme> {
  try {
    const localTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isPomodoroTheme(localTheme)) {
      return localTheme;
    }
  } catch (error) {
    console.warn("Failed to read local theme", error);
  }

  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const theme = stored[THEME_STORAGE_KEY];
  if (isPomodoroTheme(theme)) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Failed to cache theme locally", error);
    }
    return theme;
  }

  return "light";
}

async function saveTheme(theme: PomodoroTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn("Failed to cache theme locally", error);
  }

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
    remainingMs: DEFAULT_FOCUS_MINUTES * 60 * 1000,
    completedFocusSessions: 0,
    totalCycles: 0,
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

  const skip = async () => {
    const data = await sendPomodoroMessage({ type: "POMODORO_SKIP" });
    setPayload(data);
  };

  return {
    state,
    settings: payload?.settings ?? null,
    remainingMs,
    display,
    start,
    pause,
    reset,
    skip,
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
  const { state, settings, remainingMs, display, start, pause, reset, skip } =
    usePomodoroState();
  useTheme();
  const isRunning = state.status === "running";
  const isCompact = settings?.compactMode ?? false;
  const timerDisplayMode = settings?.timerDisplayMode ?? "text";
  const longBreakEnabled = settings?.longBreakEnabled ?? true;
  const isTightSpacing = !longBreakEnabled && timerDisplayMode === "text";
  const rawLongBreakInterval = settings?.longBreakInterval ?? 4;
  const longBreakInterval = rawLongBreakInterval > 0 ? rawLongBreakInterval : 1;
  const cycleProgress = Math.min(
    state.completedFocusSessions,
    longBreakInterval,
  );
  const cyclePercent = (cycleProgress / longBreakInterval) * 100;
  const focusMs = (settings?.focusMinutes ?? DEFAULT_FOCUS_MINUTES) * 60 * 1000;
  const breakMs =
    (settings?.breakMinutes ?? DEFAULT_BREAK_MINUTES) * 60 * 1000;
  const longBreakMs =
    (settings?.longBreakMinutes ?? DEFAULT_LONG_BREAK_MINUTES) * 60 * 1000;
  const totalMs =
    state.phase === "focus" ? focusMs : state.phase === "longBreak" ? longBreakMs : breakMs;
  const ringProgress = totalMs > 0 ? (totalMs - remainingMs) / totalMs : 0;
  const ringRadius = 70;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - Math.min(1, Math.max(0, ringProgress)));
  const phaseToneClass =
    state.phase === "focus"
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";
  const ringStrokeClass =
    state.phase === "focus"
      ? "stroke-red-500 dark:stroke-red-400"
      : "stroke-green-500 dark:stroke-green-400";
  const phaseLabel =
    state.phase === "focus"
      ? "Focus"
      : state.phase === "longBreak"
        ? "Long Break"
        : "Break";

  return (
    <div
      className={`${isTightSpacing ? "min-h-0" : "min-h-screen"} bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100`}
    >
      <div
        className={`mx-auto ${
          isCompact
            ? `w-[320px] max-w-[340px] px-4 ${isTightSpacing ? "py-3" : "py-4"}`
            : `w-[400px] max-w-[420px] px-5 ${isTightSpacing ? "py-5" : "py-6"}`
        }`}
      >
        <header
          className={`flex items-center justify-between gap-3 ${
            isCompact ? "mb-4" : "mb-5"
          }`}
        >
          <div>
            <p className="text-base font-semibold uppercase leading-none tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Pomodoro
            </p>
          </div>
          <button
            aria-label="Open settings"
            className={`rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100 ${
              isCompact ? "p-1.5" : "p-2"
            }`}
            onClick={() => chrome.runtime.openOptionsPage()}
            type="button"
          >
            <svg
              aria-hidden="true"
              className={isCompact ? "h-4 w-4" : "h-5 w-5"}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.73v.5a2 2 0 0 1-1 1.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.73v-.5a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </header>

        <section
          className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
            isCompact ? "p-3" : "p-4"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <span>Status</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                ({state.totalCycles ?? 0} Pomodoros)
              </span>
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {state.status}
            </span>
          </div>
          {timerDisplayMode === "ring" ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div
                className={`relative flex items-center justify-center ${
                  isCompact ? "h-36 w-36" : "h-48 w-48"
                }`}
              >
                <svg className="h-full w-full" viewBox="0 0 160 160">
                  <circle
                    className="stroke-slate-200 dark:stroke-slate-700"
                    cx="80"
                    cy="80"
                    fill="none"
                    r={ringRadius}
                    strokeWidth="10"
                  />
                  <circle
                    className={`transition-[stroke-dashoffset] duration-500 ${ringStrokeClass}`}
                    cx="80"
                    cy="80"
                    fill="none"
                    r={ringRadius}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    strokeWidth="10"
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <span
                  className={`absolute text-center font-semibold tabular-nums text-slate-900 dark:text-slate-100 ${
                    isCompact ? "text-2xl" : "text-3xl"
                  }`}
                >
                  {display}
                </span>
              </div>
              <span
                className={`text-sm font-medium uppercase tracking-[0.2em] ${phaseToneClass}`}
              >
                {phaseLabel}
              </span>
            </div>
          ) : (
            <div className="mt-4 flex items-baseline justify-between">
              <span
                className={`font-semibold tabular-nums text-slate-900 dark:text-slate-100 ${
                  isCompact ? "text-3xl" : "text-4xl"
                }`}
              >
                {display}
              </span>
              <span
                className={`text-sm font-medium uppercase tracking-[0.2em] ${phaseToneClass}`}
              >
                {phaseLabel}
              </span>
            </div>
          )}
          {longBreakEnabled && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Until long break</span>
                <span className="text-slate-700 dark:text-slate-100">
                  {cycleProgress}/{longBreakInterval}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-300 dark:bg-red-400"
                  style={{ width: `${cyclePercent}%` }}
                />
              </div>
            </div>
          )}
          <div
            className={`grid grid-cols-3 gap-2 ${
              isTightSpacing ? "mt-3" : "mt-4"
            }`}
          >
            <button
              className={`rounded-md bg-slate-900 px-3 py-2 font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${
                isCompact ? "text-xs" : "text-sm"
              }`}
              onClick={isRunning ? pause : start}
              type="button"
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              className={`rounded-md border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950 dark:text-red-200 dark:hover:border-red-400 dark:hover:bg-red-900/60 ${
                isCompact ? "text-xs" : "text-sm"
              }`}
              onClick={skip}
              type="button"
            >
              Skip
            </button>
            <button
              className={`rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
                isCompact ? "text-xs" : "text-sm"
              }`}
              onClick={reset}
              type="button"
            >
              Reset
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

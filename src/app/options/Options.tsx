import { useEffect, useMemo, useState } from "react";
import type { PomodoroSettings, PomodoroTheme } from "../../shared/utils/pomodoro";

const SETTINGS_STORAGE_KEY = "pomodoroSettings";
const THEME_STORAGE_KEY = "pomodoroTheme";

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoSwitch: true,
  notificationsEnabled: true,
  soundEnabled: false,
  soundType: "beep",
  soundRepeatCount: 1,
  openOptionsOnComplete: false,
  badgeEnabled: true,
  compactMode: false,
  timerDisplayMode: "text",
};

function isPomodoroTheme(value: unknown): value is PomodoroTheme {
  return value === "light" || value === "dark";
}

export default function Options() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<PomodoroTheme>("light");
  const [draftTheme, setDraftTheme] = useState<PomodoroTheme>("light");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadSettings = async () => {
      const stored = await chrome.storage.local.get([
        SETTINGS_STORAGE_KEY,
        THEME_STORAGE_KEY,
      ]);
      if (!isActive) {
        return;
      }

          const storedSettings = stored[SETTINGS_STORAGE_KEY] as
        | PomodoroSettings
        | undefined;
      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(storedSettings ?? {}),
      };
      setSettings(nextSettings);

      const storedTheme = stored[THEME_STORAGE_KEY];
      const nextTheme = isPomodoroTheme(storedTheme) ? storedTheme : "light";
      setTheme(nextTheme);
      setDraftTheme(nextTheme);

    };

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!savedAt) {
      return;
    }

    setShowToast(true);
    const timeout = window.setTimeout(() => {
      setShowToast(false);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [savedAt]);

  const saveSettings = async (nextSettings: PomodoroSettings) => {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: nextSettings });
  };

  const saveTheme = async (nextTheme: PomodoroTheme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.warn("Failed to cache theme locally", error);
    }

    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextTheme });
  };

  const updateSettings = (patch: Partial<PomodoroSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleNumberChange = (
    key: "focusMinutes" | "breakMinutes" | "longBreakMinutes" | "longBreakInterval",
    value: string,
  ) => {
    const parsed = Number.parseInt(value, 10);
    updateSettings({ [key]: Number.isNaN(parsed) ? 0 : parsed });
  };

  const handleRepeatCountChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const clamped = Number.isNaN(parsed)
      ? 1
      : Math.min(5, Math.max(1, parsed));
    updateSettings({ soundRepeatCount: clamped });
  };

  const handleSave = async () => {
    await saveSettings(settings);
    await saveTheme(draftTheme);
    setTheme(draftTheme);
    setSavedAt(Date.now());
    await chrome.runtime.sendMessage({ type: "POMODORO_SETTINGS_UPDATED" });
  };

  const handleSoundPreview = async (soundType: PomodoroSettings["soundType"]) => {
    await chrome.runtime.sendMessage({
      type: "POMODORO_PREVIEW_SOUND",
      soundType,
      repeatCount: settings.soundRepeatCount ?? 1,
    });
  };

  const handleNotificationPreview = async () => {
    await chrome.runtime.sendMessage({ type: "POMODORO_PREVIEW_NOTIFICATION" });
  };

  const toastLabel = useMemo(() => {
    if (!savedAt) {
      return "";
    }
    return "Settings saved";
  }, [savedAt]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Pomodoro
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Customize your focus cadence and notifications.
          </p>
        </header>

        <section className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-6">
            <div>
              <h2 className="text-base font-semibold">Session Lengths</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Set your default focus and break durations.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Focus minutes
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    min={1}
                    type="number"
                    value={settings.focusMinutes}
                    onChange={(event) =>
                      handleNumberChange("focusMinutes", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Break minutes
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    min={1}
                    type="number"
                    value={settings.breakMinutes}
                    onChange={(event) =>
                      handleNumberChange("breakMinutes", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Long break minutes
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    min={1}
                    type="number"
                    value={settings.longBreakMinutes}
                    onChange={(event) =>
                      handleNumberChange("longBreakMinutes", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Long break interval
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    min={1}
                    type="number"
                    value={settings.longBreakInterval}
                    onChange={(event) =>
                      handleNumberChange("longBreakInterval", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Automation</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Decide when the timer should advance on its own.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                <span>
                  <span className="block font-medium">Auto switch sessions</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Automatically start the next focus or break.
                  </span>
                </span>
                <input
                  checked={settings.autoSwitch}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  type="checkbox"
                  onChange={(event) =>
                    updateSettings({ autoSwitch: event.target.checked })
                  }
                />
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Alerts</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Keep your notifications and completion cues aligned.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-medium">Notifications</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Alert when a session ends.
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                      type="button"
                      onClick={handleNotificationPreview}
                    >
                      Preview
                    </button>
                    <input
                      checked={settings.notificationsEnabled}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      type="checkbox"
                      onChange={(event) =>
                        updateSettings({
                          notificationsEnabled: event.target.checked,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-medium">Sound alert</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Play a tone when a timer completes.
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      value={settings.soundType ?? "beep"}
                      onChange={(event) =>
                        updateSettings({
                          soundType: event.target
                            .value as PomodoroSettings["soundType"],
                        })
                      }
                    >
                      <option value="beep">Beep</option>
                      <option value="bell">Bell</option>
                      <option value="chime">Chime</option>
                      <option value="soft">Soft</option>
                      <option value="tick">Tick</option>
                    </select>
                    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Repeat
                      <input
                        className="w-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        max={5}
                        min={1}
                        type="number"
                        value={settings.soundRepeatCount ?? 1}
                        onChange={(event) =>
                          handleRepeatCountChange(event.target.value)
                        }
                      />
                    </label>
                    <button
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                      type="button"
                      onClick={() =>
                        handleSoundPreview(settings.soundType ?? "beep")
                      }
                    >
                      Preview
                    </button>
                    <input
                      checked={settings.soundEnabled ?? false}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      type="checkbox"
                      onChange={(event) =>
                        updateSettings({ soundEnabled: event.target.checked })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-medium">Open options on completion</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Jump here when a focus or break ends.
                    </span>
                  </span>
                  <input
                    checked={settings.openOptionsOnComplete ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    type="checkbox"
                    onChange={(event) =>
                      updateSettings({
                        openOptionsOnComplete: event.target.checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Badge</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Keep the countdown subtle in your toolbar.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-medium">Show badge countdown</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Show remaining time on the extension badge.
                    </span>
                  </span>
                  <input
                    checked={settings.badgeEnabled}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    type="checkbox"
                    onChange={(event) =>
                      updateSettings({ badgeEnabled: event.target.checked })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Interface</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Adjust the popup layout and timer presentation.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span>
                    <span className="block font-medium">Compact mode</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Shrink padding and type for tighter windows.
                    </span>
                  </span>
                  <input
                    checked={settings.compactMode ?? false}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    type="checkbox"
                    onChange={(event) =>
                      updateSettings({ compactMode: event.target.checked })
                    }
                  />
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <span className="block font-medium">Timer display</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Choose between the classic timer or the focus ring.
                  </span>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        checked={settings.timerDisplayMode === "text"}
                        className="h-4 w-4 rounded-full border-slate-300 text-slate-900 focus:ring-slate-500"
                        name="timerDisplayMode"
                        type="radio"
                        onChange={() =>
                          updateSettings({ timerDisplayMode: "text" })
                        }
                      />
                      Text
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        checked={settings.timerDisplayMode === "ring"}
                        className="h-4 w-4 rounded-full border-slate-300 text-slate-900 focus:ring-slate-500"
                        name="timerDisplayMode"
                        type="radio"
                        onChange={() =>
                          updateSettings({ timerDisplayMode: "ring" })
                        }
                      />
                      Ring
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Theme</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Choose the look that matches your workspace.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={draftTheme === "light"}
                    className="h-4 w-4 rounded-full border-slate-300 text-slate-900 focus:ring-slate-500"
                    name="theme"
                    type="radio"
                    onChange={() => {
                      if (draftTheme !== "light") {
                        setDraftTheme("light");
                      }
                    }}
                  />
                  Light
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={draftTheme === "dark"}
                    className="h-4 w-4 rounded-full border-slate-300 text-slate-900 focus:ring-slate-500"
                    name="theme"
                    type="radio"
                    onChange={() => {
                      if (draftTheme !== "dark") {
                        setDraftTheme("dark");
                      }
                    }}
                  />
                  Dark
                </label>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Changes apply after saving.
            </p>
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              type="button"
              onClick={handleSave}
            >
              Save Settings
            </button>
          </div>
          <div
            className={`pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500/95 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 backdrop-blur transition-opacity transition-transform duration-300 ${
              showToast
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0"
            }`}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M3.5 8.5L6.7 11.6L12.5 4.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            <span>{toastLabel}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

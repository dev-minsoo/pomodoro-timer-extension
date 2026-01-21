export type PomodoroPhase = "focus" | "break" | "longBreak";
export type PomodoroStatus = "idle" | "running" | "paused";
export type PomodoroTheme = "light" | "dark";

export type PomodoroSoundType = "beep" | "bell" | "chime" | "soft" | "tick";
export type PomodoroTimerDisplayMode = "text" | "ring";

export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoSwitch: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  soundType: PomodoroSoundType;
  soundRepeatCount: number;
  openOptionsOnComplete: boolean;
  badgeEnabled: boolean;
  compactMode: boolean;
  timerDisplayMode: PomodoroTimerDisplayMode;
}

export interface PomodoroState {
  status: PomodoroStatus;
  phase: PomodoroPhase;
  remainingMs: number;
  endTime?: number;
  completedFocusSessions: number;
  totalCycles: number;
}

export interface PomodoroStatePayload {
  state: PomodoroState;
  settings: PomodoroSettings;
}

export type PomodoroRuntimeMessage =
  | { type: "POMODORO_GET_STATE" }
  | { type: "POMODORO_START" }
  | { type: "POMODORO_PAUSE" }
  | { type: "POMODORO_RESET" }
  | { type: "POMODORO_SKIP" };

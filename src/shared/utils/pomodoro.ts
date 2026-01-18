export type PomodoroPhase = "focus" | "break";
export type PomodoroStatus = "idle" | "running" | "paused";
export type PomodoroTheme = "light" | "dark";

export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  autoSwitch: boolean;
}

export interface PomodoroState {
  status: PomodoroStatus;
  phase: PomodoroPhase;
  remainingMs: number;
  endTime?: number;
}

export interface PomodoroStatePayload {
  state: PomodoroState;
  settings: PomodoroSettings;
}

export type PomodoroRuntimeMessage =
  | { type: "POMODORO_GET_STATE" }
  | { type: "POMODORO_START" }
  | { type: "POMODORO_PAUSE" }
  | { type: "POMODORO_RESET" };

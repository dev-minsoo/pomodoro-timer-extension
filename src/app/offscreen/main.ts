type SoundType = "beep" | "bell" | "chime" | "soft" | "tick";

type SoundMessage = {
  type?: string;
  soundType?: SoundType;
  repeatCount?: number;
};

type ToneConfig = {
  type: OscillatorType;
  frequency: number;
  gain: number;
  duration: number;
};

function getToneConfig(soundType: SoundType): ToneConfig {
  switch (soundType) {
    case "bell":
      return { type: "triangle", frequency: 880, gain: 0.25, duration: 0.4 };
    case "chime":
      return { type: "sine", frequency: 740, gain: 0.18, duration: 0.5 };
    case "soft":
      return { type: "sine", frequency: 520, gain: 0.12, duration: 0.3 };
    case "tick":
      return { type: "square", frequency: 1200, gain: 0.08, duration: 0.08 };
    case "beep":
    default:
      return { type: "sine", frequency: 660, gain: 0.2, duration: 0.2 };
  }
}

function playTone(soundType: SoundType) {
  const { type, frequency, gain, duration } = getToneConfig(soundType);
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gain;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);

  oscillator.onended = () => {
    void context.close();
  };

  return duration * 1000;
}

async function playToneRepeated(soundType: SoundType, repeatCount: number) {
  const count = Math.max(1, Math.min(5, Math.floor(repeatCount)));
  const gapMs = 120;

  for (let index = 0; index < count; index += 1) {
    const durationMs = playTone(soundType);
    await new Promise((resolve) => setTimeout(resolve, durationMs + gapMs));
  }
}

chrome.runtime.onMessage.addListener((message: SoundMessage) => {
  if (message?.type === "POMODORO_PLAY_SOUND") {
    void playToneRepeated(message.soundType ?? "beep", message.repeatCount ?? 1);
  }
});

"use client";

// A short, soft two-note chime for new orders (Web Audio; no sound file needed).
// Browsers only allow sound after the user has clicked something on the page,
// which the "Sound on" toggle provides.
let context: AudioContext | null = null;

export async function playChime() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
    const start = context.currentTime;
    for (const [i, frequency] of [880, 1318.5].entries()) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const t = start + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(context.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    }
  } catch {
    // Sound is optional; ignore devices that block it.
  }
}

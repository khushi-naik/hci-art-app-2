"use client";
import { useEffect, useRef, useState } from "react";
export function ComfortControls() {
  const [audio, setAudio] = useState(false),
    [volume, setVolume] = useState(0.15),
    [reduce, setReduce] = useState(false),
    [error, setError] = useState("");
  const sound = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    nodes: OscillatorNode[];
  } | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("stillcanvas:motion");
    const reduced = stored
      ? stored === "true"
      : matchMedia("(prefers-reduced-motion: reduce)").matches;
    queueMicrotask(() => setReduce(reduced));
    document.documentElement.dataset.reduce = String(reduced);
    return () => {
      delete document.documentElement.dataset.reduce;
    };
  }, []);
  useEffect(() => {
    const change = () => {
      if (sound.current) {
        if (document.hidden) void sound.current.ctx.suspend();
        else if (audio) void sound.current.ctx.resume();
      }
    };
    document.addEventListener("visibilitychange", change);
    return () => {
      document.removeEventListener("visibilitychange", change);
    };
  }, [audio]);
  useEffect(
    () => () => {
      void sound.current?.ctx.close();
    },
    [],
  );
  async function toggle() {
    try {
      if (audio) {
        await sound.current?.ctx.suspend();
        setAudio(false);
        return;
      }
      if (!sound.current) {
        const ctx = new AudioContext(),
          gain = ctx.createGain();
        gain.gain.value = volume * 0.1;
        gain.connect(ctx.destination);
        const nodes = [130.81, 196, 261.63].map((frequency) => {
          const oscillator = ctx.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          oscillator.start();
          return oscillator;
        });
        sound.current = { ctx, gain, nodes };
      }
      await sound.current.ctx.resume();
      setAudio(true);
      setError("");
    } catch {
      setError("Ambient sound is unavailable in this browser.");
    }
  }
  return (
    <div className="comfort">
      <button
        className="secondary small-button"
        onClick={toggle}
        aria-pressed={audio}
      >
        {audio ? "♫ Sound on" : "♫ Sound off"}
      </button>
      <label className="volume">
        Volume
        <input
          type="range"
          min="0"
          max=".3"
          step=".01"
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (sound.current)
              sound.current.gain.gain.setTargetAtTime(
                v * 0.1,
                sound.current.ctx.currentTime,
                0.1,
              );
          }}
        />
      </label>
      <label className="motion">
        <input
          type="checkbox"
          checked={reduce}
          onChange={(e) => {
            setReduce(e.target.checked);
            localStorage.setItem(
              "stillcanvas:motion",
              String(e.target.checked),
            );
            document.documentElement.dataset.reduce = String(e.target.checked);
          }}
        />{" "}
        Reduce motion
      </label>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
export default function Calm({
  title,
  description,
  preparing = false,
}: {
  title: string;
  description: string;
  preparing?: boolean;
}) {
  return (
    <section className="calm-stage panel">
      <div className="eyebrow">
        {preparing ? "A MOMENT BETWEEN TURNS" : "A LITTLE SPACE TO BREATHE"}
      </div>
      <div className="breathing-art" aria-hidden="true">
        <div className="breath-ring ring-a" />
        <div className="breath-ring ring-b" />
        <div className="breath-core">✧</div>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="breath-instructions">
        If you’d like, inhale for 4 seconds. Exhale for 6.
        <br />
        Or simply rest here. There’s nothing you need to do.
      </p>
      <p className="privacy-note">
        ♧ The canvas stays private until your turn.
      </p>
    </section>
  );
}

"use client";
import type { Settings } from "@/lib/shared/model";
const rules = [
  ["Create or join a room", "Invite up to four friends (five players total)."],
  [
    "Get inspired",
    "Everyone receives the same random creative prompt when the game starts.",
  ],
  [
    "Take turns drawing",
    "Each player draws for the host-selected 2–5 minutes per turn.",
  ],
  [
    "Relax while waiting",
    "Waiting players see guided breathing and can opt into calming ambient sounds.",
  ],
  [
    "Keep the surprise",
    "Only the active artist sees the evolving canvas. The next artist sees prior contributions when their own turn begins.",
  ],
  [
    "Create together",
    "Continue the artwork through the host-selected number of rounds.",
  ],
  [
    "Enjoy the final reveal",
    "Everyone sees the finished piece and can download it as a PNG.",
  ],
];
export default function Rules({ settings }: { settings: Settings }) {
  return (
    <details className="rules panel" open>
      <summary>
        <span>✧ How to Play</span>
        <span className="small">
          {settings.rounds} {settings.rounds === 1 ? "round" : "rounds"} ·{" "}
          {settings.minutes} minutes per turn
        </span>
      </summary>
      <ol>
        {rules.map(([title, text]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="rules-ending">
        There’s no winning or losing. Just create, relax, and enjoy the
        unexpected!
      </p>
    </details>
  );
}

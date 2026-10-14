"use client";
import Modal from "@/components/Modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStudio } from "@/lib/client";
import { BRAND } from "@/lib/shared/model";
export default function Home() {
  const router = useRouter();
  const { enter, connected, error, setError } = useStudio();
  const [mode, setMode] = useState<"create" | "join" | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const seat = await enter(
        mode!,
        String(f.get("name")),
        String(f.get("code") || "")
          .trim()
          .toUpperCase(),
      );
      router.push(`/room/${seat.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="site">
      <header className="header">
        <Link className="brand" href="/">
          <span className="brand-mark">✳</span>
          {BRAND}
          <span className="brand-dot">.</span>
        </Link>
        <span className="header-note">A little creativity. A little calm.</span>
        <a className="text-link" href="#how">
          How it works ↗
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✧</span> MAKE SOMETHING, TOGETHER
            </div>
            <h1>
              A shared canvas.
              <br />A quiet mind.
              <br />
              <em>A little surprise.</em>
            </h1>
            <p className="lead">
              Gather your favorite people for a gentle drawing ritual. Take a
              turn, take a breath, and see what unfolds.
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                disabled={!connected}
                onClick={() => {
                  setMode("create");
                  setError("");
                }}
              >
                Create a room <span>↗</span>
              </button>
              <button
                className="secondary"
                disabled={!connected}
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
              >
                Join a room
              </button>
            </div>
            <p className="small reassurance">
              <span>♧</span> 2–5 friends <span>·</span> No accounts{" "}
              <span>·</span> No pressure
            </p>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of a tranquil imaginary garden"
          >
            <div className="art-note note-top">a little of you…</div>
            <div className="art-paper">
              <svg
                viewBox="0 0 600 490"
                role="img"
                aria-label="Soft hills, a sun, and playful botanical shapes"
              >
                <rect width="600" height="490" fill="#faf8ef" />
                <circle cx="455" cy="107" r="48" fill="#eac3a4" />
                <path
                  d="M0 330 Q130 175 290 337 T600 304 V490 H0Z"
                  fill="#c6d1b4"
                />
                <path
                  d="M0 401 Q187 280 355 395 T600 350 V490 H0Z"
                  fill="#98b59a"
                />
                <path
                  d="M266 490 Q170 390 310 361 T371 290"
                  fill="none"
                  stroke="#eee1bd"
                  strokeWidth="30"
                />
                <path
                  d="M125 367 Q117 280 160 213 M137 300 Q80 255 85 229 M145 270 Q201 252 192 220"
                  fill="none"
                  stroke="#607d69"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <ellipse
                  cx="166"
                  cy="212"
                  rx="18"
                  ry="33"
                  transform="rotate(22 166 212)"
                  fill="#7e9a7b"
                />
                <ellipse
                  cx="86"
                  cy="234"
                  rx="17"
                  ry="28"
                  transform="rotate(-35 86 234)"
                  fill="#7e9a7b"
                />
                <ellipse
                  cx="191"
                  cy="234"
                  rx="16"
                  ry="26"
                  transform="rotate(36 191 234)"
                  fill="#7e9a7b"
                />
                <path
                  d="M471 409 V311 M470 355 L439 338 M472 372 L503 345"
                  stroke="#6b846b"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <g fill="#d5aab6">
                  <ellipse cx="470" cy="302" rx="14" ry="29" />
                  <ellipse
                    cx="470"
                    cy="302"
                    rx="14"
                    ry="29"
                    transform="rotate(60 470 302)"
                  />
                  <ellipse
                    cx="470"
                    cy="302"
                    rx="14"
                    ry="29"
                    transform="rotate(120 470 302)"
                  />
                </g>
                <circle cx="470" cy="302" r="10" fill="#eadeb7" />
                <path
                  d="M47 133 Q67 112 87 133 M304 109 Q320 92 338 109"
                  stroke="#9caa91"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <g fill="#f2e7c5">
                  <circle cx="68" cy="417" r="5" />
                  <circle cx="88" cy="400" r="5" />
                  <circle cx="554" cy="411" r="5" />
                </g>
              </svg>
            </div>
            <div className="art-note note-bottom">…a little of everyone.</div>
            <div className="art-label">
              <span className="avatar peach">M</span>
              <span className="avatar sage">J</span>
              <span className="avatar lavender">A</span>
              <span>One canvas. Many imaginations.</span>
            </div>
            <span className="sparkle sparkle-one">✧</span>
            <span className="sparkle sparkle-two">✳</span>
          </div>
        </section>
        <section className="how-section" id="how">
          <div className="section-heading">
            <span className="eyebrow">THE ART OF TAKING IT SLOW</span>
            <h2>A lovely kind of together.</h2>
          </div>
          <div className="steps">
            <article>
              <span className="step-icon sage">↗</span>
              <span className="step-number">01 / GATHER</span>
              <h3>Make a little space</h3>
              <p>
                Create a private room and invite up to four friends. A shared
                prompt is your starting spark.
              </p>
            </article>
            <article>
              <span className="step-icon lavender">〰</span>
              <span className="step-number">02 / CREATE & REST</span>
              <h3>Your turn. Your touch.</h3>
              <p>
                Add to the canvas when it’s your turn. In between, breathe
                gently. The artwork stays a surprise.
              </p>
            </article>
            <article>
              <span className="step-icon peach">✧</span>
              <span className="step-number">03 / DISCOVER</span>
              <h3>Something only you could make</h3>
              <p>
                Reveal your collective creation together and keep a little piece
                of the moment as a PNG.
              </p>
            </article>
          </div>
        </section>
        <div className="gentle-banner">
          <span>✳</span>
          <p>
            No winning. No losing. <em>Just a little room to play.</em>
          </p>
        </div>
      </main>
      <footer>
        <Link className="brand" href="/">
          {BRAND}.
        </Link>
        <span>Made for moments, not masterpieces.</span>
        <span>A self-guided creative experience</span>
      </footer>
      {mode && (
        <Modal onClose={() => setMode(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-title"
          >
            <button
              className="close"
              aria-label="Close"
              onClick={() => setMode(null)}
            >
              ×
            </button>
            <span className="eyebrow">YOUR LITTLE CREATIVE GATHERING</span>
            <h2 id="entry-title">
              {mode === "create" ? "Make room for wonder." : "Come on in."}
            </h2>
            <p>
              {mode === "create"
                ? "Choose a name your friends will recognize."
                : "Bring your invite code and a little imagination."}
            </p>
            <form onSubmit={submit}>
              <label>
                Your display name
                <input
                  name="name"
                  placeholder="e.g. Alex"
                  minLength={2}
                  maxLength={24}
                  required
                  autoFocus
                />
              </label>
              {mode === "join" && (
                <label>
                  Room code
                  <input
                    name="code"
                    placeholder="8-letter invite code"
                    minLength={8}
                    maxLength={8}
                    required
                    className="code-input"
                  />
                </label>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary full" disabled={busy || !connected}>
                {busy
                  ? "Opening the door…"
                  : connected
                    ? mode === "create"
                      ? "Create my room ↗"
                      : "Join this room ↗"
                    : "Connecting…"}
              </button>
            </form>
            <p className="small">
              Private room · No account needed · Audio off by default
            </p>
          </section>
        </Modal>
      )}
    </div>
  );
}

"use client";
import Modal from "@/components/Modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useStudio, key } from "@/lib/client";
import { BRAND, type Requests, type Overlay } from "@/lib/shared/model";
import Rules from "./Rules";
import Calm, { ComfortControls } from "./Calm";
const Canvas = dynamic(() => import("./Canvas"), {
  ssr: false,
  loading: () => <div className="panel loading">Opening your canvas…</div>,
});
export default function Room({ code }: { code: string }) {
  const router = useRouter();
  const studio = useStudio(code),
    { room, seat, canvas, connected, restoring, error, setError, request } =
      studio;
  const [now, setNow] = useState(() => Date.now()),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now() + studio.offset.current),
      250,
    );
    return () => clearInterval(timer);
  }, [studio.offset]);
  async function act<K extends keyof Requests>(event: K, payload: Requests[K]) {
    setBusy(true);
    setError("");
    try {
      await request(event, payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await studio.enter(
        "join",
        String(new FormData(e.currentTarget).get("name")),
        code,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Copy this invite: ${location.origin}/room/${code}`);
    }
  }
  async function leave() {
    await act("room:leave", {});
    localStorage.removeItem(key(code));
    router.push("/");
  }
  const me = room?.players.find((p) => p.id === seat?.playerId),
    host = room?.hostId === seat?.playerId;
  const active = room?.players.find((p) => p.id === room.activePlayerId),
    isArtist = room?.activePlayerId === seat?.playerId;
  const seconds = Math.max(
    0,
    Math.ceil(((room?.phaseEndsAt || now) - now) / 1000),
  );
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  async function save(overlay: Overlay, sequence: number, finish = false) {
    if (!room?.turnId) throw Error("This turn has ended.");
    if (finish)
      await request("turn:finish", { turnId: room.turnId, sequence, overlay });
    else
      await request("canvas:checkpoint", {
        turnId: room.turnId,
        sequence,
        overlay,
      });
  }
  return (
    <div className="site room-site">
      <header className="header">
        <Link className="brand" href="/">
          <span className="brand-mark">✳</span>
          {BRAND}
          <span className="brand-dot">.</span>
        </Link>
        <div className="connection">
          <span className={connected ? "status-dot" : "status-dot offline"} />
          {connected ? "Connected" : "Reconnecting…"}
        </div>
        {seat && (
          <button className="text-button" onClick={leave}>
            Leave room
          </button>
        )}
      </header>
      <main className="room-main">
        {error && (
          <div className="error room-error" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        {restoring ? (
          <div className="panel loading">Finding your place in the studio…</div>
        ) : !seat || !room ? (
          <section className="entry-panel panel">
            <span className="eyebrow">YOU’RE INVITED</span>
            <h1>A place for your imagination.</h1>
            <p>
              Join room <strong>{code}</strong>. Your contribution is a surprise
              until the final reveal.
            </p>
            <form onSubmit={join}>
              <label>
                Your display name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={24}
                  placeholder="e.g. Alex"
                />
              </label>
              <button className="primary" disabled={busy || !connected}>
                {busy ? "Joining…" : "Join this room ↗"}
              </button>
            </form>
            <Link className="text-link" href="/">
              Or create a new room
            </Link>
          </section>
        ) : (
          <>
            <div className="room-heading">
              <div>
                <span className="eyebrow">
                  {room.phase === "LOBBY"
                    ? "YOUR PRIVATE CREATIVE GATHERING"
                    : room.phase === "REVEAL"
                      ? "MADE BY ALL OF YOU"
                      : "CREATE A LITTLE. REST A LITTLE."}
                </span>
                <h1>
                  {room.phase === "LOBBY"
                    ? "Good things start together."
                    : room.phase === "REVEAL"
                      ? "Look what you made."
                      : room.phase === "DRAWING" && isArtist
                        ? "Your turn to add a little wonder."
                        : room.phase === "PREPARING"
                          ? "A breath before the next brushstroke."
                          : room.phase === "PAUSED_RECONNECT"
                            ? "A little pause."
                            : "Let your imagination rest."}
                </h1>
              </div>
              <div className="invite-box">
                <span className="small">ROOM CODE</span>
                <strong>{code}</strong>
                <button className="text-button" onClick={copy}>
                  {copied ? "✓ Invite copied" : "Copy invite ↗"}
                </button>
              </div>
            </div>
            <div className="room-layout">
              <div className="room-content">
                {room.phase === "LOBBY" ? (
                  <>
                    <Rules settings={room.settings} />
                    <section className="prompt panel">
                      <span className="eyebrow">A SHARED STARTING SPARK</span>
                      <h2>“{room.prompt}”</h2>
                      <p className="small">
                        Your server-selected prompt is shared by everyone.
                      </p>
                      {host && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => act("room:regeneratePrompt", {})}
                        >
                          ↻ Try another prompt
                        </button>
                      )}
                    </section>
                    <section className="lobby-bottom panel">
                      <div>
                        <h3>Arrive just as you are.</h3>
                        <p>
                          No drawing experience needed. Mark yourself ready when
                          you’ve read the rules.
                        </p>
                      </div>
                      <button
                        className={me?.ready ? "secondary" : "primary"}
                        disabled={busy || !connected}
                        onClick={() =>
                          act("room:setReady", { ready: !me?.ready })
                        }
                      >
                        {me?.ready ? "✓ Ready · undo" : "I’m ready ✓"}
                      </button>
                    </section>
                  </>
                ) : (
                  <>
                    <section className="prompt game-prompt">
                      <span className="eyebrow">OUR CREATIVE PROMPT</span>
                      <h2>“{room.prompt}”</h2>
                    </section>
                    {room.phase === "REVEAL" ? (
                      <>
                        <p className="appreciation">
                          A little of each of you, something none of you could
                          have imagined alone. Thank you for making space for
                          this moment.
                        </p>
                        {canvas ? (
                          <Canvas
                            key="reveal"
                            snapshot={canvas}
                            readOnly
                            filename={`healing-strokes-${code.toLowerCase()}`}
                          />
                        ) : (
                          <div className="loading panel">
                            Unwrapping your shared artwork…
                          </div>
                        )}
                        <p className="small contributors">
                          Created in turn by{" "}
                          {room.order
                            .map(
                              (id) =>
                                room.players.find((p) => p.id === id)?.name,
                            )
                            .join(" → ")}
                        </p>
                        {host && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => act("room:replay", {})}
                          >
                            Make something new together ↗
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="turn-bar">
                          <span>
                            {room.phase === "PAUSED_RECONNECT"
                              ? `Waiting for ${active?.name} to reconnect`
                              : room.phase === "PREPARING"
                                ? `${active?.name} is up next`
                                : `${active?.name}${isArtist ? " (you)" : ""} is drawing`}
                            <span className="small">
                              Round {room.roundIndex + 1} of{" "}
                              {room.settings.rounds} · Turn {room.turnIndex + 1}{" "}
                              of {room.order.length}
                            </span>
                          </span>
                          <span
                            className="timer"
                            aria-label={`${seconds} seconds ${room.phase === "PAUSED_RECONNECT" ? "to reconnect" : room.phase === "PREPARING" ? "until the next turn" : "remaining"}`}
                          >
                            {clock}
                            <small>
                              {room.phase === "PAUSED_RECONNECT"
                                ? "to reconnect"
                                : room.phase === "PREPARING"
                                  ? "until drawing"
                                  : "remaining"}
                            </small>
                          </span>
                        </div>
                        {isArtist &&
                        (room.phase === "DRAWING" ||
                          room.phase === "PAUSED_RECONNECT") &&
                        canvas ? (
                          <Canvas
                            key={room.turnId}
                            snapshot={canvas}
                            canWrite={
                              connected &&
                              room.phase === "DRAWING" &&
                              seconds > 0
                            }
                            onSave={(o, s) => save(o, s)}
                            onFinish={(o, s) => save(o, s, true)}
                          />
                        ) : room.phase === "DRAWING" && isArtist ? (
                          <div className="panel loading">
                            Your private canvas is opening…
                          </div>
                        ) : (
                          <Calm
                            title={
                              room.phase === "PAUSED_RECONNECT"
                                ? "We’ll hold a little space."
                                : room.phase === "PREPARING"
                                  ? isArtist
                                    ? "Your canvas opens in a moment."
                                    : "The next chapter is almost here."
                                  : "Breathe in. Let it unfold."
                            }
                            description={
                              room.phase === "PAUSED_RECONNECT"
                                ? "The drawing clock is paused for up to 30 seconds. If your friend can’t return, this unfinished turn will be skipped."
                                : room.phase === "PREPARING"
                                  ? "Ten quiet seconds between contributions. The artwork is still a surprise."
                                  : `${active?.name} is adding their own little touch. You’ll see it when your turn begins.`
                            }
                            preparing={room.phase === "PREPARING"}
                          />
                        )}
                      </>
                    )}
                    <ComfortControls />
                    <button
                      className="text-button rules-control"
                      onClick={() => setRulesOpen(true)}
                    >
                      ✧ How to Play
                    </button>
                  </>
                )}
              </div>
              <aside className="sidebar">
                <section className="panel participants">
                  <div className="panel-title">
                    <h3>
                      {room.phase === "LOBBY"
                        ? "Our little circle"
                        : "The creative circle"}
                    </h3>
                    <span className="small">{room.players.length}/5</span>
                  </div>
                  <ul>
                    {(room.order.length
                      ? room.order
                          .map((id) => room.players.find((p) => p.id === id)!)
                          .filter(Boolean)
                      : room.players
                    ).map((p, i) => (
                      <li key={p.id}>
                        <span
                          className={`avatar ${["sage", "lavender", "peach"][i % 3]}`}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {p.name}{" "}
                            {p.id === seat.playerId && <small>(you)</small>}
                          </strong>
                          <span className="small">
                            {p.id === room.hostId ? "Host · " : ""}
                            {!p.connected
                              ? "Away · seat reserved"
                              : room.phase === "LOBBY"
                                ? p.ready
                                  ? "Ready ✓"
                                  : "Settling in"
                                : p.id === room.activePlayerId
                                  ? "Current artist"
                                  : "In the circle"}
                          </span>
                        </div>
                        <span
                          className={`presence ${p.connected ? "" : "offline"}`}
                          aria-label={
                            p.connected ? "Connected" : "Disconnected"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="small">
                    Private invite only. New seats close when the session
                    starts.
                  </p>
                </section>
                {room.phase === "LOBBY" && (
                  <section className="panel settings">
                    <span className="eyebrow">SET YOUR PACE</span>
                    <h3>A gentle rhythm</h3>
                    <label>
                      Rounds
                      <select
                        aria-label="Rounds"
                        value={room.settings.rounds}
                        disabled={!host || busy}
                        onChange={(e) =>
                          act("room:updateSettings", {
                            ...room.settings,
                            rounds: Number(e.target.value),
                          })
                        }
                      >
                        {[1, 2, 3].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "round" : "rounds"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Time per turn
                      <select
                        aria-label="Time per turn"
                        value={room.settings.minutes}
                        disabled={!host || busy}
                        onChange={(e) =>
                          act("room:updateSettings", {
                            ...room.settings,
                            minutes: Number(e.target.value) as 2 | 3 | 4 | 5,
                          })
                        }
                      >
                        {[2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} minutes
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="small">
                      {host
                        ? "You’re the host. Choose a pace that feels good."
                        : "Your host chooses the pace."}
                    </p>
                    <button
                      className="primary full"
                      disabled={
                        !host ||
                        busy ||
                        !connected ||
                        room.players.filter((p) => p.connected).length < 2 ||
                        room.players.some((p) => p.connected && !p.ready)
                      }
                      onClick={() => act("game:start", {})}
                    >
                      Begin together ↗
                    </button>
                    <p className="small start-requirements">
                      At least 2 connected guests, with everyone connected
                      ready.
                    </p>
                  </section>
                )}
                <section className="sidebar-note">
                  <span>✧</span>
                  <p>
                    A moment for connection.
                    <br />A canvas for possibility.
                    <br />
                    <em>Nothing to get right.</em>
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>{BRAND}.</span>
        <span>No winning. No losing. Just create.</span>
        <span>Artwork is held only for this session.</span>
      </footer>
      {rulesOpen && room && (
        <Modal onClose={() => setRulesOpen(false)}>
          <section
            className="modal rules-modal"
            role="dialog"
            aria-modal="true"
            aria-label="How to Play"
          >
            <button
              className="close"
              aria-label="Close rules"
              onClick={() => setRulesOpen(false)}
            >
              ×
            </button>
            <Rules settings={room.settings} />
            <button className="secondary" onClick={() => setRulesOpen(false)}>
              Back to our session
            </button>
          </section>
        </Modal>
      )}
    </div>
  );
}

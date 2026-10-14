"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  Requests,
  Responses,
  ClientEvents,
  ServerEvents,
  PublicRoomState,
  CanvasState,
  Seat,
  Ack,
} from "./shared/model";
export const key = (code: string) => `stillcanvas:seat:${code}`;
export function saveSeat(seat: Seat) {
  localStorage.setItem(key(seat.code), JSON.stringify(seat));
}
export function useStudio(code?: string) {
  const socket = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null),
    [canvas, setCanvas] = useState<CanvasState | null>(null),
    [seat, setSeat] = useState<Seat | null>(null),
    [connected, setConnected] = useState(false),
    [restoring, setRestoring] = useState(!!code),
    [error, setError] = useState("");
  const offset = useRef(0),
    latest = useRef(-1);
  const request = useCallback(
    <K extends keyof Requests>(
      event: K,
      payload: Requests[K],
    ): Promise<Responses[K]> =>
      new Promise((resolve, reject) => {
        const s = socket.current;
        if (!s?.connected) {
          reject(
            Error(
              "Connection is resting. Your drawing stays here while we reconnect.",
            ),
          );
          return;
        }
        const emit = s.timeout(8000).emit.bind(s.timeout(8000)) as (
          event: K,
          payload: Requests[K],
          cb: (e: Error | null, a: Ack<Responses[K]>) => void,
        ) => void;
        emit(event, payload, (e, a) => {
          if (e) {
            reject(
              Error(
                "The server did not respond. We will reconnect and restore your latest saved drawing.",
              ),
            );
            return;
          }
          if (!a.ok) {
            reject(Error(a.error));
            return;
          }
          offset.current = a.serverNow - Date.now();
          resolve(a.data);
        });
      }),
    [],
  );
  useEffect(() => {
    const s = io({ autoConnect: false, reconnection: true });
    socket.current = s;
    latest.current = -1;
    s.on("room:publicState", (r) => {
      if (code && r.code !== code) return;
      if (r.revision < latest.current) return;
      latest.current = r.revision;
      offset.current = r.serverNow - Date.now();
      setRoom(r);
      if (r.phase !== "DRAWING" && r.phase !== "REVEAL") setCanvas(null);
    });
    s.on("canvas:authorizedSnapshot", (c) => {
      if ((!code || c.code === code) && c.revision >= latest.current)
        setCanvas(c);
    });
    s.on("room:expired", () => {
      setRoom(null);
      setCanvas(null);
      setError(
        "This room has gently closed. Create a fresh room to begin again.",
      );
      if (code) localStorage.removeItem(key(code));
    });
    s.on("room:revoked", () => {
      setError(
        "Your seat was opened in another window. Continue there, or reload this window to reclaim it.",
      );
      setConnected(false);
      setCanvas(null);
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () =>
      setError("We cannot reach the studio yet. Reconnecting…"),
    );
    s.on("connect", async () => {
      setConnected(true);
      setError("");
      if (!code) return;
      let stored: Seat | null = null;
      try {
        stored = JSON.parse(localStorage.getItem(key(code)) || "null");
      } catch {
        /* A corrupted saved seat falls back to the join form. */
      }
      if (stored) {
        try {
          const restored = await request("room:resume", stored);
          setSeat(restored);
        } catch (e) {
          setError((e as Error).message);
          localStorage.removeItem(key(code));
          setSeat(null);
        }
      }
      setRestoring(false);
    });
    s.connect();
    return () => {
      s.disconnect();
      socket.current = null;
    };
  }, [code, request]);
  async function enter(
    mode: "create" | "join",
    name: string,
    joinCode?: string,
  ) {
    const next =
      mode === "create"
        ? await request("room:create", { name })
        : await request("room:join", { name, code: joinCode || code || "" });
    saveSeat(next);
    setSeat(next);
    return next;
  }
  return {
    room,
    canvas,
    seat,
    connected,
    restoring,
    error,
    setError,
    request,
    enter,
    offset,
  };
}

import { z } from "zod";
export const BRAND = "Healing Strokes";
export const WIDTH = 1200,
  HEIGHT = 800;
export const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .refine(
    (s) => !/[\p{Cc}\p{Cf}]/u.test(s),
    "Please use a simple display name.",
  );
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/);
export const settingsSchema = z
  .object({
    rounds: z.number().int().min(1).max(3),
    minutes: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  })
  .strict();
const coord = z.number().finite().min(0).max(WIDTH);
export const objectSchema = z
  .object({
    type: z.enum(["brush", "eraser", "line", "rect", "ellipse"]),
    points: z
      .array(coord)
      .min(4)
      .max(4000)
      .refine(
        (p) =>
          p.length % 2 === 0 && p.every((v, i) => i % 2 === 0 || v <= HEIGHT),
        "Invalid coordinates",
      ),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    width: z.number().finite().min(1).max(64),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (!["brush", "eraser"].includes(s.type) && s.points.length !== 4)
      ctx.addIssue({ code: "custom", message: "Shapes need two points" });
  });
export const overlaySchema = z
  .array(objectSchema)
  .max(400)
  .refine(
    (objects) => objects.reduce((n, o) => n + o.points.length, 0) <= 40000,
    "Too many points",
  );
export const writeSchema = z
  .object({
    turnId: z.string().uuid(),
    sequence: z.number().int().min(0).max(1e9),
    overlay: overlaySchema,
  })
  .strict();
export type Mark = z.infer<typeof objectSchema>;
export type Overlay = Mark[];
export type Settings = z.infer<typeof settingsSchema>;
export type Phase =
  "LOBBY" | "DRAWING" | "PREPARING" | "PAUSED_RECONNECT" | "REVEAL";
export interface PublicRoomState {
  code: string;
  hostId: string;
  players: { id: string; name: string; connected: boolean; ready: boolean }[];
  settings: Settings;
  phase: Phase;
  prompt: string;
  order: string[];
  roundIndex: number;
  turnIndex: number;
  activePlayerId: string | null;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  revision: number;
  turnId: string | null;
  serverNow: number;
}
export interface CanvasState {
  code: string;
  turnId: string | null;
  layers: Overlay[];
  overlay: Overlay;
  sequence: number;
  revision: number;
}
export type Seat = { code: string; playerId: string; token: string };
export type Ack<T = undefined> =
  { ok: true; data: T; serverNow: number } | { ok: false; error: string };
export interface Requests {
  "room:create": { name: string };
  "room:join": { name: string; code: string };
  "room:resume": Seat;
  "room:leave": Record<string, never>;
  "room:setReady": { ready: boolean };
  "room:updateSettings": Settings;
  "game:start": Record<string, never>;
  "room:regeneratePrompt": Record<string, never>;
  "canvas:checkpoint": z.infer<typeof writeSchema>;
  "turn:finish": z.infer<typeof writeSchema>;
  "canvas:requestAuthorized": Record<string, never>;
  "room:requestState": Record<string, never>;
  "room:replay": Record<string, never>;
}
export interface Responses {
  "room:create": Seat;
  "room:join": Seat;
  "room:resume": Seat;
  "room:leave": undefined;
  "room:setReady": undefined;
  "room:updateSettings": undefined;
  "game:start": undefined;
  "room:regeneratePrompt": undefined;
  "canvas:checkpoint": { sequence: number };
  "turn:finish": undefined;
  "canvas:requestAuthorized": CanvasState;
  "room:requestState": PublicRoomState;
  "room:replay": undefined;
}
export type ClientEvents = {
  [K in keyof Requests]: (
    payload: Requests[K],
    ack: (result: Ack<Responses[K]>) => void,
  ) => void;
};
export interface ServerEvents {
  "room:publicState": (state: PublicRoomState) => void;
  "canvas:authorizedSnapshot": (state: CanvasState) => void;
  "room:expired": () => void;
  "room:revoked": () => void;
}

import type { Overlay, Phase, Settings } from "../lib/shared/model";
export interface Player {
  id: string;
  name: string;
  tokenHash: Buffer;
  socketId: string | null;
  ready: boolean;
}
export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  phase: Phase;
  prompt: string;
  order: string[];
  slot: number;
  activePlayerId: string | null;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  remaining: number;
  revision: number;
  turnId: string | null;
  layers: Overlay[];
  checkpoint: Overlay;
  sequence: number;
  touchedAt: number;
  emptySince: number | null;
}
export interface RoomRepository {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  values(): Iterable<Room>;
  size: number;
}
export class MemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, Room>();
  get size() {
    return this.rooms.size;
  }
  get(code: string) {
    return this.rooms.get(code);
  }
  set(room: Room) {
    this.rooms.set(room.code, room);
  }
  delete(code: string) {
    this.rooms.delete(code);
  }
  values() {
    return this.rooms.values();
  }
}

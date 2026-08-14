import type { ClientRealtimeEvent } from "@/lib/realtime";

let socket: WebSocket | null = null;

export function setRealtimeSocket(next: WebSocket | null): void {
  socket = next;
}

export function sendRealtimeEvent(event: ClientRealtimeEvent): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(event));
  return true;
}

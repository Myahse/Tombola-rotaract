export type RealtimeRole = "public" | "organizer" | "monitor" | "candidate";

export type ScratchedTicket = {
  ticketNumber: number;
  buyerName: string;
  scratchedAt: string;
  prizeRank: number | null;
  prizeNameFr: string | null;
  prizeNameEn: string | null;
};

export type RealtimeMessage =
  | { type: "hello"; role: RealtimeRole }
  | { type: "public.snapshot"; event: unknown }
  | { type: "organizer.changed"; reason: "order" | "event" | "draw" | "scratch" }
  | { type: "ticket.scratched"; ticket: ScratchedTicket }
  | { type: "draw.done" }
  | { type: "qcm.changed"; reason: "start" | "answer" | "complete" | "exam" }
  | { type: "qcm.call.peers"; monitorIds: string[] }
  | { type: "qcm.call.ready"; monitorId?: string }
  | { type: "qcm.call.denied" }
  | { type: "qcm.call.offer"; to: string; sdp: string; from?: string; name?: string; memberId?: string }
  | { type: "qcm.call.answer"; to: string; sdp: string; from?: string }
  | { type: "qcm.call.ice"; to: string; candidate: string; from?: string }
  | { type: "qcm.call.hangup"; from?: string; to?: string };

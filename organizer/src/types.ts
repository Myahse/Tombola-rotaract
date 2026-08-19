export type EventStatus = "draft" | "on_sale" | "closed" | "drawn";
export type DrawMode = "scratch" | "roulette";
export type OrderStatus = "reserved" | "paid" | "cancelled";
export type PaymentMethod = "cash" | "wave";

export type Prize = {
  id?: string;
  rank: number;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
};

export type PublicEvent = {
  id: string;
  slug: string;
  status: EventStatus;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  paymentInstructionsFr: string;
  paymentInstructionsEn: string;
  ticketPriceCents: number;
  currency: string;
  totalTickets: number;
  remainingTickets: number;
  paidTickets: number;
  reservedTickets: number;
  drawMode?: DrawMode;
  prizes: Prize[];
};

export type OrderTicket = {
  number: number;
  prizeId: string | null;
  prizeRank: number | null;
  prizeNameFr: string | null;
  prizeNameEn: string | null;
  scratchedAt?: string | null;
};

export type OrderView = {
  token: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  status: OrderStatus;
  ticketPriceCents: number;
  currency: string;
  eventStatus?: EventStatus;
  drawMode?: DrawMode;
  titleFr?: string;
  titleEn?: string;
  paymentInstructionsFr: string;
  paymentInstructionsEn: string;
  numbers?: number[];
  tickets?: OrderTicket[];
};

export type Winner = {
  rank: number;
  prizeNameFr: string;
  prizeNameEn: string;
  ticketNumber: number;
  buyerName: string;
  buyerEmail?: string;
  avatarUrl?: string | null;
};

export type Contestant = {
  ticketNumber: number;
  buyerName: string;
  avatarUrl?: string | null;
};

export type ScratchedTicket = {
  ticketNumber: number;
  buyerName: string;
  scratchedAt: string;
  prizeRank: number | null;
  prizeNameFr: string | null;
  prizeNameEn: string | null;
};

export type AdminStats = {
  paidOrders: number;
  reservedOrders: number;
  paidTickets: number;
  reservedTickets: number;
  remainingTickets: number;
  scratchedTickets?: number;
  prizeCount?: number;
  prizesSealed?: boolean;
};

export type AdminEvent = {
  id: string;
  status: EventStatus;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  paymentInstructionsFr: string;
  paymentInstructionsEn: string;
  ticketPriceCents: number;
  currency: string;
  totalTickets: number;
  drawMode?: DrawMode;
};

export type AdminOrder = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  quantity: number;
  paymentMethod?: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  numbers: number[];
};

import { sendPushToOrganizers } from "./push.js";

function paymentLabel(method: string) {
  if (method === "wave") return "Wave";
  if (method === "cash") return "Espèces";
  return method;
}

function ticketWord(count: number) {
  return count > 1 ? "tickets" : "ticket";
}

export function notifyOrganizerNewOrder(buyerName: string, quantity: number, paymentMethod: string) {
  void sendPushToOrganizers({
    title: "Nouvelle commande",
    body: `${buyerName} · ${quantity} ${ticketWord(quantity)} · ${paymentLabel(paymentMethod)}`,
    url: "/fr/buyers",
  });
}

export function notifyOrganizerReceipt(buyerName: string, kind: "order" | "donation") {
  void sendPushToOrganizers({
    title: kind === "order" ? "Reçu de paiement reçu" : "Reçu de don reçu",
    body: buyerName,
    url: kind === "order" ? "/fr/buyers" : "/fr/donations",
  });
}

export function notifyOrganizerOrderCancelled(buyerName: string, quantity: number) {
  void sendPushToOrganizers({
    title: "Réservation annulée",
    body: `${buyerName} · ${quantity} ${ticketWord(quantity)}`,
    url: "/fr/buyers",
  });
}

export function notifyOrganizerDonation(donorName: string, amountCents: number) {
  const amount = Math.round(amountCents / 100);
  void sendPushToOrganizers({
    title: "Nouveau don",
    body: `${donorName} · ${amount.toLocaleString("fr-FR")} FCFA`,
    url: "/fr/donations",
  });
}

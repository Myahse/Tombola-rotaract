export function formatMoney(amount: number, currency = "XOF") {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${new Intl.NumberFormat("fr-FR").format(safe)} ${currency}`;
}

export function ticketWord(count: number) {
  return count === 1 ? "ticket" : "tickets";
}

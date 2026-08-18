import "dotenv/config";
import { db } from "./db/index.js";
import { events, prizes } from "./db/schema.js";

async function seed() {
  const existing = await db.select({ id: events.id }).from(events).limit(1);
  if (existing.length) {
    console.log("Database already has a tombola. Skipping seed.");
    process.exit(0);
  }

  const [event] = await db
    .insert(events)
    .values({
      slug: "tombola-club-2026",
      titleFr: "Tombola du club 2026",
      titleEn: "Club tombola 2026",
      descriptionFr:
        "Achetez vos tickets en ligne. Une fois tous les tickets vendus, nous tirons au sort : le premier ticket tiré gagne le 1er lot, et ainsi de suite.",
      descriptionEn:
        "Buy your tickets online. Once they are all sold, we draw at random: the first ticket drawn wins 1st prize, and so on.",
      ticketPriceCents: 1000,
      currency: "XOF",
      totalTickets: 50,
      status: "on_sale",
      paymentInstructionsFr:
        "Payez au bar du club (espèces ou carte) ou par virement. Donnez votre nom : un organisateur marquera vos tickets comme payés. Seuls les tickets payés participent au tirage.",
      paymentInstructionsEn:
        "Pay at the club bar (cash or card) or by bank transfer. Give your name: an organizer will mark your tickets as paid. Only paid tickets enter the draw.",
    })
    .returning();

  if (!event) throw new Error("Could not create sample tombola");

  await db.insert(prizes).values([
    { eventId: event.id, rank: 1, nameFr: "Panier gourmand", nameEn: "Gourmet hamper", descriptionFr: "1er lot", descriptionEn: "1st prize" },
    { eventId: event.id, rank: 2, nameFr: "Bouteille de vin", nameEn: "Bottle of wine", descriptionFr: "2e lot", descriptionEn: "2nd prize" },
    { eventId: event.id, rank: 3, nameFr: "Boîte de chocolats", nameEn: "Box of chocolates", descriptionFr: "3e lot", descriptionEn: "3rd prize" },
    { eventId: event.id, rank: 4, nameFr: "Places de cinéma", nameEn: "Cinema tickets", descriptionFr: "4e lot", descriptionEn: "4th prize" },
    { eventId: event.id, rank: 5, nameFr: "Bon d'achat 5 000 F", nameEn: "5,000 F gift voucher", descriptionFr: "5e lot", descriptionEn: "5th prize" },
  ]);

  console.log("Sample tombola created: Club tombola 2026 (50 tickets, on sale).");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

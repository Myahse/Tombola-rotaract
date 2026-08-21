import { emailEnglishBlock, escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

export type ResultsPrize = {
  rank: number;
  prizeNameFr: string;
  prizeNameEn: string;
  ticketNumber: number;
  buyerName: string;
};

export type DrawResultsEmail = {
  name: string;
  email: string;
  eventTitleFr: string;
  eventTitleEn: string;
  ticketsUrl: string;
  prizes: ResultsPrize[];
  wins: ResultsPrize[];
  drawMode?: "scratch" | "roulette";
};

export function drawResultsEmail(data: DrawResultsEmail) {
  const name = firstName(data.name);
  const buyUrl = siteUrl("/fr/buy");
  const resultsUrl = siteUrl("/fr/results");
  const donateUrl = siteUrl("/fr/donate");

  if (data.drawMode === "scratch") {
    const html = wrapEmail({
      preheader: `${name}, la tombola ${data.eventTitleFr} est close. Grattez vos tickets.`,
      heading: `${name}, la tombola est close`,
      ctaLabel: "Gratter mes tickets",
      ctaUrl: data.ticketsUrl,
      bodyHtml: `
        <p style="margin:0 0 14px;color:#141416;">La tombola <strong>${escapeHtml(data.eventTitleFr)}</strong> est close. Les lots sont déjà assignés à des numéros. Grattez vos tickets pour voir le résultat.</p>
        <p style="margin:0 0 14px;color:#141416;"><a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Prochaine tombola →</a></p>
        ${emailEnglishBlock(
          `${name}, the ${data.eventTitleEn} tombola is closed. Scratch your tickets online to see if you won.`,
        )}
      `,
    });
    return {
      subject: `${name}, grattez vos tickets · ${data.eventTitleFr}`,
      html,
      text: [
        `${name}, la tombola est close.`,
        `${data.eventTitleFr} : les lots sont assignés. Grattez vos tickets pour voir le résultat.`,
        `Vos tickets : ${data.ticketsUrl}`,
        `ENGLISH : ${name}, the ${data.eventTitleEn} tombola is closed. Scratch your tickets online to see if you won.`,
      ].join("\n"),
      params: {
        name,
        eventTitleFr: data.eventTitleFr,
        eventTitleEn: data.eventTitleEn,
        ticketsUrl: data.ticketsUrl,
        resultsUrl,
        buyUrl,
        donateUrl,
        logoUrl: siteUrl("/logo.png"),
        logoDarkUrl: siteUrl("/logo-white.png"),
      },
    };
  }

  const won = data.wins.length > 0;
  const yourWins = data.wins
    .map((prize) => `${prize.rank}. ${prize.prizeNameFr} (ticket n°${prize.ticketNumber})`)
    .join(" · ");

  const rows = data.prizes
    .map((prize, index) => {
      const yours = data.wins.some(
        (win) => win.rank === prize.rank && win.ticketNumber === prize.ticketNumber,
      );
      const last = index === data.prizes.length - 1;
      const bg = yours ? "#faf0f4" : "#ffffff";
      const border = last ? "0" : "1px solid #ececee";
      const you = yours
        ? `<p style="margin:4px 0 0;font-size:12px;font-weight:650;color:#be034d;">Votre lot</p>`
        : "";
      return `<tr>
        <td style="padding:12px 16px;border-bottom:${border};background:${bg};">
          <p style="margin:0 0 2px;font-size:12px;font-weight:650;letter-spacing:0.04em;text-transform:uppercase;color:#a1a1a8;">Lot ${prize.rank}</p>
          <p style="margin:0;font-size:16px;font-weight:650;color:#141416;">${escapeHtml(prize.prizeNameFr)}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#73737a;">${escapeHtml(prize.buyerName)} · ticket n°${prize.ticketNumber}</p>
          ${you}
        </td>
      </tr>`;
    })
    .join("");

  const intro = won
    ? `Le tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong> est passé.`
    : `Le tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong> est passé. Voici le palmarès.`;

  const personal = won
    ? `<p style="margin:0 0 16px;color:#141416;">Vous avez gagné : <strong>${escapeHtml(yourWins)}</strong>. Passez au club pour récupérer votre lot.</p>`
    : `<p style="margin:0 0 16px;color:#141416;">Pas de lot pour vos numéros cette fois.</p>`;

  const englishSummary = won
    ? `${name}, you won: ${data.wins.map((prize) => prize.prizeNameEn).join(", ")}. Full results below.`
    : `${name}, draw results for ${data.eventTitleEn}. Your numbers did not win. Full list below.`;

  const html = wrapEmail({
    preheader: won
      ? `${name}, vous avez gagné : ${yourWins}.`
      : `${name}, résultats du tirage · ${data.eventTitleFr}.`,
    heading: won ? `${name}, vous avez gagné` : `${name}, résultats du tirage`,
    ctaLabel: won ? "Voir mes tickets" : "Voir le palmarès",
    ctaUrl: won ? data.ticketsUrl : resultsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">${intro}</p>
      ${personal}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
      <p style="margin:0 0 14px;color:#141416;"><a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Prochaine tombola →</a></p>
      ${won ? `<p style="margin:0 0 14px;font-size:14px;"><a href="${escapeHtml(resultsUrl)}" style="color:#141416;font-weight:650;">Palmarès en ligne →</a></p>` : ""}
      ${emailEnglishBlock(englishSummary)}
    `,
  });

  const textLines = [
    won ? `${name}, vous avez gagné.` : `${name}, résultats du tirage.`,
    data.eventTitleFr,
    "",
    ...data.prizes.map((prize) => {
      const yours = data.wins.some(
        (win) => win.rank === prize.rank && win.ticketNumber === prize.ticketNumber,
      );
      return `Lot ${prize.rank} : ${prize.prizeNameFr} — ${prize.buyerName} (n°${prize.ticketNumber})${yours ? " ← vous" : ""}`;
    }),
    "",
    won ? `Votre lot : ${yourWins}` : "Pas de lot pour vos numéros cette fois.",
    `Palmarès : ${resultsUrl}`,
    won ? `Vos tickets : ${data.ticketsUrl}` : "",
    `Prochaine tombola : ${buyUrl}`,
    "",
    `ENGLISH : ${englishSummary}`,
  ].filter(Boolean);

  return {
    subject: won
      ? `${name}, vous avez gagné · ${data.eventTitleFr}`
      : `Résultats · ${data.eventTitleFr}`,
    html,
    text: textLines.join("\n"),
    params: {
      name,
      eventTitleFr: data.eventTitleFr,
      eventTitleEn: data.eventTitleEn,
      ticketsUrl: data.ticketsUrl,
      resultsUrl,
      buyUrl,
      donateUrl,
      logoUrl: siteUrl("/logo.png"),
      logoDarkUrl: siteUrl("/logo-white.png"),
    },
  };
}

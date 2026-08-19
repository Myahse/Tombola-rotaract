import { escapeHtml, firstName, siteUrl, wrapEmail } from "./layout.js";

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
      preheader: `${name}, la tombola est close. Grattez vos tickets pour voir.`,
      heading: `${name}, c’est le moment de gratter`,
      ctaLabel: "Gratter mes tickets",
      ctaUrl: data.ticketsUrl,
      bodyHtml: `
        <p style="margin:0 0 14px;color:#141416;">La tombola <strong>${escapeHtml(data.eventTitleFr)}</strong> est close. Les lots ont été attribués à des numéros à la roulette dès la création. Si vous n’avez pas encore gratté, vos tickets sont toujours dans votre compte.</p>
        <p style="margin:0 0 14px;color:#141416;">Un ami n’a pas joué ? <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Qu’il prenne sa place pour la suivante</a>. Vous pouvez aussi <a href="${escapeHtml(donateUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">soutenir le club</a>.</p>
        <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — The tombola for ${escapeHtml(data.eventTitleEn)} is closed. Prizes were assigned to ticket numbers on the wheel at creation. Scratch yours to see if you won. See you at the next tombola.</p>
      `,
    });
    return {
      subject: `${name}, grattez vos tickets — le tirage est fait`,
      html,
      text: [
        `${name}, c’est le moment de gratter.`,
        `La tombola ${data.eventTitleFr} est close. Les lots ont été attribués à des numéros à la roulette dès la création. Découvrez le vôtre en grattant.`,
        `Vos tickets : ${data.ticketsUrl}`,
        `EN — Scratch your tickets for ${data.eventTitleEn}.`,
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
        ? `<p style="margin:4px 0 0;font-size:12px;font-weight:650;color:#be034d;">C’est vous</p>`
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
    ? `Le tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong> est terminé. Voici tous les lots — et le vôtre est dans la liste.`
    : `Le tirage de <strong>${escapeHtml(data.eventTitleFr)}</strong> est terminé. Voici tous les lots, en une seule fois.`;

  const personal = won
    ? `<p style="margin:0 0 16px;color:#141416;">Vous repartez avec <strong>${escapeHtml(yourWins)}</strong>. Passez au club pour retirer votre lot.</p>`
    : `<p style="margin:0 0 16px;color:#141416;">Cette fois, vos numéros n’ont pas été appelés. On se revoit à la prochaine.</p>`;

  const html = wrapEmail({
    preheader: won
      ? `${name}, le tirage est tombé. Vous gagnez : ${yourWins}.`
      : `${name}, le tirage de ${data.eventTitleFr} est tombé. Voici tous les lots.`,
    heading: won ? `${name}, le tirage est tombé — et vous êtes dessus` : `${name}, le tirage est tombé`,
    ctaLabel: won ? "Voir mes tickets" : "Voir le palmarès",
    ctaUrl: won ? data.ticketsUrl : resultsUrl,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">${intro}</p>
      ${personal}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #ececee;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
      <p style="margin:0 0 14px;color:#141416;">Un ami n’a pas joué ? <a href="${escapeHtml(buyUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">Qu’il prenne sa place pour la suivante</a>. Vous pouvez aussi <a href="${escapeHtml(donateUrl)}" style="color:#be034d;font-weight:650;text-decoration:none;">soutenir le club</a>.</p>
      ${won ? `<p style="margin:0 0 14px;font-size:14px;"><a href="${escapeHtml(resultsUrl)}" style="color:#141416;font-weight:650;">Le palmarès en ligne →</a></p>` : `<p style="margin:0 0 14px;font-size:14px;"><a href="${escapeHtml(data.ticketsUrl)}" style="color:#141416;font-weight:650;">Gratter mes tickets →</a></p>`}
      <p style="margin:0;font-size:13px;color:#73737a;"><em>EN</em> — The draw for ${escapeHtml(data.eventTitleEn)} is done. All prizes are in this email${won ? ` — and you won: ${escapeHtml(data.wins.map((prize) => prize.prizeNameEn).join(", "))}` : ""}. See you at the next tombola.</p>
    `,
  });

  const textLines = [
    won ? `${name}, le tirage est tombé — et vous êtes dessus.` : `${name}, le tirage est tombé.`,
    data.eventTitleFr,
    "",
    ...data.prizes.map((prize) => {
      const yours = data.wins.some(
        (win) => win.rank === prize.rank && win.ticketNumber === prize.ticketNumber,
      );
      return `Lot ${prize.rank} : ${prize.prizeNameFr} — ${prize.buyerName} (n°${prize.ticketNumber})${yours ? " ← vous" : ""}`;
    }),
    "",
    won ? `Vos lots : ${yourWins}` : "Cette fois, pas de lot — on se revoit à la prochaine.",
    `Palmarès : ${resultsUrl}`,
    `Vos tickets : ${data.ticketsUrl}`,
    `Prochaine tombola : ${buyUrl}`,
    "",
    `EN — All prizes are listed above. ${won ? `You won: ${data.wins.map((prize) => prize.prizeNameEn).join(", ")}.` : "No prize this time."} See you at the next draw.`,
  ];

  return {
    subject: won
      ? `${name}, le tirage est tombé — voici tous les lots`
      : `${name}, le tirage de ${data.eventTitleFr} est tombé`,
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
    },
  };
}

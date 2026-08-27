import { emailEnglishBlock, emailHighlightBox, escapeHtml, firstName, wrapEmail } from "./layout.js";
import { admitCopy } from "../lib/gender.js";

export type QcmScoreEmail = {
  name: string;
  email: string;
  titleFr: string;
  titleEn: string;
  score: number;
  total: number;
  passScore: number;
  passed: boolean;
  gender?: string | null;
};

function answersLabel(count: number) {
  return count > 1 ? "bonnes réponses" : "bonne réponse";
}

export function qcmScoreEmail(data: QcmScoreEmail) {
  const name = firstName(data.name);
  const copy = admitCopy(data.passed, data.gender);
  const resultFr = copy.resultFr;
  const resultEn = data.passed ? "Pass" : "Not passed";
  const needed = `Il fallait au moins ${data.passScore} ${answersLabel(data.passScore)}.`;
  const neededEn = `Pass mark: ${data.passScore} correct answer${data.passScore > 1 ? "s" : ""}.`;

  if (data.passed) {
    const html = wrapEmail({
      preheader: `${name}, bravo. ${data.score} / ${data.total} — ${copy.youAre} au QCM « ${data.titleFr} ».`,
      heading: `${name}, ${copy.youAre} !`,
      bodyHtml: `
        <p style="margin:0 0 14px;color:#141416;">Quelle joie de vous l’écrire : vous avez réussi le <strong>${escapeHtml(data.titleFr)}</strong>. Le club est fier de vous.</p>
        ${emailHighlightBox("Résultat", `${data.score} / ${data.total} · ${escapeHtml(resultFr)}`)}
        <p style="margin:0 0 14px;color:#141416;">${escapeHtml(needed)} Vous les avez — et c’est un vrai passage.</p>
        <p style="margin:0 0 14px;color:#141416;">Cette note ouvre la suite de l’intronisation. On vous attend autour de la table, avec la même énergie que vous avez mise dans cette épreuve.</p>
        <p style="margin:0 0 14px;font-size:13px;color:#73737a;">Gardez cet e-mail. Le club vous recontactera pour les prochaines étapes.</p>
        ${emailEnglishBlock(
          ` ${name}, you passed « ${data.titleEn} »: ${data.score} / ${data.total}. ${neededEn} This opens the next step of induction. The club is proud of you — we can’t wait to welcome you around the table.`,
        )}
      `,
    });
    const text = [
      `${name}, ${copy.youAre} !`,
      "",
      `Bravo. Vous avez réussi le ${data.titleFr}.`,
      `Note : ${data.score} / ${data.total} · ${resultFr}`,
      needed,
      "",
      "Cette note ouvre la suite de l’intronisation. On vous attend autour de la table.",
      "",
      `ENGLISH : You passed « ${data.titleEn} »: ${data.score} / ${data.total}. ${neededEn} The club is proud of you.`,
    ].join("\n");
    return {
      subject: `${name}, bravo — ${copy.youAre} · ${data.score}/${data.total}`,
      html,
      text,
      params: scoreParams(name, data, resultFr, resultEn),
    };
  }

  const html = wrapEmail({
    preheader: `${name}, résultat du QCM « ${data.titleFr} » : ${data.score} / ${data.total}. ${resultFr}.`,
    heading: `${name}, voici le résultat de votre QCM`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Merci d’avoir passé le <strong>${escapeHtml(data.titleFr)}</strong> jusqu’au bout. Voici votre note, clairement.</p>
      ${emailHighlightBox("Résultat", `${data.score} / ${data.total} · ${escapeHtml(resultFr)}`)}
      <p style="margin:0 0 14px;color:#141416;">${escapeHtml(needed)} Cette fois, le seuil n’est pas atteint.</p>
      <p style="margin:0 0 14px;color:#141416;">Ce n’est pas un adieu. Le club reste avec vous : une nouvelle convocation pourra être envoyée quand la session suivante sera ouverte.</p>
      <p style="margin:0 0 14px;font-size:13px;color:#73737a;">Gardez cet e-mail. L’examinateur pourra vous recontacter pour la suite.</p>
      ${emailEnglishBlock(
        ` ${name}, result for « ${data.titleEn} »: ${data.score} / ${data.total}. ${resultEn}. ${neededEn} This is not the end — the club can invite you again for the next sitting.`,
      )}
    `,
  });
  const text = [
    `${name}, voici le résultat de votre QCM.`,
    "",
    data.titleFr,
    `Note : ${data.score} / ${data.total} · ${resultFr}`,
    needed,
    "",
    "Cette fois, le seuil n’est pas atteint. Le club peut vous reconvoquer à la prochaine session.",
    "",
    `ENGLISH : « ${data.titleEn} »: ${data.score} / ${data.total}. ${resultEn}. ${neededEn} The club can invite you again.`,
  ].join("\n");
  return {
    subject: `${name}, résultat du QCM : ${data.score}/${data.total} · ${resultFr.toLowerCase()}`,
    html,
    text,
    params: scoreParams(name, data, resultFr, resultEn),
  };
}

function scoreParams(name: string, data: QcmScoreEmail, resultFr: string, resultEn: string) {
  return {
    name,
    titleFr: data.titleFr,
    titleEn: data.titleEn,
    score: String(data.score),
    total: String(data.total),
    passScore: String(data.passScore),
    resultFr,
    resultEn,
  };
}

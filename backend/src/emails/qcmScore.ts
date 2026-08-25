import { emailEnglishBlock, emailHighlightBox, escapeHtml, firstName, wrapEmail } from "./layout.js";

export type QcmScoreEmail = {
  name: string;
  email: string;
  titleFr: string;
  titleEn: string;
  score: number;
  total: number;
  passScore: number;
  passed: boolean;
};

export function qcmScoreEmail(data: QcmScoreEmail) {
  const name = firstName(data.name);
  const resultFr = data.passed ? "Admis" : "Non admis";
  const resultEn = data.passed ? "Pass" : "Not passed";
  const html = wrapEmail({
    preheader: `${name}, votre note au QCM : ${data.score} / ${data.total}. ${resultFr}.`,
    heading: `${name}, voici votre note`,
    bodyHtml: `
      <p style="margin:0 0 14px;color:#141416;">Résultat du <strong>${escapeHtml(data.titleFr)}</strong>.</p>
      ${emailHighlightBox("Note", `${data.score} / ${data.total} · ${escapeHtml(resultFr)}`)}
      <p style="margin:0 0 14px;font-size:13px;color:#73737a;">Il fallait au moins ${data.passScore} bonne${data.passScore > 1 ? "s" : ""} réponse${data.passScore > 1 ? "s" : ""}.</p>
      ${emailEnglishBlock(
        `${data.titleEn}: ${data.score} / ${data.total}. ${resultEn}. Pass mark: ${data.passScore}.`,
      )}
    `,
  });

  const text = [
    `${name}, voici votre note.`,
    "",
    data.titleFr,
    `Note : ${data.score} / ${data.total} · ${resultFr}`,
    `Minimum : ${data.passScore}`,
    "",
    `ENGLISH : ${data.titleEn}: ${data.score} / ${data.total}. ${resultEn}. Pass mark: ${data.passScore}.`,
  ].join("\n");

  return {
    subject: `${name}, votre note : ${data.score}/${data.total}`,
    html,
    text,
    params: {
      name,
      titleFr: data.titleFr,
      titleEn: data.titleEn,
      score: String(data.score),
      total: String(data.total),
      passScore: String(data.passScore),
      resultFr,
      resultEn,
    },
  };
}

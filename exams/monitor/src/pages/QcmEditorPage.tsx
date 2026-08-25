import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { QcmQuestion } from "../types";

type DraftChoice = { textFr: string; textEn: string };
type DraftQuestion = {
  promptFr: string;
  promptEn: string;
  choices: DraftChoice[];
  correctIndex: number;
};

function emptyQuestion(): DraftQuestion {
  return {
    promptFr: "",
    promptEn: "",
    choices: [
      { textFr: "", textEn: "" },
      { textFr: "", textEn: "" },
      { textFr: "", textEn: "" },
      { textFr: "", textEn: "" },
    ],
    correctIndex: 0,
  };
}

function fromApi(question: QcmQuestion): DraftQuestion {
  const choices = [0, 1, 2, 3].map((index) => ({
    textFr: question.choices[index]?.textFr ?? "",
    textEn: question.choices[index]?.textEn ?? "",
  }));
  const correctIndex = Math.max(
    0,
    question.choices.findIndex((choice) => choice.id === question.correctChoiceId),
  );
  return {
    promptFr: question.promptFr,
    promptEn: question.promptEn,
    choices,
    correctIndex,
  };
}

export function QcmEditorPage() {
  const { t } = useTranslation();
  const [titleFr, setTitleFr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [passScore, setPassScore] = useState(1);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    const data = await api.qcm();
    setTitleFr(data.exam?.titleFr ?? "");
    setTitleEn(data.exam?.titleEn ?? "");
    setPassScore(data.exam?.passScore ?? 1);
    setQuestions(data.questions.length ? data.questions.map(fromApi) : [emptyQuestion()]);
    setLocked(data.exam?.status === "open" || data.attempts.some((item) => item.status === "in_progress"));
    setReady(true);
  }

  useEffect(() => {
    load().catch(() => {
      setReady(true);
      setMessage(t("errors.generic"));
    });
  }, [t]);

  function updateQuestion(index: number, next: DraftQuestion) {
    setQuestions((current) => current.map((item, i) => (i === index ? next : item)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSaved(false);
    try {
      const payload = {
        titleFr: titleFr.trim(),
        titleEn: titleEn.trim(),
        passScore,
        questions: questions.map((question) => {
          const filled = question.choices
            .map((choice, index) => ({ ...choice, index }))
            .filter((choice) => choice.textFr.trim());
          const correctIndex = Math.max(
            0,
            filled.findIndex((choice) => choice.index === question.correctIndex),
          );
          return {
            promptFr: question.promptFr.trim(),
            promptEn: question.promptEn.trim(),
            choices: filled.map((choice) => ({
              textFr: choice.textFr.trim(),
              textEn: choice.textEn.trim(),
            })),
            correctIndex,
          };
        }),
      };
      const data = await api.saveQcm(payload);
      setQuestions(data.questions.length ? data.questions.map(fromApi) : [emptyQuestion()]);
      setPassScore(data.exam?.passScore ?? passScore);
      setSaved(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage(
        code === "qcm_locked"
          ? t("qcm.locked")
          : code === "pass_too_high"
            ? t("qcm.passTooHigh")
            : code === "invalid_form"
              ? t("errors.invalidForm")
              : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="lede">…</p>;

  return (
    <form className="grid gap-5 qcm-editor" onSubmit={onSubmit}>
      <p className="eyebrow">{t("home.kicker")}</p>
      <h1>{t("qcm.editorTitle")}</h1>
      <p className="lede">{t("qcm.editorLead")}</p>
      {locked ? <p className="text-sm text-ticket">{t("qcm.locked")}</p> : null}

      <label>
        {t("qcm.titleFr")}
        <input value={titleFr} disabled={locked} onChange={(e) => setTitleFr(e.target.value)} required minLength={2} />
      </label>
      <label>
        {t("qcm.titleEn")}
        <input value={titleEn} disabled={locked} onChange={(e) => setTitleEn(e.target.value)} />
      </label>
      <label>
        {t("qcm.passScore")}
        <input
          type="number"
          min={1}
          max={Math.max(1, questions.length)}
          value={passScore}
          disabled={locked}
          onChange={(e) => setPassScore(Number(e.target.value))}
          required
        />
      </label>

      {questions.map((question, index) => (
        <article key={index} className="qcm-edit-card">
          <div className="qcm-card-top">
            <strong>
              {t("qcm.question")} {index + 1}
            </strong>
            {questions.length > 1 && !locked ? (
              <button
                type="button"
                className="btn-outline"
                onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
              >
                {t("qcm.remove")}
              </button>
            ) : null}
          </div>
          <label>
            {t("qcm.promptFr")}
            <textarea
              rows={2}
              value={question.promptFr}
              disabled={locked}
              onChange={(e) => updateQuestion(index, { ...question, promptFr: e.target.value })}
              required
            />
          </label>
          <label>
            {t("qcm.promptEn")}
            <textarea
              rows={2}
              value={question.promptEn}
              disabled={locked}
              onChange={(e) => updateQuestion(index, { ...question, promptEn: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>{t("qcm.choices")}</legend>
            {question.choices.map((choice, choiceIndex) => (
              <label key={choiceIndex} className="qcm-choice-row">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={question.correctIndex === choiceIndex}
                  disabled={locked}
                  onChange={() => updateQuestion(index, { ...question, correctIndex: choiceIndex })}
                />
                <input
                  value={choice.textFr}
                  disabled={locked}
                  placeholder={t("qcm.choiceN", { n: choiceIndex + 1 })}
                  onChange={(e) =>
                    updateQuestion(index, {
                      ...question,
                      choices: question.choices.map((item, i) =>
                        i === choiceIndex ? { ...item, textFr: e.target.value } : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <p className="field-hint">{t("qcm.correctHint")}</p>
          </fieldset>
        </article>
      ))}

      {!locked ? (
        <button type="button" className="btn-outline" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>
          {t("qcm.addQuestion")}
        </button>
      ) : null}

      <button type="submit" className="btn-primary btn-block" disabled={busy || locked}>
        {busy ? t("qcm.saving") : t("qcm.save")}
      </button>
      {saved ? <p className="field-ok">{t("qcm.saved")}</p> : null}
      {message ? <p className="text-sm text-ticket">{message}</p> : null}
    </form>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { customEmailsFromDraft, draftFromSelection, selectedFromDraft } from "../audience";
import type { CampaignDraft, CampaignPerson } from "../types";

export function PeoplePicker({
  people,
  draft,
  locked,
  onPatch,
}: {
  people: CampaignPerson[];
  draft: CampaignDraft;
  locked: boolean;
  onPatch: (next: Partial<CampaignDraft>) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const selected = useMemo(() => selectedFromDraft(draft, people), [draft, people]);
  const derivedCustom = customEmailsFromDraft(draft, people).join("\n");
  const [customInput, setCustomInput] = useState(derivedCustom);
  const members = people.filter((person) => person.member);
  const optedIn = members.filter((person) => person.optedIn);
  const buyers = people.filter((person) => person.buyer);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (person) => person.name.toLowerCase().includes(needle) || person.email.includes(needle),
    );
  }, [people, query]);

  useEffect(() => {
    setCustomInput(derivedCustom);
  }, [derivedCustom]);

  function apply(next: Set<string>, custom = customInput) {
    onPatch(draftFromSelection(next, people, custom));
  }

  function toggle(email: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(email);
    else next.delete(email);
    apply(next);
  }

  function addAll(list: CampaignPerson[]) {
    const next = new Set(selected);
    for (const person of list) next.add(person.email);
    apply(next);
  }

  function removeMembersKeepBuyers() {
    const next = new Set(selected);
    for (const person of members) {
      if (!(draft.includeBuyers && person.buyer)) next.delete(person.email);
    }
    apply(next);
  }

  return (
    <>
      <fieldset className="pay-options">
        <legend>{t("campaign.audience")}</legend>
        <p className="hint">{t("campaign.peopleHelp")}</p>
        <label className={`pay-option ${draft.includeMembers ? "active" : ""}`}>
          <input
            type="checkbox"
            disabled={locked || !members.length}
            checked={draft.includeMembers}
            onChange={(e) => {
              if (e.target.checked) addAll(draft.optedInOnly && optedIn.length ? optedIn : members);
              else removeMembersKeepBuyers();
            }}
          />
          <span>
            <strong>{t("campaign.members")}</strong>
            <em>{members.length}</em>
          </span>
        </label>
        {draft.includeMembers ? (
          <label className={`pay-option ${draft.optedInOnly ? "active" : ""}`}>
            <input
              type="checkbox"
              disabled={locked}
              checked={draft.optedInOnly}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) {
                  for (const person of members) {
                    if (!person.optedIn && !(draft.includeBuyers && person.buyer)) next.delete(person.email);
                  }
                } else {
                  for (const person of members) next.add(person.email);
                }
                apply(next);
              }}
            />
            <span>
              <strong>{t("campaign.optedIn")}</strong>
              <em>{optedIn.length}</em>
            </span>
          </label>
        ) : null}
        <label className={`pay-option ${draft.includeBuyers ? "active" : ""}`}>
          <input
            type="checkbox"
            disabled={locked || !buyers.length}
            checked={draft.includeBuyers}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) {
                for (const person of buyers) next.add(person.email);
              } else {
                for (const person of buyers) {
                  if (!(draft.includeMembers && person.member && (!draft.optedInOnly || person.optedIn))) {
                    next.delete(person.email);
                  }
                }
              }
              apply(next);
            }}
          />
          <span>
            <strong>{t("campaign.buyers")}</strong>
            <em>{buyers.length}</em>
          </span>
        </label>
      </fieldset>

      <div className="people-tools">
        <button type="button" className="btn-outline" disabled={locked || !optedIn.length} onClick={() => addAll(optedIn)}>
          {t("campaign.selectOptedIn")}
        </button>
        <button type="button" className="btn-outline" disabled={locked || !members.length} onClick={() => addAll(members)}>
          {t("campaign.selectMembers")}
        </button>
        <button type="button" className="btn-outline" disabled={locked || !buyers.length} onClick={() => addAll(buyers)}>
          {t("campaign.selectBuyers")}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={locked || selected.size === 0}
          onClick={() => apply(new Set())}
        >
          {t("campaign.clearPeople")}
        </button>
      </div>

      <label className="people-search">
        {t("campaign.peopleSearch")}
        <input
          value={query}
          disabled={locked}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("campaign.peopleSearchHint")}
        />
      </label>

      <div className="people-list" role="group" aria-label={t("campaign.audience")}>
        {visible.length ? (
          visible.map((person) => (
            <label key={person.email} className="people-row">
              <input
                type="checkbox"
                disabled={locked}
                checked={selected.has(person.email)}
                onChange={(e) => toggle(person.email, e.target.checked)}
              />
              <span>
                <strong>{person.name || person.email}</strong>
                <em>
                  {person.email}
                  {person.member ? ` · ${t("campaign.sourceMember")}` : ""}
                  {person.buyer ? ` · ${t("campaign.sourceBuyer")}` : ""}
                </em>
              </span>
            </label>
          ))
        ) : (
          <p className="people-empty">{t("campaign.peopleEmpty")}</p>
        )}
      </div>

      <label>
        {t("campaign.custom")}
        <textarea
          rows={3}
          value={customInput}
          disabled={locked}
          onChange={(e) => {
            setCustomInput(e.target.value);
            apply(selected, e.target.value);
          }}
        />
        <span className="hint">{t("campaign.customHelp")}</span>
      </label>
    </>
  );
}

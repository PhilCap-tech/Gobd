export type VersionChangeDraft = {
  validFrom: string;
  validTo: string;
  changeSummary: string;
  changedBy: string;
};

export function VersionChangeFields({
  value,
  onChange,
  summaryRequired = false,
  idPrefix = "version",
}: {
  value: VersionChangeDraft;
  onChange: (next: VersionChangeDraft) => void;
  summaryRequired?: boolean;
  idPrefix?: string;
}) {
  const fromId = `${idPrefix}-valid-from`;
  const toId = `${idPrefix}-valid-to`;
  const summaryId = `${idPrefix}-change-summary`;
  const whoId = `${idPrefix}-changed-by`;

  function patch(partial: Partial<VersionChangeDraft>) {
    onChange({ ...value, ...partial });
  }

  return (
    <fieldset className="version-change">
      <legend>Gültigkeit und Änderung</legend>
      <p className="field-hint">
        Gültig ab darf in der Vergangenheit oder Zukunft liegen. Bleibt Gültig
        bis leer, endet die vorherige Fassung am Tag vor diesem Datum.
      </p>
      <div className="field">
        <label htmlFor={fromId}>Gültig ab</label>
        <input
          id={fromId}
          type="date"
          required
          value={value.validFrom}
          onChange={(event) => patch({ validFrom: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={toId}>Gültig bis (optional)</label>
        <input
          id={toId}
          type="date"
          value={value.validTo}
          onChange={(event) => patch({ validTo: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={summaryId}>Kurz-Changelog</label>
        <textarea
          id={summaryId}
          required={summaryRequired}
          placeholder={
            summaryRequired
              ? "z. B. neue Buchhaltungskraft, Umstieg auf DATEV"
              : "Erstfassung, falls leer"
          }
          value={value.changeSummary}
          onChange={(event) => patch({ changeSummary: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={whoId}>Wer</label>
        <input
          id={whoId}
          type="text"
          autoComplete="name"
          placeholder="Name oder E-Mail"
          value={value.changedBy}
          onChange={(event) => patch({ changedBy: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

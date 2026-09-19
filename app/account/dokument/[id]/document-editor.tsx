"use client";

import { useState, type FormEvent } from "react";
import type { DocumentChapter } from "@/lib/document-content";

type DocumentEditorProps = {
  sourceDocumentId: string;
  company: string;
  nextVersion: number;
  initialCover: string;
  initialChapters: DocumentChapter[];
  disclaimer: string;
  currentDownloadPath: string;
};

export function DocumentEditor({
  sourceDocumentId,
  company,
  nextVersion,
  initialCover,
  initialChapters,
  disclaimer,
  currentDownloadPath,
}: DocumentEditorProps) {
  const [cover, setCover] = useState(initialCover);
  const [chapters, setChapters] = useState(initialChapters);
  const [documentId, setDocumentId] = useState(sourceDocumentId);
  const [versionHint, setVersionHint] = useState(nextVersion);
  const [downloadPath, setDownloadPath] = useState(currentDownloadPath);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  function patchChapter(id: string, body: string) {
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === id ? { ...chapter, body } : chapter,
      ),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          cover,
          chapters,
        }),
      });
      let data: {
        error?: string;
        documentId?: string;
        pdfUrl?: string;
        version?: number;
      } = {};
      try {
        const text = await response.text();
        if (text.trim()) {
          data = JSON.parse(text) as typeof data;
        }
      } catch {
        data = {};
      }
      if (!response.ok || !data.documentId || !data.version) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      setDocumentId(data.documentId);
      setDownloadPath(data.pdfUrl || `/api/docs/${data.documentId}/download`);
      setSavedVersion(data.version);
      setVersionHint(data.version + 1);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="banner">
        Du bearbeitest den Entwurf
        {company ? ` für ${company}` : ""}. Speichern erzeugt Version{" "}
        {versionHint} — bisherige PDFs bleiben downloadbar. Der Text stammt aus
        deinem generierten Entwurf, nicht aus zusätzlichen Rechtstexten.
      </p>

      {savedVersion && (
        <p className="banner ok" role="status">
          Version {savedVersion} ist gespeichert.{" "}
          <a href={downloadPath}>PDF herunterladen</a>
        </p>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label htmlFor="doc-cover">Deckblatt</label>
          <textarea
            id="doc-cover"
            className="chapter-text"
            value={cover}
            onChange={(event) => setCover(event.target.value)}
            spellCheck
          />
        </div>
      </div>

      {chapters.map((chapter) => (
        <div className="card" key={chapter.id} style={{ marginBottom: 16 }}>
          <div className="field">
            <label htmlFor={`chapter-${chapter.id}`}>{chapter.title}</label>
            <p className="field-hint">
              Markdown-Text. Überschriften und Listen bleiben erhalten.
            </p>
            <textarea
              id={`chapter-${chapter.id}`}
              className="chapter-text"
              value={chapter.body}
              onChange={(event) => patchChapter(chapter.id, event.target.value)}
              spellCheck
            />
          </div>
        </div>
      ))}

      <p className="disclaimer" role="note">
        {disclaimer}
      </p>

      {error && <p className="error">{error}</p>}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Bitte warten…" : "Speichern und PDF erzeugen"}
        </button>
        {savedVersion && (
          <a className="btn" href={downloadPath}>
            PDF herunterladen
          </a>
        )}
        {savedVersion && (
          <button className="btn ghost" type="submit" disabled={pending}>
            PDF neu erzeugen
          </button>
        )}
      </div>
      <p className="hint revision-hint">
        „Speichern und PDF erzeugen“ schreibt eine neue Zeile (Version{" "}
        {versionHint}) und legt das PDF ab. „PDF neu erzeugen“ macht dasselbe
        nach weiteren Änderungen.
      </p>
    </form>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { KANZLEI_TOOLBOX_DRAFT_BANNER } from "@/lib/kanzlei-toolbox-copy";

export const metadata: Metadata = {
  title: "Datenschutz Kanzlei-Toolbox (Entwurf)",
  robots: { index: false, follow: false },
};

export default function KanzleiToolboxPrivacyDraftPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <p role="note">{KANZLEI_TOOLBOX_DRAFT_BANNER}</p>
        <h1>Entwurf: Abschnitt Kanzlei-Toolbox</h1>
        <p>
          Die veröffentlichte Datenschutzerklärung bleibt unverändert. Dieser Entwurf beschreibt, welcher Abschnitt dort
          ergänzt werden soll. Die vorgeschlagene Nummer ist 19, unmittelbar nach dem heutigen Abschnitt 18
          (Partneranfragen). Dabei würden die heutigen Abschnitte 19 bis 25 um eine Nummer aufrücken. Die Anrede der
          veröffentlichten Erklärung ist „Sie“.
        </p>
        <h2>Anmeldung von Kanzleien</h2>
        <p>
          Wir verarbeiten Kanzleiname, Website, dienstliche E-Mail-Adresse, Ort, Zeitpunkte von Anmeldung und
          Bestätigung und den Status. Rechtsgrundlage ist der Teilnahmevertrag, bei Beschäftigten der Kanzlei unser
          berechtigtes Interesse an der Durchführung. Den Namen gleichen wir vor der Anzeige mit dem Impressum und dem
          amtlichen Steuerberaterverzeichnis ab. Die Zustimmung speichern wir mit Wortlaut und Zeitpunkt.
        </p>
        <p>
          E-Mails versendet Resend (Plus Five Five, Inc., USA). Einzelheiten zum Versand stehen in der veröffentlichten
          Erklärung im Abschnitt zum E-Mail-Versand. Das Kanzlei-Register ist für einen eigenen Tab vorbereitet
          (`kanzlei_toolbox` in der vorhandenen Tabelle). Der Tab bleibt aus, bis er freigegeben wird. Bis dahin liegt
          das Register in einer Datei der Anwendung. Es liegt nicht in der Tabelle der Ampel-Anfragen und nicht im
          Dateispeicher für Dokumente. Eine Vorschau-Umgebung beschreibt den Tab nicht. Eine feste Region ist dafür
          nicht hinterlegt. Hosting-Logfiles des Anbieters bleiben der veröffentlichte Abschnitt zu Server-Logfiles.
        </p>
        <h2>Aufruf über den Link einer Kanzlei</h2>
        <p>
          Nach der Freigabe des Namens zählt der Server den Aufruf mit Datum, interner Kennung ohne Namensteil und grober
          Geräteklasse. IP-Adresse, Uhrzeit und Gerätekennung speichern wir dafür nicht. Die Kennung steht in der Adresse
          des Ampel-Checks. Fordern Sie die Auswertung per E-Mail an, speichern wir bei der Anfrage nur diese interne
          Kennung. An die Bestellseite und an den Zahlungsdienstleister geben wir sie nicht weiter. Es gibt dafür kein
          Cookie und keinen Speicher im Browser. Kampagnenparameter und freie Namensangaben aus der Adresse speichern wir
          in diesem Ablauf nicht.
        </p>
        <h2>Was die Kanzlei erhält</h2>
        <p>
          Die Kanzlei erhält keine E-Mail-Adresse, keine Antworten, kein Ergebnis und keine Kaufangabe. Auf Wunsch einen
          monatlichen Bericht nur mit Summen. Werte unter 5 nur als „unter 5“.
        </p>
        <h2>Speicherdauer, Vorschlag</h2>
        <ul>
          <li>Angaben der Kanzlei: für die Teilnahme, danach innerhalb von 30 Tagen.</li>
          <li>Nicht bestätigte Anmeldungen: 30 Tage.</li>
          <li>Nachweis der Zustimmung und des Widerrufs: 3 Jahre nach dem Ende des Jahres, in dem die Teilnahme endet.</li>
          <li>Zuordnung bei einer Anfrage: zusammen mit der Anfrage, spätestens nach 12 Monaten.</li>
          <li>Tageszahlen: 24 Monate, danach ohne Kanzlei-Kennung.</li>
          <li>Sperrliste: Domain, interne Kennung und Grund, 3 Jahre.</li>
          <li>Löschprotokoll: nur Anzahl, Art und Datum, ohne Name, E-Mail oder Kennung.</li>
        </ul>
        <p>
          Soweit die Verarbeitung auf einem berechtigten Interesse beruht, können Sie widersprechen, zum Beispiel an
          info@gobd-doku-erstellen.de. Ihre weiteren Rechte stehen in der veröffentlichten Erklärung im Abschnitt „Ihre
          Rechte“.
        </p>
        <p>
          <Link href="/datenschutz">Zur veröffentlichten Datenschutzerklärung</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

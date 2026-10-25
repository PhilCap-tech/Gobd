import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { KANZLEI_TOOLBOX_DRAFT_BANNER } from "@/lib/kanzlei-toolbox-copy";

export const metadata: Metadata = {
  title: "Teilnahmebedingungen Kanzlei-Toolbox (Entwurf)",
  robots: { index: false, follow: false },
};

export default function KanzleiToolboxTermsDraftPage() {
  return (
    <>
      <SiteHeader backHref="/steuerberater#toolbox" backLabel="← Zur Kanzlei-Seite" />
      <main className="wrap page">
        <p role="note">{KANZLEI_TOOLBOX_DRAFT_BANNER}</p>
        <h1>Teilnahmebedingungen „Kanzlei-Toolbox“ der {LEGAL_OPERATOR.name}</h1>
        <p>Stand: noch nicht festgelegt.</p>
        <h2>1. Anbieter und Geltungsbereich</h2>
        <p>
          Anbieter ist die {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.street}, {LEGAL_OPERATOR.zipCity}, vertreten durch{" "}
          {LEGAL_OPERATOR.managingDirector}, {LEGAL_OPERATOR.registerCourt}, {LEGAL_OPERATOR.registerNumber},{" "}
          {LEGAL_OPERATOR.email}. Diese Bedingungen gelten nur für die Kanzlei-Toolbox. Die kostenpflichtige
          Kanzlei-Partnerschaft und die Verfahrensdokumentation sind nicht Gegenstand.
        </p>
        <h2>2. Teilnahmeberechtigung</h2>
        <p>Teilnehmen können ausschließlich Steuerberater sowie Steuerberatungsgesellschaften. Ein Anspruch auf Teilnahme besteht nicht.</p>
        <h2>3. Anmeldung und Prüfung</h2>
        <p>
          Sie melden die Kanzlei über das Formular an und bestätigen Ihre E-Mail-Adresse. Vor der Anzeige des Namens
          gleichen wir die Angaben mit dem Impressum und mit dem amtlichen Steuerberaterverzeichnis ab. Bis dahin führt
          Ihr Link auf den Ampel-Check ohne Namen. Aufrufe werden in dieser Zeit weder gezählt noch zugeordnet.
        </p>
        <h2>4. Leistungen</h2>
        <p>Nach der Bestätigung erhalten Sie einen persönlichen Link, einen QR-Code, ein Mandanten-Merkblatt und Textbausteine. Auf Wunsch einen Bericht nur mit Zahlen.</p>
        <h2>5. Keine Vergütung</h2>
        <p>
          Die Teilnahme ist kostenlos. Sie erhalten keine Provision, keine Vergütung, keinen Rabatt und keine sonstigen
          Vorteile, auch nicht, wenn über Ihren Link ein Vertrag zustande kommt. Die Leistungen hängen nicht von Zahl
          oder Wert solcher Verträge ab. Mandanten erhalten dieselben Preise wie alle anderen Kunden.
        </p>
        <h2>6. bis 8. Nutzung, Name, Pflichten</h2>
        <p>
          Sie dürfen Merkblatt und Bausteine für die Information eigener Mandanten nutzen. Den geprüften Namen zeigen
          wir als Text in der Zeile „Hinweis von [Kanzleiname]“, mit dem Hinweis, dass die Kanzlei den Check nicht
          erstellt und nicht geprüft hat. In der Bestellstrecke nennen wir den Namen nicht. Den Widerruf können Sie
          jederzeit erklären. Sie übermitteln uns keine Mandantendaten. Ob die Teilnahme mit Ihrem Berufsrecht vereinbar
          ist, prüfen Sie selbst.
        </p>
        <h2>9. Bericht</h2>
        <p>
          Auf Wunsch monatlich nur zusammengefasste Zahlen: Aufrufe, gestartete und abgeschlossene Checks. Werte unter 5
          nur als „unter 5“. Nie Käufe, nie Ergebnisse, nie einzelne Personen.
        </p>
        <h2>10. bis 15. Datenschutz, Laufzeit, Haftung, Schluss</h2>
        <p>
          IKAT und die Kanzlei sind jeweils eigene Verantwortliche. Eine Freistellung ist nicht vorgesehen. Die Frist,
          mit der wir die Teilnahme beenden, der Vorlauf für Änderungen und der Gerichtsstand sind noch nicht festgelegt.
          Es gilt das Recht der Bundesrepublik Deutschland.
        </p>
        <p>
          <Link href="/steuerberater#toolbox">Zurück zum Formular</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

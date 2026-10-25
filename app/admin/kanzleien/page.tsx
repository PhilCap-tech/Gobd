import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAmpelAdminEmail } from "@/lib/ampel-admin";
import { getSessionEmail } from "@/lib/auth";
import { listKanzleiRecords, readKanzleiToolbox } from "@/lib/kanzlei-toolbox-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kanzleien",
  robots: { index: false, follow: false },
};

export default async function KanzleiAdminPage() {
  const email = await getSessionEmail();
  if (!isAmpelAdminEmail(email)) notFound();
  const file = await readKanzleiToolbox();
  const records = listKanzleiRecords(file);
  return (
    <main className="wrap page">
      <h1>Kanzlei-Toolbox</h1>
      <p>Namen werden nur nach Impressum und manuellem Abgleich mit dem Steuerberaterverzeichnis angezeigt. Die Verzeichnisabfrage erfolgt nicht automatisch.</p>
      <table>
        <thead>
          <tr>
            <th>Kennung</th>
            <th>Name</th>
            <th>Status</th>
            <th>Verzeichnis</th>
            <th>Hinweis</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.kanzleiId}>
              <td>{record.kanzleiId}</td>
              <td>{record.displayName || "—"}</td>
              <td>{record.status}</td>
              <td>{record.verification.verzeichnisChecked ? "ja" : "offen"}</td>
              <td>{record.verification.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

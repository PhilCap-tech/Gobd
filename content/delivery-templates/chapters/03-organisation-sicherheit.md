# 3. Organisation und Sicherheit

## 3.1 Eingesetzte Hard- und Software

[1] Die nachfolgend aufgelistete Hard- und Software ist auf diejenigen Komponenten beschränkt, die für die Belegablage und -aufbewahrung zum Einsatz kommen und im Kunden-Intake angegeben wurden. Durch die Nutzung dieser Komponenten soll bei ordnungsmäßiger und zeitlich ununterbrochener Anwendung die Einhaltung der GoB unterstützt werden. Gleichzeitig soll sichergestellt werden, dass digitale und digitalisierte Unterlagen während der Dauer der Aufbewahrungsfrist verfügbar sind, jederzeit innerhalb angemessener Frist lesbar gemacht werden können und für einen Datenzugriff im Falle einer steuerlichen Außenprüfung zur Verfügung gestellt werden können.

[2] Bei einer Änderung der digitalisierungs- und/oder archivierungsrelevanten Hardware und/oder Software wird neben der Dokumentation der Systemänderung sichergestellt, dass die Lesbarkeit der digitalisierten und digitalen Dokumente gewährleistet bleibt (Migration, Exportfähigkeit, Formatstabilität).

[3] **Finanzbuchhaltung / FiBu-Systeme** laut Intake: **{{answers.fibu | join ", " | or "nicht angegeben"}}**. In diesen Systemen bzw. über diese Systeme erfolgt die buchhalterische Verarbeitung bzw. die Anbindung an die Buchführung, soweit angegeben.

[4] **Weitere Systeme / Vorsysteme** laut Intake: **{{answers.weitereSysteme | or "nicht angegeben"}}**. Vorsysteme, aus denen Belege oder belegrelevante Daten entstehen (z. B. CRM, Shop, Zahlungsdienstleister, Excel-Nebenrechnungen), sind in den Belegprozess einzubeziehen und dürfen nicht unkontrolliert parallel zur FiBu geführt werden.

[5] **Hosting** der relevanten Systeme laut Intake: **{{answers.hosting | or "nicht angegeben"}}**. Der Aufbewahrungsort (Inland / EU / Drittland) ist mit den Anforderungen des § 146 Abs. 2, 2a AO und — bei elektronischen Rechnungen — des § 14b Abs. 2 UStG abzustimmen. Bei Cloud-/SaaS-Lösungen ist der Standort der Systeme zu kennen.

[6] **Archivierung** laut Intake: **{{answers.archiv | or "nicht angegeben"}}**. Digitale und digitalisierte Belege werden an dem angegebenen Archivort in einer nachvollziehbaren Ordnungsstruktur abgelegt. Änderungen oder Löschungen sind nur durch berechtigte Personen gemäß Zuständigkeitsregelung zulässig und dürfen die Unveränderbarkeit bzw. Nachvollziehbarkeit nicht unterlaufen.

[7] **Datensicherung (Backup)** laut Intake: **{{answers.backup | join ", " | or "nicht angegeben"}}**. Backup-Maßnahmen dienen dem Schutz gegen Verlust und Untergang. Sie ersetzen nicht die geordnete Archivierung und müssen die Wiederherstellbarkeit der Belege über die Aufbewahrungsfrist ermöglichen.

[8] **Zugriff / Berechtigungen** laut Intake: **{{answers.zugriff | or "nicht angegeben"}}**. Der Zugriff auf Belegspeicher und FiBu-Systeme ist auf autorisierte Personen zu beschränken. Fernzugriffe erfolgen über gesicherte Verbindungen, soweit technisch vorgesehen.

[9] Für physische Papierablage gilt ergänzend: Originalbelege in Papierform werden geordnet (z. B. nach Jahr, Belegart) in beschrifteten Ordnern bzw. an einem gegen unbefugten Zugriff gesicherten Ort aufbewahrt. Digitale Ablage folgt einer klaren Ordner- bzw. Indexstruktur (z. B. Jahr > Monat > Belegart), um Nachvollziehbarkeit und Wiederauffindbarkeit zu gewährleisten.

[10] Angaben zu Softwarebescheinigungen, Zertifikaten, konkreten Serverpfaden oder Versionsständen der eingesetzten Produkte liegen in dieser Intake-basierten Fassung nur vor, soweit sie im Intake genannt wurden. Fehlende technische Anlagen sind unter „Mitgeltende Unterlagen“ bzw. „Offene Punkte“ nachzutragen.

## 3.2 Zuständigkeiten

[1] Das Verfahren der Belegablage ist in den Kapiteln zu Papier- und Digitalverfahren in seinen Einzelschritten dargestellt. Im Folgenden werden die laut Intake benannten Rollen den Prozessschritten zugeordnet. Fehlende Angaben sind als offene Punkte zu führen und vor der Freigabe zu ergänzen.

[2] **Geschäftsführung / Gesamtverantwortung** laut Intake: **{{answers.gf | or "nicht angegeben"}}**. Die Geschäftsleitung genehmigt diese Verfahrensdokumentation, entscheidet über Abweichungen und Freigaben zur Vernichtung/Löschung und trägt die Gesamtverantwortung für die Einhaltung der Buchführungs- und Aufzeichnungspflichten.

[3] **Buchhaltung** laut Intake: **{{answers.buchhaltung | or "nicht angegeben"}}**. Der Buchhaltungsverantwortliche steuert Identifikation, Prüfung, Aufbereitung und Weitergabe der Belege zur Verbuchung sowie die Einhaltung der Ablageordnung, soweit nicht an die Steuerberatung ausgelagert.

[4] **IT / Systemverantwortung** laut Intake: **{{answers.it | or "nicht angegeben"}}**. Die IT-Verantwortung umfasst Betrieb, Zugriffskontrollen, Backup und Sicherstellung der Lesbarkeit der digitalen Archivbestände.

[5] **Steuerberatung** laut Intake: **{{answers.steuerberater | or "nicht angegeben"}}**. Die Steuerberatung unterstützt bei Aufbereitung, Verbuchung und ggf. Archivierung im vereinbarten Umfang. Die öffentlich-rechtliche Pflicht bleibt beim Unternehmen.

[6] Den Prozessschritten sind die Rollen wie folgt zuzuordnen (soweit die jeweilige Person/Stelle im Intake benannt ist; sonst „offen“):

- **Posteingang und Vorsortierung (Papier / digital):** Buchhaltung {{answers.buchhaltung | or "offen"}}; GF {{answers.gf | or "offen"}}
- **Identifikation und Echtheitsprüfung:** Buchhaltung {{answers.buchhaltung | or "offen"}}
- **Prüfung eingehender Rechnungen** (Vollständigkeit / Pflichtangaben § 14 Abs. 4 UStG): Buchhaltung {{answers.buchhaltung | or "offen"}}
- **Digitalisierung von Papierbelegen** (falls vorgesehen): Buchhaltung {{answers.buchhaltung | or "offen"}}; IT {{answers.it | or "offen"}}
- **Ablage in der vorgesehenen Ordnung:** Buchhaltung {{answers.buchhaltung | or "offen"}}
- **Aufbereitung für die Buchung:** Buchhaltung {{answers.buchhaltung | or "offen"}}; Steuerberatung {{answers.steuerberater | or "offen"}}
- **Weitergabe an / Rücknahme von Dritten:** GF {{answers.gf | or "offen"}}; Buchhaltung {{answers.buchhaltung | or "offen"}}
- **Archivierung nach Erfassung:** Buchhaltung {{answers.buchhaltung | or "offen"}}; IT {{answers.it | or "offen"}}
- **Freigabe Vernichtung Papier / Löschung digital:** GF {{answers.gf | or "offen"}}
- **Durchführung Vernichtung / Löschung:** GF {{answers.gf | or "offen"}}; IT {{answers.it | or "offen"}}
- **Stichprobenkontrollen (IKS):** GF {{answers.gf | or "offen"}}

[7] Die postalische Entgegennahme, Identifikation, Ablage, Aufbereitung und Archivierung von Dokumenten mit Belegfunktion, die als besonders schutzwürdig gelten, ist nur den von der Geschäftsleitung autorisierten Personen gestattet.

[8] Freigabe zur Vernichtung von Papierbelegen und zur Löschung digitaler Archivbestände erfolgt nicht vor Ablauf der Aufbewahrungsfrist und nur durch die Geschäftsleitung bzw. eine von ihr ausdrücklich bevollmächtigte Stelle.

## 3.3 Organisation und Internes Kontrollsystem (IKS)

[1] Die in den Folgekapiteln dargestellten Prozess-Schritte werden von den eingewiesenen und autorisierten Personen regelmäßig, unverändert und ohne Unterbrechung durchgeführt. Dabei kommt die in Abschnitt 3.1 dargestellte Hard- und Software zum Einsatz.

[2] Um die Einhaltung der vorgegebenen Verfahren zu gewährleisten, werden regelmäßige Kontrollen durchgeführt. Diese orientieren sich an den tatsächlich aufgrund der organisatorischen Rahmenbedingungen zweckmäßigen Aufgaben- und Funktionstrennungen. Bei kleineren Unternehmen mit flacher Hierarchie sind High-Level-Kontrollen durch die Geschäftsleitung typisch; das IKS ist dann eng gefasst und nicht mit dem Umfang großer Kapitalgesellschaften vergleichbar.

[3] Stichprobenartige Kontrollen des Entgegennahme-, Identifikations- und Ablageprozesses im Vorfeld der buchungs- oder aufzeichnungstechnischen Verarbeitung obliegen der Geschäftsleitung (**{{answers.gf | or "nicht angegeben"}}**) bzw. einer von ihr benannten Stelle.

[4] Zu den Kontrollen gehören insbesondere auch die Kontrollverfahren, die gem. § 14 Abs. 1 UStG auf die Prüfung der eingehenden Rechnungen im Hinblick auf die Echtheit der Herkunft, die Unversehrtheit des Inhalts sowie die Lesbarkeit ausgerichtet sind (verlässlicher Prüfpfad zwischen Rechnung und Leistung).

[5] Stichprobenartige Kontrollen des Archivierungs-, Lesbarkeits- und Lesbarmachungsprozesses sowie des Vernichtungs-/Löschprozesses obliegen der Geschäftsleitung bzw. der IT-Verantwortung (**{{answers.it | or "nicht angegeben"}}**), soweit benannt.

[6] Bei Bedarf, insbesondere in der Einarbeitungsphase, finden die Kontrollen in kürzeren Abständen statt. Kommt es zu auffälligen Ergebnissen oder Abweichungen zwischen beschriebenem und tatsächlichem Verfahren, werden die laufenden Prozesse angehalten und die Geschäftsleitung informiert. Über solche Ereignisse ist ein Protokoll mit Angaben zum Anlass und zu den Maßnahmen anzufertigen.

[7] Die Kontrollen orientieren sich unter Ordnungsmäßigkeitsgesichtspunkten insbesondere daran, dass die gesetzlichen Bestimmungen beachtet werden, Kompetenz- und Zuständigkeitsregelungen eingehalten werden, Dokumente nicht unbefugt vernichtet, verändert oder gelöscht werden (Integrität), Parameter der Archivierungsverfahren nicht unbemerkt verändert werden und die IT-Systeme sowie die archivierten Dokumente bei Bedarf unverzüglich verfügbar und lesbar sind.

## 3.4 Datenschutz

[1] Der Datenschutz wird berücksichtigt, indem Unbefugte keinen Zugriff auf Daten bei der Entgegennahme, Bearbeitung, der Aufbewahrung, dem Transport und der Vernichtung haben. Zugriffsrechte richten sich nach dem im Intake angegebenen Zugriffskonzept (**{{answers.zugriff | or "nicht angegeben"}}**).

[2] Bei der Vernichtung von Papierbelegen und der Löschung digitaler Bestände werden datenschutzrechtliche Aspekte berücksichtigt, insbesondere indem personenbezogene Angaben vollständig und unwiederbringlich vernichtet bzw. gelöscht werden — jedoch nicht vor Ablauf der steuer- und handelsrechtlichen Aufbewahrungsfristen, soweit diese Vorrang haben.

[3] Diese Kurzdarstellung ersetzt keine gesonderte Datenschutzdokumentation (Verzeichnis von Verarbeitungstätigkeiten, TOMs etc.). Soweit erforderlich, sind entsprechende Unterlagen unter „Mitgeltende Unterlagen“ zu führen.

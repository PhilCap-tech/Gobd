---
title: "IT-Verfahrensdokumentation: Systeme, Schnittstellen und Datenzugriff beschreiben"
slug: "it-verfahrensdokumentation"
metaTitle: "IT-Verfahrensdokumentation: Systeme und Schnittstellen"
metaDescription: "IT-Verfahrensdokumentation: Systemübersicht, Schnittstellen, Datensicherung und Datenzugriff in der Betriebsprüfung beschreiben. Keine Steuerberatung."
h1: "IT-Verfahrensdokumentation: Systeme, Schnittstellen und Datenzugriff beschreiben"
date: "2026-11-25"
stand: "2026-11-25"
primaryKeyword: "IT-Verfahrensdokumentation"
secondaryKeywords:
  - "Verfahrensdokumentation IT"
  - "IT Verfahrensdokumentation"
  - "technische Systemdokumentation"
  - "IT-Dokumentation GoBD"
  - "Systemübersicht Verfahrensdokumentation"
ctaSoft: "/ampel-check"
ctaPrimary: "/checkout"
status: "ready-for-publish"
quellen:
  - "§ 146 AO — https://www.gesetze-im-internet.de/ao_1977/__146.html"
  - "§ 147 AO — https://www.gesetze-im-internet.de/ao_1977/__147.html"
  - "GoBD, BMF-Schreiben vom 28.11.2019 i. d. F. vom 14.07.2025, Rz. 20, 21, 100, 101, 103, 104, 106, 151, 153, 154, 155, 158, 159, 160, 161 — https://ao.bundesfinanzministerium.de/ao/2026/Anhaenge/BMF-Schreiben-und-gleichlautende-Laendererlasse/Anhang-33/anhang-33.html"
---

# IT-Verfahrensdokumentation: Systeme, Schnittstellen und Datenzugriff beschreiben

Mit IT-Verfahrensdokumentation ist meist der Teil der Verfahrensdokumentation gemeint, der die eingesetzten Programme, ihre Verbindungen und ihren Betrieb beschreibt. Wird die Verfahrensdokumentation im Rahmen einer [Verfahrensdokumentation Betriebsprüfung](/blog/betriebspruefung-ablauf-unterlagen) angefordert, zeigt dieser Teil, wie die Systeme zusammenarbeiten und wo welche Daten liegen. Der Beitrag richtet sich an kleine und mittlere Betriebe, auch wenn ein externer Dienstleister die Technik betreut.

**Kurz:** Die IT-Verfahrensdokumentation nennt alle Systeme mit steuerlich relevanten Daten, beschreibt die Schnittstellen und Datenflüsse, hält Versionen und Änderungen fest und erklärt Datensicherung, Zugriffsschutz und die Bereitstellung der Daten für die Außenprüfung. Sie ist kein eigenes Dokument neben der Verfahrensdokumentation, sondern ein Teil davon.

> **Keine Steuerberatung.** Dieser Text ist eine allgemeine Arbeitshilfe. Fragen zu Ihren Systemen und deren steuerlicher Einordnung klären Sie mit Ihrer Steuerberatung.

## Was mit IT-Verfahrensdokumentation gemeint ist

Die GoBD verwenden den Begriff IT-Verfahrensdokumentation nicht. Sie verlangen für jedes DV-System eine übersichtlich gegliederte Verfahrensdokumentation, aus der Inhalt, Aufbau, Ablauf und Ergebnisse des DV-Verfahrens vollständig und schlüssig ersichtlich sind (GoBD, BMF-Schreiben vom 28.11.2019 in der Fassung vom 14.07.2025, Rz. 151). Der Umfang richtet sich danach, was zum Verständnis des Verfahrens, der Bücher und der aufbewahrten Unterlagen notwendig ist. Die Dokumentation muss für einen sachverständigen Dritten in angemessener Zeit nachprüfbar sein; ihre Ausgestaltung hängt von der Komplexität des Unternehmens und des eingesetzten DV-Systems ab.

In der Regel besteht die Verfahrensdokumentation aus einer allgemeinen Beschreibung, einer Anwenderdokumentation, einer technischen Systemdokumentation und einer Betriebsdokumentation (GoBD Rz. 153). Der IT-Teil liegt vor allem in den beiden letzten Teilen. Welche Punkte zu allen vier Teilen gehören, zeigt die [Verfahrensdokumentation Checkliste](/blog/verfahrensdokumentation-checkliste); den Aufbau des Ganzen erläutert der Beitrag [GoBD Verfahrensdokumentation](/blog/gobd-verfahrensdokumentation-erstellen).

## Systemübersicht: welche Systeme dazugehören

Unter einem DV-System verstehen die GoBD die im Unternehmen oder für Unternehmenszwecke eingesetzte Hard- und Software, mit der steuerlich relevante Daten und Dokumente erfasst, erzeugt, empfangen, übernommen, verarbeitet, gespeichert oder übermittelt werden (GoBD Rz. 20). Dazu gehören das Hauptsystem sowie Vor- und Nebensysteme, etwa Finanzbuchführung, Lohnbuchhaltung, Kassensystem, Warenwirtschaft, Zahlungsverkehr, Fakturierung, Zeiterfassung, Archivsystem oder [Dokumenten-Management-System](/blog/verfahrensdokumentation-dms), einschließlich der Schnittstellen zwischen den Systemen. Auf Bezeichnung und Größe kommt es nicht an, ebenso wenig darauf, ob die Programme auf eigener Hardware oder in einer Cloud betrieben werden.

Eine Systemübersicht kann als Tabelle geführt werden. Zu jedem System gehören:

- Zweck und die Daten, die dort entstehen oder gespeichert werden,
- Betreiber und Speicherort, zum Beispiel eigener Server, Rechenzentrum oder Cloud,
- eingesetzte Version oder Stand,
- verantwortliche Person und Vertretung,
- Aufbewahrung der Daten und Weg zu älteren Beständen.

Passende Fragen enthält [Modul 17 Systeme und Datenübertragung](/muster/modul/m17/fragebogen).

## Schnittstellen und Datenflüsse beschreiben

Zwischen den Systemen fließen Daten: über einen Import oder Export, über eine automatische Übertragung oder über einen manuellen Upload. Beschreiben Sie für jede Verbindung, welche Daten in welchem Rhythmus übertragen werden, wer die Übertragung anstößt und wer prüft, ob sie vollständig angekommen ist. Zu den Kontrollen, die einzurichten, auszuüben und zu protokollieren sind, zählen unter anderem Abstimmungskontrollen bei der Dateneingabe und Verarbeitungskontrollen (GoBD Rz. 100). Halten Sie auch fest, was bei einer fehlgeschlagenen Übertragung geschieht und wer sie nachholt.

Beispiel (fiktiv):

- Kasse → täglicher Abschluss → Monatsexport an die Buchhaltung; die Inhaberin gleicht die Summen ab.
- Onlineshop → Rechnungsprogramm → wöchentlicher Export an die Buchhaltung; ein Mitarbeiter prüft die Anzahl der Rechnungen.
- Bank → automatischer Abruf der Umsätze in das Buchhaltungsprogramm.

Wie die übernommenen Daten in der Finanzbuchhaltung weiterverarbeitet werden, beschreibt die [Verfahrensdokumentation Buchhaltung](/blog/verfahrensdokumentation-buchhaltung).

## Versionen, Änderungen und Systemwechsel

Für die Dauer der Aufbewahrungsfrist muss gewährleistet und nachgewiesen sein, dass das beschriebene Verfahren dem in der Praxis eingesetzten Verfahren voll entspricht, insbesondere bei den eingesetzten Versionen der Programme (Programmidentität; GoBD Rz. 154). Änderungen der Verfahrensdokumentation müssen historisch nachvollziehbar sein; dem wird genügt, wenn sie versioniert sind und eine nachvollziehbare Änderungshistorie vorgehalten wird. Die Verfahrensdokumentation selbst ist so lange aufzubewahren, wie die Unterlagen aufzubewahren sind, zu deren Verständnis sie erforderlich ist.

Anlassbezogen, zum Beispiel bei einem Systemwechsel, ist zu prüfen, ob das eingesetzte DV-System tatsächlich dem dokumentierten System entspricht (GoBD Rz. 101). Bei Cloud-Programmen, die laufend aktualisiert werden, ist es praktikabel, nicht jedes einzelne Update aufzuführen, sondern Datum und Inhalt der Änderungen festzuhalten, die das beschriebene Verfahren betreffen. Wie Sie einen Programmwechsel festhalten, zeigt [Verfahrensdokumentation nach einem Systemwechsel](/blog/verfahrensdokumentation-systemwechsel); wie die Dokumentation laufend gepflegt wird, erläutert [Verfahrensdokumentation aktualisieren](/blog/verfahrensdokumentation-aktualisieren). Fragen dazu enthält [Modul 23 System- und Prozessänderungen](/muster/modul/m23/fragebogen).

## Betrieb: Datensicherung und Zugriffsschutz

Das DV-System ist gegen Verlust zu sichern, etwa gegen Unauffindbarkeit, Vernichtung, Untergang und Diebstahl, und gegen unberechtigte Eingaben und Veränderungen zu schützen, zum Beispiel durch Zugangs- und Zugriffskontrollen (GoBD Rz. 103). Können Daten wegen unzureichenden Schutzes nicht mehr vorgelegt werden, ist die Buchführung formell nicht mehr ordnungsmäßig (GoBD Rz. 104). Die Beschreibung der Vorgehensweise zur Datensicherung ist Bestandteil der Verfahrensdokumentation (GoBD Rz. 106). Werden Bücher und Aufzeichnungen auf Datenträgern geführt, muss sichergestellt sein, dass die Daten während der Aufbewahrungsfrist jederzeit verfügbar sind und unverzüglich lesbar gemacht werden können (§ 146 Abs. 5 Satz 2 AO).

Eine Gliederung für dieses Kapitel bietet die [Vorlage für Datensicherung und Archivierung](/blog/verfahrensdokumentation-vorlage-datensicherung-archivierung); Rollen und Rechte halten Sie mit der [Checkliste zu Zugriffsrechten und Rollen](/blog/verfahrensdokumentation-checkliste-zugriffsrechte-rollen) fest. Fragen dazu enthalten [Modul 18 Zugriffsrechte und Datensicherheit](/muster/modul/m18/fragebogen) und [Modul 19 Sicherung, Wiederherstellung und Notfälle](/muster/modul/m19/fragebogen).

Nach § 147 Abs. 3 Satz 1 AO in der Fassung nach dem Vierten Bürokratieentlastungsgesetz sind Bücher und Aufzeichnungen unter anderem zehn Jahre, Buchungsbelege acht Jahre und sonstige Unterlagen sechs Jahre aufzubewahren; Einzelheiten erläutert der Beitrag [Aufbewahrungsfristen GoBD](/blog/aufbewahrungsfristen-gobd).

## IT-Verfahrensdokumentation in der Betriebsprüfung: Datenzugriff

Sind die Unterlagen mit Hilfe eines Datenverarbeitungssystems erstellt worden, kann die Finanzbehörde im Rahmen einer Außenprüfung auf die Daten zugreifen (§ 147 Abs. 6 AO): durch Einsicht und Nutzung des Systems, durch eine maschinelle Auswertung nach ihren Vorgaben oder durch Übertragung der Daten in einem maschinell auswertbaren Format. Die drei Formen erläutert der Beitrag [Verfahrensdokumentation Betriebsprüfung: Datenzugriff](/blog/datenzugriff-betriebspruefung).

Das Recht auf Datenzugriff besteht nur im Rahmen der gesetzlichen Regelungen, etwa bei Außenprüfungen und Nachschauen; der sachliche Umfang der Außenprüfung wird dadurch nicht erweitert (GoBD Rz. 158). Bereitzustellen sind insbesondere die Daten der Finanzbuchhaltung, der Anlagenbuchhaltung, der Lohnbuchhaltung und aller Vor- und Nebensysteme, die aufzeichnungs- und aufbewahrungspflichtige Unterlagen enthalten (GoBD Rz. 159).

Für die IT-Verfahrensdokumentation ist Rz. 160 wichtig: Neben den Daten müssen auf Verlangen auch die Teile der Verfahrensdokumentation zur Verfügung gestellt werden können, die einen vollständigen Systemüberblick ermöglichen und für das Verständnis des DV-Systems erforderlich sind, zum Beispiel Beschreibungen zu Tabellen, Feldern, Verknüpfungen und Auswertungen. Dafür hat der Steuerpflichtige die betroffenen Systeme zu identifizieren, die darin enthaltenen Daten nach den Aufzeichnungs- und Aufbewahrungspflichten zu qualifizieren und für den Datenzugriff in geeigneter Weise vorzuhalten (GoBD Rz. 161). Fragen dazu enthält [Modul 22 Prüfungszugriff und Datenbereitstellung](/muster/modul/m22/fragebogen).

Soweit eine fehlende oder ungenügende Verfahrensdokumentation die Nachvollziehbarkeit und Nachprüfbarkeit nicht beeinträchtigt, liegt kein formeller Mangel mit sachlichem Gewicht vor, der zum Verwerfen der Buchführung führen kann (GoBD Rz. 155). Es kommt also vor allem darauf an, dass die Beschreibung nachvollziehbar ist und zur Praxis passt.

## IT-Dienstleister und Cloud-Anbieter

Für die Ordnungsmäßigkeit der elektronischen Bücher und Aufzeichnungen einschließlich der eingesetzten Verfahren ist allein der Steuerpflichtige verantwortlich, auch wenn Aufgaben ganz oder teilweise auf Dritte wie Steuerberater oder Rechenzentrum ausgelagert sind (GoBD Rz. 21). Halten Sie deshalb fest, wer welches System betreibt, wo die Daten liegen, wer Sicherungen und Exporte erstellt und wer Ihr Ansprechpartner ist. Unterlagen des Dienstleisters können Sie als Anlage aufnehmen oder auf sie verweisen; Ihre eigene Beschreibung sollte trotzdem erkennen lassen, wie die Systeme in Ihrem Betrieb tatsächlich eingesetzt werden. Fragen dazu enthält [Modul 21 Ausgelagerte Aufgaben](/muster/modul/m21/fragebogen).

## Checkliste: IT-Verfahrensdokumentation

Die folgenden Punkte gehören in den IT-Teil, wenn sie bei Ihnen zutreffen.

- [ ] Alle Systeme mit steuerlich relevanten Daten sind in einer Übersicht benannt, einschließlich Vor- und Nebensystemen.
- [ ] Zu jedem System sind Zweck, Daten, Betreiber, Speicherort und verantwortliche Person genannt.
- [ ] Eingesetzte Versionen oder der jeweilige Stand sind festgehalten.
- [ ] Jede Schnittstelle ist mit Datenart, Rhythmus und Auslöser beschrieben.
- [ ] Für jede Übertragung ist benannt, wer die Vollständigkeit prüft und wie Fehler behoben werden.
- [ ] Relevante Programmänderungen sind mit Datum in einer Änderungshistorie erfasst.
- [ ] Die Verfahrensdokumentation ist versioniert; frühere Fassungen sind aufbewahrt.
- [ ] Datensicherung und Wiederherstellung sind beschrieben, mit Verweis auf das Kapitel zur Datensicherung.
- [ ] Zugangs- und Zugriffsrechte sind mit Verweis auf das Berechtigungskonzept beschrieben.
- [ ] Für den Datenzugriff ist festgehalten, wer Exporte erstellt und welche Beschreibungen zu Tabellen und Feldern vorliegen.
- [ ] Externe Dienstleister und Cloud-Anbieter sind mit Aufgaben und Ansprechpartnern genannt.
- [ ] Der Zugang zu Daten früherer Jahre ist auch nach einem Systemwechsel beschrieben.

## Wo stehen Sie?

Die kostenlose [GoBD-Ampel](/ampel-check) zeigt Ihnen in wenigen Fragen, ob Ihr Unternehmen die GoBD-Anforderungen erfüllt und wo noch offene Punkte liegen. Sie ist eine Orientierung und keine Steuerberatung.

## Verfahrensdokumentation online erstellen

Auf [gobd-doku-erstellen.de](/) entsteht aus Ihren Antworten eine individuelle Verfahrensdokumentation als PDF und eine Liste offener Punkte, mit Stand-Datum. Der Einstieg ist der kurze Betriebs-Check; die Module füllen Sie danach in Etappen aus. Der Zwischenstand wird gespeichert, offene Module erscheinen als To-dos in Ihrem Konto, und „Später ausfüllen“ ist möglich.

Wo Sie heute stehen, zeigt der kostenlose [Readiness-Check](/readiness).

## Häufige Fragen

### Ist die IT-Verfahrensdokumentation ein eigenes Dokument?

Nein, eine feste Form gibt es nicht. Der IT-Teil gehört zur Verfahrensdokumentation und kann dort ein eigenes Kapitel oder eine Anlage sein. Entscheidend ist, dass ein sachverständiger Dritter das Verfahren in angemessener Zeit nachvollziehen kann (GoBD Rz. 151).

### Muss jedes Programm-Update dokumentiert werden?

Nachgewiesen sein muss, dass das beschriebene Verfahren dem eingesetzten entspricht, insbesondere bei den Programmversionen, und Änderungen müssen historisch nachvollziehbar sein (GoBD Rz. 154). In der Praxis halten Sie die Änderungen fest, die das beschriebene Verfahren betreffen, und vermerken Datum und Inhalt.

### Reicht die Dokumentation des IT-Dienstleisters?

Sie kann ein Baustein sein. Die Verantwortung für die Ordnungsmäßigkeit bleibt aber beim Unternehmen (GoBD Rz. 21). Beschreiben Sie deshalb selbst, wie die Systeme in Ihrem Betrieb eingesetzt werden, und verweisen Sie für technische Einzelheiten auf die Unterlagen des Dienstleisters.

### Was braucht die Prüferin oder der Prüfer für den Datenzugriff?

Neben den Daten auf Verlangen die Teile der Verfahrensdokumentation, die einen vollständigen Systemüberblick ermöglichen und für das Verständnis des DV-Systems erforderlich sind, zum Beispiel Beschreibungen zu Tabellen, Feldern, Verknüpfungen und Auswertungen (GoBD Rz. 160).

> Keine Steuer-, Rechts- oder Prüfungsberatung. Dieser Artikel ist eine allgemeine Arbeitshilfe und ersetzt keine Prüfung durch Ihre Steuerberatung. Keine Zusicherung zu Prüfungsergebnissen.

## Weiterlesen

- [Verfahrensdokumentation Betriebsprüfung: Datenzugriff](/blog/datenzugriff-betriebspruefung)
- [Vorlage: Kapitel Datensicherung und Archivierung](/blog/verfahrensdokumentation-vorlage-datensicherung-archivierung)
- [Verfahrensdokumentation nach einem Systemwechsel](/blog/verfahrensdokumentation-systemwechsel)
- [Verfahrensdokumentation Betriebsprüfung: Ablauf und Unterlagen](/blog/betriebspruefung-ablauf-unterlagen)

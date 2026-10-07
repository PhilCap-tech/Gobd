---
title: "Verfahrensdokumentation Checkliste: Internes Kontrollsystem (IKS)"
slug: "internes-kontrollsystem-verfahrensdokumentation"
metaTitle: "Verfahrensdokumentation Checkliste: Internes Kontrollsystem"
metaDescription: "Verfahrensdokumentation Checkliste zum internen Kontrollsystem (IKS): Rechte, Abstimmungen, Sicherung und Änderungen. Keine Steuerberatung."
h1: "Verfahrensdokumentation Checkliste: Internes Kontrollsystem (IKS)"
primaryKeyword: "Verfahrensdokumentation Checkliste"
secondaryKeywords:
  - "Internes Kontrollsystem GoBD"
  - "IKS Verfahrensdokumentation"
  - "GoBD Kontrollen Verfahrensdokumentation"
ctaSoft: "/readiness"
ctaPrimary: "/"
status: "ready-for-publish"
date: "2026-10-07"
---

# Verfahrensdokumentation Checkliste: Internes Kontrollsystem (IKS)

Diese **Verfahrensdokumentation Checkliste** betrifft nur das interne Kontrollsystem, kurz IKS. Gemeint sind die Kontrollen, mit denen Sie in einem kleinen Betrieb prüfen, ob Belege vollständig ankommen, Rechte passen, Abstimmungen aufgehen und Änderungen nachvollziehbar bleiben. Die Checkliste über alle vier Teile der Dokumentation — allgemeine Beschreibung, Anwender-, Technik- und Betriebsteil — steht im Artikel [Verfahrensdokumentation Checkliste](/blog/verfahrensdokumentation-checkliste). Den Übersichtsartikel schreiben Sie hier nicht neu. Hier fehlt nur der Block zum IKS.

**Kurz:** Die GoBD verlangen, Kontrollen einzurichten, auszuüben und zu protokollieren. Wie weitgehend, hängt von der Größe des Betriebs und vom System ab. Unten stehen Punkte, die Sie nur abhaken, wenn sie bei Ihnen so laufen: Zugriffsrechte, Funktionstrennung soweit möglich, Vier-Augen-Freigabe, Plausibilität und Abstimmung, Schutz vor Veränderung, Datensicherung, Änderungen an Software und Stammdaten. Abhaken heißt nicht, dass eine Prüfung ein bestimmtes Ergebnis hat.

> **Keine Steuerberatung.** Dieser Text und alle Ergebnisse unter gobd-doku-erstellen.de sind allgemeine Arbeitshilfen. Sie ersetzen keine Prüfung oder Freigabe durch Steuerberater, Wirtschaftsprüfer oder Rechtsanwalt.

## Was die GoBD zum internen Kontrollsystem sagen

Grundlage ist das BMF-Schreiben vom 28.11.2019, geändert am 11.03.2024 und am 14.07.2025. Die Änderungsschreiben vom 11.03.2024 und vom 14.07.2025 fassen die Randziffern 100 bis 102 nicht neu.

Randziffer 100: Zur Einhaltung der Ordnungsvorschriften des § 146 AO hat der Steuerpflichtige Kontrollen einzurichten, auszuüben und zu protokollieren. Als Beispiele nennt das Schreiben Zugangs- und Zugriffsberechtigungskontrollen, Funktionstrennungen, Erfassungskontrollen (Fehlerhinweise, Plausibilitätsprüfungen), Abstimmungskontrollen bei der Dateneingabe, Verarbeitungskontrollen sowie Schutzmaßnahmen gegen die beabsichtigte und unbeabsichtigte Verfälschung von Programmen, Daten und Dokumenten. Die konkrete Ausgestaltung hängt von der Komplexität und Diversifikation der Geschäftstätigkeit, der Organisationsstruktur und dem eingesetzten DV-System ab.

Randziffer 101: Anlassbezogen, zum Beispiel bei einem Systemwechsel, ist zu prüfen, ob das eingesetzte DV-System tatsächlich dem dokumentierten System entspricht.

Randziffer 102: Die Beschreibung des IKS ist Bestandteil der Verfahrensdokumentation.

Zur Datensicherung sagen die GoBD in Randziffer 103, dass das DV-System gegen Verlust zu sichern und gegen unberechtigte Eingaben und Veränderungen zu schützen ist, zum Beispiel durch Zugangs- und Zugriffskontrollen. Randziffer 106: Die Beschreibung dieser Vorgehensweise ist ebenfalls Bestandteil der Verfahrensdokumentation, wieder abhängig von Komplexität, Organisation und System. Auch diese Randziffern sind in den beiden Änderungsschreiben nicht neu gefasst.

Nach § 146 Abs. 4 AO darf eine Buchung oder eine Aufzeichnung nicht so verändert werden, dass der ursprüngliche Inhalt nicht mehr feststellbar ist. Randziffer 107 der GoBD wiederholt das. Randziffer 108 verlangt, dass Informationen, die einmal in den Verarbeitungsprozess eingeführt sind — Beleg, Grundaufzeichnung, Buchung —, nicht mehr unterdrückt oder ohne Kenntlichmachung überschrieben, gelöscht, geändert oder verfälscht werden können.

Ein Ein-Personen-Betrieb richtet nicht dieselben Kontrollen ein wie ein Betrieb mit Buchhaltung, Kasse und Lager. Die GoBD sagen das in Randziffer 100 selbst: Die Ausgestaltung folgt der Organisation. Was Sie nicht tun, haken Sie nicht ab. Sie schreiben in einem Satz, warum der Punkt entfällt.

## Verfahrensdokumentation Checkliste: IKS im kleinen Betrieb

Haken Sie nur ab, was bei Ihnen so läuft. Alles andere ist ein offener Punkt, keine erfundene Kontrolle. Fiktive Fragebögen, keine Beschreibung Ihres Betriebs: [Modul 20 Kontrollen und Fehlerbehandlung](/muster/modul/m20/fragebogen) (PDF). Die Übersicht der Beispiele: [Muster](/muster). Branchenbeispiele, ebenfalls fiktiv: [Dienstleister](/muster/gesamt/dienstleister), [Handwerk](/muster/gesamt/handwerk), [Gastronomie](/muster/gesamt/gastro).

### Zugriffsrechte und Rollen

Wer lesen, buchen, freigeben, exportieren, löschen und Rechte vergeben darf, gehört in die Beschreibung. Dazu die Vertretung und der Entzug, wenn jemand ausscheidet.

- [ ] Rollen benannt: wer bucht, wer freigibt, wer exportiert, wer Rechte vergibt
- [ ] Vergabe und Entzug beschrieben, einschließlich Ausscheiden
- [ ] Gemeinsame Zugänge oder ein Passwort für mehrere Personen als offener Punkt markiert, falls das noch so ist
- [ ] Nur-Lese-Zugang für eine Außenprüfung einer Rolle zugeordnet, nicht „irgendwer in der IT“

Zum Abgleich der Rechte: [Modul 18 Zugriffsrechte und Datensicherheit](/muster/modul/m18/fragebogen) (PDF). Wie die Finanzbehörde an die Daten kommt und wer den Zugang einrichtet: [Datenzugriff in der Betriebsprüfung](/blog/datenzugriff-betriebspruefung).

### Funktionstrennung, soweit sie möglich ist

Randziffer 100 nennt Funktionstrennungen als Beispiel, nicht als Schema, das jeder Betrieb in voller Breite vorhält. Wo nur eine Person bucht und freigibt, schreiben Sie das. Eine erfundene zweite Person ist kein IKS.

- [ ] Getrennte Rollen dort, wo zwei Personen den Vorgang tatsächlich teilen (erfassen und freigeben, bestellen und zahlen)
- [ ] Im Ein-Personen-Betrieb festgehalten, dass eine Person mehrere Schritte macht
- [ ] Ausgleich benannt, den Sie wirklich nutzen: späterer Abgleich durch die Kanzlei, Durchsicht der eigenen Buchungen in einem festen Turnus, oder bewusst als offen markiert
- [ ] Keine Funktion im Text, die es im Betrieb nicht gibt

### Vier-Augen-Freigabe

Ein zweites Paar Augen ist eine betriebliche Kontrolle, keine eigene Randziffer der GoBD. Sinnvoll ist sie dort, wo zwei Personen verfügbar sind und der Vorgang es trägt: Zahlung ab einem Betrag, den Sie selbst festlegen, Änderung einer Bankverbindung, Vernichtung von Papier nach dem Scan.

- [ ] Vorgänge benannt, die eine zweite Person freigibt
- [ ] Betragsgrenze oder Anlass festgehalten, falls Sie eine nutzen
- [ ] Vertretung der zweiten Person benannt
- [ ] Wo keine zweite Person existiert: nicht als Vier-Augen beschrieben

Wie eine Eingangsrechnung geprüft und freigegeben wird, bleibt beim Belegfluss: [Verfahrensdokumentation Belegablage](/blog/verfahrensdokumentation-belegablage).

### Plausibilität und Abstimmung

Randziffer 100 nennt Erfassungskontrollen, darunter Plausibilitätsprüfungen, und Abstimmungskontrollen bei der Dateneingabe. Im kleinen Betrieb sind das oft konkrete Abgleiche, kein eigenes Kontrollsystem mit Handbuch.

- [ ] Kasse: Zählung oder Kassensturz gegen den Abschluss, soweit Sie eine Kasse führen
- [ ] Bank: Kontoauszug gegen die gebuchten Bewegungen, in dem Turnus, den Sie fahren
- [ ] Offene Posten: Liste gegen Zahlungseingänge, soweit Sie sie führen
- [ ] Kasse, Shop oder Warenwirtschaft gegen die Buchhaltung, soweit diese Systeme Daten übergeben
- [ ] Wer den Abgleich macht, wie oft, wo der Nachweis liegt (Vermerk, Protokoll, Liste)
- [ ] Abweichungen: wer sie klärt und wie die Klärung erkennbar bleibt

Systeme, aus denen die Zahlen kommen: [Modul 17 Systeme und Datenübertragung](/muster/modul/m17/fragebogen) (PDF).

### Schutz vor Veränderung und Protokollierung

§ 146 Abs. 4 AO und die Randziffern 107 und 108 verlangen, dass der ursprüngliche Inhalt feststellbar bleibt und dass eingeführte Informationen nicht ohne Kenntlichmachung überschrieben, gelöscht oder geändert werden. Die Verfahrensdokumentation beschreibt, wie das in Ihren Systemen geschieht. Die Beschreibung ersetzt nicht die Funktion der Software.

- [ ] Festschreibung oder eine vergleichbare Sperre benannt, soweit das System sie hat
- [ ] Korrekturen nur durch eine neue Buchung oder einen erkennbaren Vermerk, nicht durch stilles Überschreiben
- [ ] Protokoll oder Änderungsnachweis benannt, soweit das System eines führt
- [ ] Beleg und Buchung wieder auffindbar verbunden

Zur Ablage und zum Wiederfinden: [Modul 15 Archivierung und Wiederauffindbarkeit](/muster/modul/m15/fragebogen) (PDF).

### Datensicherung

Randziffer 103 und Randziffer 106: sichern, schützen, den Weg in der Verfahrensdokumentation beschreiben. Der Umfang folgt wieder der Größe des Betriebs. „Die Cloud sichert automatisch“ ohne Anbieter und ohne den Hinweis, wer eine Wiederherstellung anstößt, ist zu dünn.

- [ ] Was gesichert wird: Buchhaltung, Belegarchiv, Kasse, Vorsysteme, soweit dort aufbewahrungspflichtige Daten liegen
- [ ] Wer sichert, oder welcher benannte Anbieter
- [ ] Wie oft
- [ ] Wer eine Wiederherstellung anstößt
- [ ] Ob eine Wiederherstellung schon einmal geprüft wurde — wenn nein, als offener Punkt, nicht als erledigt

Fragen zur Sicherung: [Modul 19 Sicherung, Wiederherstellung und Notfälle](/muster/modul/m19/fragebogen) (PDF).

### Änderungen an Software und Stammdaten

Randziffer 101 verlangt die anlassbezogene Prüfung, ob das eingesetzte System noch dem dokumentierten entspricht, zum Beispiel nach einem Systemwechsel. Dieselbe Frage stellt sich bei einem Update, das Buchungslogik, Steuerschlüssel oder einen Export verändert, und bei Stammdaten, die Zahlungen oder Preise steuern.

- [ ] Wer ein Update freigibt, bevor es in der Buchhaltung oder an der Kasse läuft
- [ ] Wer Kunden-, Lieferanten- und Bankstammdaten ändert
- [ ] Änderung einer Bankverbindung: zweite Person oder ein anderer benannter Abgleich
- [ ] Nach dem Wechsel: Text, Version und Altdaten nachgezogen, nicht nur das Programm

Fragen zu Änderungen: [Modul 23 System- und Prozessänderungen](/muster/modul/m23/fragebogen) (PDF).

## Was Sie mit der Liste tun

Ein Haken ohne Nachweis im Betrieb ist derselbe Fehler wie eine Kontrolle, die nur im Muster stand. Die [Verfahrensdokumentation Checkliste](/blog/verfahrensdokumentation-checkliste) bleibt der Rahmen für die übrigen Teile. Diesen IKS-Block legen Sie daneben, nicht darüber.

- [ ] Nur Punkte abgehakt, die so laufen
- [ ] Entfallenes in einem Satz begründet, nicht mit einer erfundenen Rolle gefüllt
- [ ] Turnus, Rolle und Nachweis je Kontrolle, die Sie wirklich ausüben
- [ ] Offene Punkte in der Liste, nicht im Fließtext versteckt
- [ ] Stand mit Version und Datum, passend zur übrigen Dokumentation

Zum Sortieren der übrigen Kapitel: [Inhalt einer Verfahrensdokumentation](/resources/inhalt-verfahrensdokumentation) (PDF). Offene Punkte auf einer Seite: [10 Offene Punkte vor der Prüfung](/resources/10-offene-punkte) (PDF).

## Soft-CTA: Readiness-Check

Unsicher, ob Rollen, Systeme und Belegwege schon greifbar sind, bevor Sie Kontrollen beschreiben? Machen Sie den kostenlosen [Readiness-Check](/readiness): kurze Fragen zu Branche, Software, Belegwegen und Verantwortlichen — ohne Kreditkarte.

## Primär-CTA: Verfahrensdokumentation online erstellen

Wenn Sie den IKS-Abschnitt nicht in eine leere Datei schreiben möchten: [GoBD-Verfahrensdokumentation erstellen](/) — kurzes Intake, dann PDF und Offene-Punkte-Liste. Ca. 5–8 Minuten für den Einstieg. Keine Steuerberatung.

## FAQ

### Was sagen die GoBD zum internen Kontrollsystem?

Randziffer 100 verlangt, Kontrollen einzurichten, auszuüben und zu protokollieren, damit die Ordnungsvorschriften des § 146 AO eingehalten werden. Die Beispiele reichen von Zugriffsrechten über Funktionstrennung und Plausibilitäts- sowie Abstimmungskontrollen bis zum Schutz vor Verfälschung. Die Ausgestaltung hängt vom Betrieb und vom System ab. Randziffer 102: Die Beschreibung gehört in die Verfahrensdokumentation. Die Randziffern 100 bis 102 stammen aus dem BMF-Schreiben vom 28.11.2019 und sind am 11.03.2024 und am 14.07.2025 nicht neu gefasst worden.

### Braucht ein Ein-Personen-Betrieb eine Funktionstrennung?

Nur soweit sie möglich ist. Randziffer 100 macht die Ausgestaltung von der Organisation abhängig. Beschreiben Sie, dass eine Person mehrere Schritte ausführt, und den Ausgleich, den Sie tatsächlich nutzen. Eine zweite Person, die es nicht gibt, gehört nicht in den Text.

### Ersetzt diese Liste die Verfahrensdokumentation Checkliste?

Nein. Die [Verfahrensdokumentation Checkliste](/blog/verfahrensdokumentation-checkliste) deckt die vier üblichen Teile ab. Dieser Artikel ist nur der Block zum IKS. Belegwege bleiben bei der [Belegablage](/blog/verfahrensdokumentation-belegablage), der Datenzugriff bei [Datenzugriff in der Betriebsprüfung](/blog/datenzugriff-betriebspruefung).

### Muss jede Kontrolle ein Protokoll haben?

Randziffer 100 verlangt, Kontrollen zu protokollieren. Wie das aussieht, sagt das Schreiben nicht in einer festen Form vor. Ein Vermerk, eine abgelegte Abstimmungsliste oder ein Systemprotokoll kann genügen, wenn Sie den Nachweis wiederfinden. Was Sie nicht protokollieren, haken Sie nicht als protokolliert ab.

### Sagt eine ausgefüllte IKS-Liste etwas über das Ergebnis einer Prüfung?

Nein. Sie hält fest, welche Kontrollen Sie eingerichtet haben und welche noch offen sind. Ein Haken ist keine Freigabe und keine Auskunft über eine Außenprüfung.

## Weiterlesen

- [Verfahrensdokumentation Checkliste](/blog/verfahrensdokumentation-checkliste) — der Rahmen, dieser Artikel ist nur das IKS
- [Datenzugriff in der Betriebsprüfung](/blog/datenzugriff-betriebspruefung) — Lesezugang, Export und wer ihn einrichtet
- [Verfahrensdokumentation Belegablage](/blog/verfahrensdokumentation-belegablage) — Prüfung und Freigabe im Belegfluss

## Disclaimer

Der Dienst unter gobd-doku-erstellen.de (Anbieter: IKAT GmbH) unterstützt Sie bei der Erstellung einer Verfahrensdokumentation im Sinne der GoBD. Die bereitgestellten Texte, Vorlagen und Ausgaben sind allgemeine Arbeitshilfen und stellen **keine Steuerberatung**, **keine Rechtsberatung** und keine verbindliche Auskunft dar.

Es kommt kein Steuerberatungs- und kein Anwaltsvertrag zustande. Ob und in welchem Umfang eine Verfahrensdokumentation für Ihr Unternehmen erforderlich oder ausreichend ist, hängt von Ihrer konkreten Situation ab. Eine Prüfung oder Freigabe durch Steuerberater, Wirtschaftsprüfer oder Rechtsanwalt ersetzen wir nicht.

Sie bleiben für die inhaltliche Richtigkeit, Vollständigkeit und Aktualität der erzeugten Dokumentation sowie für deren Verwendung gegenüber Finanzverwaltung oder Dritten selbst verantwortlich. Wir übernehmen keine Gewähr dafür, dass die erzeugte Dokumentation in einem konkreten Prüfungsfall als ausreichend anerkannt wird. Dieser Artikel enthält keine Zusicherung zu Prüfungsergebnissen. Siehe auch die [FAQ](/faq).

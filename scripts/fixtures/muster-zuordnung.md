# #344 Recheck – Zuordnungstabelle Musterantwort ↔ Frage (Head 508e364)

Quelle: `getGesamtMuster(vorlage).answers.katalog`, Status „bestaetigt“, verbunden mit Frage-Titel, Fragetext und Feldlabels aus `lib/module/fragen.ts` und `lib/bereiche.ts`. Erzeugt lokal am 17.11.2026, kein Netz, keine Secrets. Fragen des alten Katalogs (A01–I05, 130 Einträge) haben keine Modulfrage und sind hier nicht enthalten.

Zeilen: 1027. Davon falsch: 10, teilweise: 15.

| Muster | Frage-ID | Frage | Antwort-Anfang | Urteil |
|---|---|---|---|---|
| dienstleister | VK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nora Klar (Geschäftsführung) / Vertretung=Felix Hahn (Büro)… | ok |
| dienstleister | VK01 | Ablauf und System | Ablauf=Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst… | ok |
| dienstleister | VK02 | Angebote und Aufträge | System=Faktura+ (fiktiv) / Ablage=Am Projekt in Faktura+… | ok |
| dienstleister | VK03 | Preise und Konditionen | Wer legt fest=Nora Klar / Wer gibt Sonderkonditionen frei=Nora Klar bei Rabatten über 10 Prozent… | ok |
| dienstleister | VK04 | Kundenstammdaten | Wer pflegt=Felix Hahn / Änderungen werden protokolliert=ja… | ok |
| dienstleister | VK05 | Rechnungsnummern | Vergabe=Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer / Nummernkreise=Ein Nummernkrei… | ok |
| dienstleister | VK06 | Pflichtangaben | Vorlage und Prüfung=Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem P… | ok |
| dienstleister | VK07 | Rechnungsversand | Format=PDF per E-Mail, XRechnung / E-Rechnungen können versendet werden=ja… | ok |
| dienstleister | VK08 | Korrektur und Storno | Ablauf=Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kei… | ok |
| dienstleister | VK09 | Offene Posten und Mahnwesen | Wer=Felix Hahn / Turnus=wöchentlich; Mahnung nach 14 Tagen Verzug… | ok |
| dienstleister | VK10 | Übergabe an die Buchhaltung | Weg der Übergabe=Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen onli… | ok |
| dienstleister | VK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Leistungen der Agentur an Geschäftskunden. / Ausgenommen und wo dokument… | ok |
| dienstleister | VK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen on… | ok |
| dienstleister | VK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Lückenprüfung der Rechnungsnummern, Abgleich erbrachter Leistungen mit gestellten Rec… | ok |
| dienstleister | VK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| dienstleister | VK94 | Änderungsmanagement | Wer gibt Änderungen frei=Nora Klar / Dokumentation der Änderungen=Änderungen an Rechnungsvorlage, Nummernkreis… | ok |
| dienstleister | EK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Einkaufsleitung (Murat Aydin) / Vertretung=Eva Lindner… | ok |
| dienstleister | EK01 | Bedarfsmeldung | Ablauf=Bedarf entsteht aus Mindestbeständen im ERP und aus Fertigungsaufträgen; Abteilungen melden Sonderbedar… | ok |
| dienstleister | EK02 | Bestellberechtigung | Wer bestellt=Einkauf / Freigabegrenzen=bis 5.000 Euro Einkauf allein; darüber Freigabe / Wer gibt frei=Eva Lin… | ok |
| dienstleister | EK03 | Bestellweg | Bestellwege=ERP / Warenwirtschaft, Lieferantenportal, E-Mail / System=ERP Fertigplan (fiktiv)… | ok |
| dienstleister | EK04 | Auftragsbestätigung | Wer prüft=Einkauf / Umgang mit Abweichungen=Abweichungen bei Preis oder Termin werden im ERP vermerkt und mit … | ok |
| dienstleister | EK05 | Wareneingang und Leistungsnachweis | Ablauf=Wareneingang im ERP gegen die Bestellung; Dienstleistungen bestätigt die anfordernde Abteilung im ERP. … | ok |
| dienstleister | EK06 | Abgleich Bestellung, Lieferung, Rechnung | Ablauf=Rechnung wird im ERP der Bestellung und dem Wareneingang zugeordnet; Abweichungen über 2 Prozent gehen … | ok |
| dienstleister | EK07 | Lieferantenstammdaten | Wer pflegt=Einkauf legt an, Buchhaltung bestätigt Bankdaten / Bankdatenänderung im Vier-Augen-Prinzip=ja… | ok |
| dienstleister | EK08 | Rahmenverträge und Abonnements | Verträge und Überwachung=Rahmenverträge für Rohmaterial und Wartungsverträge, Liste im ERP mit Laufzeit und Kü… | ok |
| dienstleister | EK10 | Ablage der Einkaufsunterlagen | Ablageort=ERP Fertigplan (fiktiv), Dokumente am Bestellvorgang / Ordnung (z. B. Bestellnummer)=Bestellnummer… | ok |
| dienstleister | EK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Einkauf von Material, Handelsware und Dienstleistungen am Standort Musterbach… | ok |
| dienstleister | EK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=ERP Fertigplan (fiktiv): Einkauf und Lager, Cloud. Lieferantenportale zweier G… | ok |
| dienstleister | EK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Freigabe nach Wertgrenzen, Drei-Wege-Abgleich Bestellung, Lieferung, Rechnung, Vier-A… | ok |
| dienstleister | EK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| dienstleister | EK94 | Änderungsmanagement | Wer gibt Änderungen frei=Eva Lindner / Dokumentation der Änderungen=Änderungen an Freigabegrenzen und Rollen a… | ok |
| dienstleister | EK95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei ERP-Ausfall Bestellungen per E-Mail mit Bestellnummernliste, Nacherfassung im ERP. / … | ok |
| dienstleister | EK96 | Ablage und Archiv | Ablageort=ERP Fertigplan (fiktiv) mit jährlichem Export auf das Firmenlaufwerk / Form (Originaldatei, Export, … | ok |
| dienstleister | BA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jana Hellweg (Partnerin) / Vertretung=Lukas Berger (Partner)… | ok |
| dienstleister | BA01 | Konten | Konten (Bank, Zweck)=Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).… | ok |
| dienstleister | BA02 | Vollmachten und Zugänge | Vollmachten (Einzel- oder Gemeinschaftsvollmacht)=Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam.… | ok |
| dienstleister | BA03 | Kontoauszüge | Format=Elektronisch (Datensatz/Schnittstelle) / Ablage=DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Ko… | ok |
| dienstleister | BA04 | Zahlungsvorbereitung | Ablauf=Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software. / Wer… | ok |
| dienstleister | BA05 | Zahlungsfreigabe | Wer gibt frei=Ein Partner, über 10.000 Euro beide Partner / Vier-Augen-Prinzip=ja / Limits=Einzelfreigabe bis … | ok |
| dienstleister | BA06 | Lastschriften und Daueraufträge | Überwachung=Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht. / Wer überwac… | ok |
| dienstleister | BA07 | Bankabstimmung | Wer=Paul Richter / Turnus=monatlich… | ok |
| dienstleister | BA08 | Übergabe an die Buchhaltung | Weg=Automatischer Abruf in die FiBu / Beschreibung=Kontoumsätze werden täglich über DATEV Bankdaten abgerufen.… | ok |
| dienstleister | BA10 | Ungeklärte Posten | Ablauf=Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage. / Wer klärt=Pa… | ok |
| dienstleister | BA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Bankkonten und die Firmenkreditkarte. / Ausgenommen und wo dokumentiert… | ok |
| dienstleister | BA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen o… | ok |
| dienstleister | BA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Vier-Augen-Freigabe von Zahlungen, Monatliche Abstimmung Saldo Bank und FiBu, Durchsi… | ok |
| dienstleister | BA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| dienstleister | BA94 | Änderungsmanagement | Wer gibt Änderungen frei=Jana Hellweg / Dokumentation der Änderungen=Änderungen an Vollmachten und Limits mit … | ok |
| dienstleister | BA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der Banking-Software Freigabe direkt im Bankportal. / Nacherfassung und Nachw… | ok |
| dienstleister | BA96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Bankportal / Form (Originaldatei, Export, Papier)=Elektronische Kontoau… | ok |
| dienstleister | AN00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Birgit Kranz (Buchhaltung) / Vertretung=Hannes Papke… | ok |
| dienstleister | AN01 | Anlagenverzeichnis | System=DATEV Anlagenbuchführung über die Kanzlei / Wer führt es=Kanzlei nach Meldung durch Birgit Kranz… | ok |
| dienstleister | AN02 | Zugang und Aktivierung | Wer entscheidet=Birgit Kranz nach Rücksprache mit der Kanzlei / Ablauf=Rechnungen über 250 Euro netto werden a… | ok |
| dienstleister | AN03 | Anschaffungskosten | Ermittlung=Anschaffungspreis zuzüglich Fracht und Montage, abzüglich Skonti und Zuschüsse; Nachweise am Anlage… | ok |
| dienstleister | AN04 | Kennzeichnung und Standort | Kennzeichnung=Inventarnummer mit Etikett / Standortvermerk=Halle und Raum im Anlagenverzeichnis… | ok |
| dienstleister | AN05 | Abschreibung | Methode (z. B. linear)=linear / Wer legt Nutzungsdauern fest=Kanzlei nach amtlicher AfA-Tabelle, Abweichungen … | ok |
| dienstleister | AN07 | Abgang | Ablauf=Verkauf oder Verschrottung mit Abgangsformular, Verkaufsrechnung bzw. Entsorgungsnachweis. / Freigabe=H… | ok |
| dienstleister | AN08 | Bestandsaufnahme | Bestandsaufnahme=Ja, jährlich / Wer=Birgit Kranz mit Produktionsleitung… | ok |
| dienstleister | AN09 | Leasing und Miete | Verträge und Ablage=Leasing für eine Digitaldruckmaschine und zwei Fahrzeuge; Verträge im Ordner Verträge, Lis… | ok |
| dienstleister | AN90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Gesamtes Sachanlagevermögen am Standort Mustertal. / Ausgenommen und wo dokum… | ok |
| dienstleister | AN91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Anlagenbuchführung (Kanzlei); DATEV Unternehmen online. / Schnittstellen… | ok |
| dienstleister | AN92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Anlagenverzeichnis mit den Anlagenkonten, Durchsicht der Aufwandskonten auf … | ok |
| dienstleister | AN93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| dienstleister | AN94 | Änderungsmanagement | Wer gibt Änderungen frei=Hannes Papke / Dokumentation der Änderungen=Änderungen an Nutzungsdauern oder Methode… | ok |
| dienstleister | AN96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Ordner Anlagen auf dem NAS / Form (Originaldatei, Export, Papier)=Elekt… | ok |
| dienstleister | LO00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | LO01 | Abrechnung | Abrechnung durch=Kanzlei / Lohnprogramm (z. B. DATEV Lohn und Gehalt, LODAS)=DATEV Lohn und Gehalt / Abrechnun… | ok |
| dienstleister | LO02 | Abrechnungsunterlagen | Unterlagen=Lohnabrechnungen, Lohnjournal, Buchungsliste, Zahlungsliste / SEPA-Datei, Beitragsnachweise, Lohnst… | ok |
| dienstleister | LO03 | Personalstammdaten und Änderungen | Wer meldet=Ines Wolf / Wer gibt frei=Robert Funke / Meldeweg (z. B. Formular, Portal)=Personalfragebogen und Ä… | ok |
| dienstleister | LO04 | Bewegungsdaten | Weg der Übergabe=Stunden aus den Stundenzetteln, Zuschläge und Abwesenheiten als Monatsliste per DATEV Upload … | ok |
| dienstleister | LO05 | Lohnkonto und Lohnunterlagen | Ablageort=DATEV-Rechenzentrum über die Kanzlei, Auswertungen in DATEV Unternehmen online / Form (z. B. im Lohn… | ok |
| dienstleister | LO06 | Meldungen und Anmeldungen | Wer übermittelt=Kanzlei / Kontrolle der Übermittlung=Kanzlei stellt Übermittlungsprotokolle monatlich in DATEV… | ok |
| dienstleister | LO07 | Übergabe an die Buchhaltung | Schnittstelle=Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu) / Weg der Übergabe=Die Kanzlei … | ok |
| dienstleister | LO08 | Zugriff auf Lohndaten | Zugriffsberechtigte=Robert Funke, Ines Wolf, Kanzlei / Schutz (z. B. eigene Rolle, Passwort)=Eigene Rolle in D… | ok |
| dienstleister | LO09 | Auszahlung | Freigabe der Auszahlung=Ines Wolf bereitet vor, Robert Funke gibt im Onlinebanking frei / Vier-Augen-Prinzip=j… | ok |
| dienstleister | LO10 | Reisekosten und Sachbezüge | Erfassung und Nachweis=Reisekosten über Abrechnungsformular mit Belegen, Prüfung durch Robert Funke; Dienstwag… | ok |
| dienstleister | LO90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten einschließlich Auszubildender und Minijobs. / Ausgenommen … | ok |
| dienstleister | LO91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Lohn und Gehalt (Kanzlei); DATEV Unternehmen online; Onlinebanking. / Sc… | ok |
| dienstleister | LO92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Personalbestand mit der Abrechnung (Ein- und Austritte), Plausibilitätsprüfu… | ok |
| dienstleister | LO93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| dienstleister | LO94 | Änderungsmanagement | Wer gibt Änderungen frei=Robert Funke / Dokumentation der Änderungen=Änderungen an Lohnarten, Zuschlagsregeln … | ok |
| dienstleister | LO95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Fällt die Abrechnung aus, zahlt die Geschäftsführung Abschläge; Korrektur mit der nächste… | ok |
| dienstleister | LO96 | Ablage und Archiv | Ablageort=DATEV über die Kanzlei, Personalakten im verschlossenen Schrank / Form (Originaldatei, Export, Papie… | ok |
| dienstleister | ZE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | ZE01 | System | Art=App / Software / System=Zeiterfassungs-App Takt (fiktiv) auf Diensthandys… | ok |
| dienstleister | ZE02 | Personenkreis | Gruppen (z. B. alle, Minijobs, Aushilfen)=Alle Beschäftigten einschließlich Minijobs und Aushilfen.… | ok |
| dienstleister | ZE03 | Erfassung | Wer erfasst=Beschäftigte selbst per App / Erfasste Angaben=Beginn, Ende, Pausen, Dauer / Bis wann (z. B. tägli… | ok |
| dienstleister | ZE04 | Abwesenheiten | Ablauf=Urlaub per Antrag in der App, Krankheit meldet die Teamleitung im System. / Wer gibt frei=Teamleitung… | ok |
| dienstleister | ZE05 | Korrekturen | Wer darf korrigieren=Nur Teamleitung / Korrekturen werden protokolliert=ja… | ok |
| dienstleister | ZE06 | Monatsabschluss | Wer prüft und schließt ab=Teamleitung / Termin (z. B. 3. Werktag)=bis zum 2. Werktag des Folgemonats… | ok |
| dienstleister | ZE07 | Überstunden und Zuschläge | Ermittlung=Die App berechnet Überstunden gegen die Sollzeit und Zuschläge für Nacht-, Sonn- und Feiertagsarbei… | ok |
| dienstleister | ZE08 | Übergabe an die Lohnabrechnung | Weg der Übergabe=Monatsexport der Stunden und Zuschläge aus der App, Upload in DATEV Unternehmen online für di… | ok |
| dienstleister | ZE09 | Aufbewahrung und Export | Ablage=App-Cloud und monatlicher PDF-Export in DATEV Unternehmen online / Export möglich und geprüft=ja… | ok |
| dienstleister | ZE90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten des Betriebs am Standort Musterdorf. / Ausgenommen und wo … | ok |
| dienstleister | ZE91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Zeiterfassungs-App Takt (fiktiv), Anbieter Takt GmbH (fiktiv), Cloud. DATEV Un… | ok |
| dienstleister | ZE92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Monatliche Plausibilitätsprüfung der Zeiten, Durchsicht des Korrekturprotokolls, Abgl… | ok |
| dienstleister | ZE93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| dienstleister | ZE94 | Änderungsmanagement | Wer gibt Änderungen frei=Sandra Linde / Dokumentation der Änderungen=Änderungen an Sollzeiten, Zuschlagsregeln… | ok |
| dienstleister | ZE95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der App Stundenzettel auf Papier, Übertrag durch die Teamleitung. / Nacherfas… | ok |
| dienstleister | UO01 | Gesellschaften und Standorte | Gesellschaften (Name, Rechtsform, Steuernummer optional)=Nordlicht Beratung GmbH (Muster, fiktiv), einzige Ges… | ok |
| dienstleister | UO02 | Tätigkeiten und Geschäftsvorfälle | Tätigkeiten und Umsatzarten=B2B-Unternehmensberatung und Projektleistungen. Typische Vorfälle: Projektaufträge… | ok |
| dienstleister | UO03 | Zuständigkeiten | Aufgabe und zuständige Person oder Rolle=Geschäftsführung und Gesamtverantwortung: Lea Nordlicht. Interne Buch… | ok |
| dienstleister | UO04 | Vertretungsregelung | Vertretungsregelung=Bei Abwesenheit von Lea Nordlicht übernimmt Tim Harms die laufende Belegprüfung und Zahlun… | ok |
| dienstleister | UO05 | Zeichnungs- und Freigabebefugnisse | Befugnis, Person oder Rolle, Betragsgrenze=Vertragsabschluss und Ausgangsrechnungen: Lea Nordlicht. Zahlungsfr… | ok |
| dienstleister | UO06 | Geltungsbereich und Abgrenzung | Geltungsbereich=Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort Hamburg. / Nicht erfasst… | ok |
| dienstleister | LE01 | Auftragsänderungen und Nachträge | Ablauf und Form der Bestätigung=Lea Nordlicht oder die Projektleitung hält Änderungen (Scope, Zeit, Honorar) s… | ok |
| dienstleister | LE02 | Lieferung und Leistungsnachweis | Nachweisarten=Leistungsnachweis je Monat bzw. Meilenstein (Stundenübersicht oder Deliverable-Liste), Freigabe … | ok |
| dienstleister | LE03 | Abnahmen | Ablauf der Abnahme=Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestäti… | ok |
| dienstleister | LE05 | Vollständige Abrechnung | Abgleich Leistung – Rechnung=Nach Leistungsnachweis erstellt die Buchhaltung die Rechnung in der Rechnungssoft… | ok |
| dienstleister | LE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abstimmung offene Aufträge mit Rechnungen, Stichprobe Leistungsnachweis vor Rechnung … | ok |
| dienstleister | AR00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | AR01 | Abschlags- und Schlussrechnungen | Ablauf und Verrechnung=Abschlagsrechnungen bei Mehrphasen-Projekten; Schlussrechnung stellt den Gesamtbezug he… | ok |
| dienstleister | AR02 | Gutschriften | Art=Korrektur / Rechnungsminderung / Bezeichnung auf dem Beleg=Gutschrift, mit eigener Nummer und Verweis auf … | ok |
| dienstleister | AR03 | Stornos und Berichtigungen | Ablauf mit Bezug zur Ursprungsrechnung=Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Beric… | ok |
| dienstleister | AR04 | Rechnungsdoppel und Archiv | Ablageort=Archiv der Rechnungssoftware bzw. DATEV / Format (PDF, XML, Papier)=PDF und strukturierte Rechnungsd… | ok |
| dienstleister | AR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Nummernkreis lückenlos, Abstimmung Ausgangsrechnungen mit FiBu / Turnus, wer, Nachwei… | ok |
| dienstleister | ER00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | ER01 | Empfangskanäle | Zentrales Postfach oder Portal=E-Rechnungen und PDF-Rechnungen am Funktionspostfach; XRechnung über den Eingan… | ok |
| dienstleister | ER02 | Anzeige und Prüfung | Viewer oder Software=Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch… | ok |
| dienstleister | ER03 | Erstellung und Versand | Format=XRechnung, ZUGFeRD / System für Erstellung und Versand=Ausgangs-E-Rechnungen erzeugt die Rechnungssoftw… | ok |
| dienstleister | ER04 | Speicherung der strukturierten Daten | Speicherort und Verknüpfung=Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID. Da… | ok |
| dienstleister | ER92 | Kontrollen im Modul | Durchgeführte Kontrollen=Validierung E-Rechnung, Vollständigkeit Eingangsjournal / Turnus, wer, Nachweis je Ko… | ok |
| dienstleister | PB00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | PB01 | Scanvorgang | Ablauf und Zeitpunkt=Papierpost (selten) wird zentral geöffnet, mit Eingangsstempel versehen und noch am selbe… | ok |
| dienstleister | PB02 | Qualitätskontrolle | Wer prüft=Tim Harms / Prüfkriterien=Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) vo… | ok |
| dienstleister | PB03 | Übergabe ins Archiv | Übergabe und Indexierung=Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitges… | ok |
| dienstleister | PB04 | Aufbewahrung der Papieroriginale | Ablageort=Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat. / Dauer=bis zur … | ok |
| dienstleister | PB05 | Vernichtung der Originale | Vernichtung nach dem Scannen=ja / Zeitpunkt, Freigabe, Ausnahmen=Vernichtung nach Checkliste (Frist, keine Bet… | ok |
| dienstleister | PB92 | Kontrollen im Modul | Durchgeführte Kontrollen=Scan-Qualitätskontrolle, Eingangsstempel und Vollständigkeit / Turnus, wer, Nachweis … | ok |
| dienstleister | ZD01 | Zahlungsdienstleister und Kartenzahlung | Anbieter, Zahlungsarten, Auszahlungsrhythmus=Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Last… | ok |
| dienstleister | ZD02 | Gebühren und Auszahlungsabrechnungen | Abruf, Ablage, Buchung=Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten du… | ok |
| dienstleister | ZD03 | Rückzahlungen und Rückbelastungen | Ablauf und Beleg=Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt. … | ok |
| dienstleister | ZD04 | Abgleich offener Posten | Abgleich und Klärung=Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; n… | ok |
| dienstleister | BU00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Tim Harms / Vertretung=Lea Nordlicht… | ok |
| dienstleister | BU01 | Belegzuordnung und Kontierung | Wer kontiert=Tim Harms / Automatische Buchungsregeln oder Vorschläge=Interne Vorkontierung in DATEV Unternehme… | ok |
| dienstleister | BU02 | Buchungsrhythmus und Festschreibung | Buchungsrhythmus=zum Periodenabschluss / Festschreibung (wann, durch wen)=Festschreibung nach Abstimmung mit d… | ok |
| dienstleister | BU03 | Korrekturen | Ablauf=Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze… | ok |
| dienstleister | BU04 | Abstimmungen | Abstimmungen=Bank, Offene Posten Debitoren, Offene Posten Kreditoren, Umsatzsteuer / Turnus und wer=Monatlich:… | ok |
| dienstleister | BU06 | Abschlussarbeiten | Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)=Jahresabschluss erstellt Ka… | ok |
| dienstleister | BU07 | Übergabe an die Kanzlei | Inhalt, Termin, Weg=Kanzlei: Kanzlei Hafensteuer GmbH (fiktiv). Laufende FiBu, USt-Voranmeldung, Jahresabschlu… | teilweise (Mandatsumfang statt Übergabe/Termin/Weg/Nachweis) |
| dienstleister | BU92 | Kontrollen im Modul | Durchgeführte Kontrollen=Monatsabschluss-Abstimmung, Belegvollständigkeit / Turnus, wer, Nachweis je Kontrolle… | ok |
| dienstleister | BS00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lea Nordlicht / Vertretung=Tim Harms… | ok |
| dienstleister | BS01 | Branchenspezifische Vorgänge | Branche=Dienstleistung / Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträge)=Br… | ok |
| dienstleister | BS02 | Branchensoftware | System oder Gerät, Zweck, Anbieter=Branchensoftware bzw. Gerät laut Modul Vorsystem (fiktiv); Schnittstelle zu… | ok |
| dienstleister | BS03 | Erfassung der Grunddaten | Erfassung, wer, wann=Grunddaten erfasst fachlich geschultes Personal; Änderungen an Preisen/Stammdaten nur mit… | ok |
| dienstleister | BS04 | Nachweise | Nachweis und Ablageort=Je Vorgang die branchentypischen Nachweise (z. B. Projektnachweis, Leistungsdokumentati… | ok |
| dienstleister | BS06 | Besondere steuerliche Regeln | Regel und wie sie im Ablauf umgesetzt wird=Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch Tim Har… | **falsch** (Abstimmung statt steuerlicher Regel) |
| dienstleister | BS07 | Übergabe an die Buchhaltung | Weg (Schnittstelle, Export, manuell)=Periodischer Export an DATEV Unternehmen online. / Turnus=Monatlich.… | ok |
| dienstleister | BS92 | Kontrollen im Modul | Durchgeführte Kontrollen=Summenabstimmung Vorsystem/FiBu, Rechteprüfung / Turnus, wer, Nachweis je Kontrolle=M… | ok |
| dienstleister | AW01 | Archivsystem | Elektronisches Archiv=DATEV Unternehmen online (Belege und Buchungen); NAS (Projektunterlagen, Leistungsnachwe… | ok |
| dienstleister | AW02 | Suchmerkmale | Suchmerkmale=Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATE… | ok |
| dienstleister | AW03 | Verknüpfung Beleg und Buchung | Verknüpfung=Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: Tim Harms.… | ok |
| dienstleister | AW04 | Lesbarkeit über die Frist | Maßnahmen=PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch Tim Harms. Forma… | ok |
| dienstleister | AW05 | Schutz vor unbemerkten Änderungen | Maßnahmen=Schreibschutz / Unveränderbarkeit im Archiv, Versionierung mit Protokoll / Details=Keine Überschreib… | ok |
| dienstleister | AW92 | Kontrollen im Modul | Durchgeführte Kontrollen=Stichprobe Wiederauffindbarkeit, Lesbarkeitsprüfung / Turnus, wer, Nachweis je Kontro… | ok |
| dienstleister | AF01 | Fristzuordnung | Verfahren der Zuordnung=Jeder Unterlagenart wird ihre Frist nach § 147 Abs. 1, 3 AO zugeordnet: Bücher, Aufzei… | ok |
| dienstleister | AF02 | Weitere Aufbewahrungsgründe | Prüfung vor Löschung=Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wi… | ok |
| dienstleister | AF03 | Löschfreigabe | Freigabe durch=Löschung erst nach Fristende und schriftlicher Freigabe durch Lea Nordlicht, Abstimmung mit Kan… | ok |
| dienstleister | AF04 | Durchführung und Protokoll | Durchführung=Technische Löschung durch Externer IT-Dienstleister (Cloud & Rechte) bzw. Anbieter nach Freigabe;… | ok |
| dienstleister | AF05 | Datenschutz und Aufbewahrung | Vorgehen (z. B. Sperrung statt Löschung)=Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach … | ok |
| dienstleister | SY01 | Hardware und Betriebsumgebung | Umgebung=Rechnungssoftware, DATEV Unternehmen online, Zeiterfassung (fiktiv), E-Mail, NAS. Kein Kassensystem, … | ok |
| dienstleister | SY02 | Schnittstellen | Schnittstellen=Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über … | ok |
| dienstleister | SY03 | Importe, Exporte und Konvertierungen | Vorgänge und Prüfung=Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, … | ok |
| dienstleister | SY04 | Eigene Berechnungen und Automatisierungen | Vorhanden=ja / Beschreibung (Zweck, Ersteller, Änderung)=Wiederkehrende Exporte und Erinnerungen; keine unprot… | ok |
| dienstleister | SY92 | Kontrollen im Modul | Durchgeführte Kontrollen=Schnittstellenprotokoll, Systemliste aktuell / Turnus, wer, Nachweis je Kontrolle=Nac… | ok |
| dienstleister | ZR01 | Rollen und Berechtigungen | Rolle und Rechte je System=Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränk… | ok |
| dienstleister | ZR02 | Vergabe von Rechten | Antrag durch=Lea Nordlicht beantragt neue Zugänge / Genehmigung durch=Externer IT-Dienstleister (Cloud & Recht… | teilweise („Genehmigung durch“: IT „richtet ein“) |
| dienstleister | ZR03 | Entzug von Rechten | Ablauf=Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.… | ok |
| dienstleister | ZR04 | Schutzmaßnahmen | Maßnahmen=Persönliche Zugänge (keine Sammelkonten), Zwei-Faktor-Anmeldung, Passwortregeln, Bildschirmsperre… | ok |
| dienstleister | ZR05 | Protokollierung | Protokollierung vorhanden=ja / Auswertung durch=Anbieterprotokolle zu Logins und kritischen Änderungen werden … | **falsch** (Feld „Auswertung durch“ ohne Person) |
| dienstleister | ZR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Jährliche Rechteprüfung, Offboarding-Checkliste / Turnus, wer, Nachweis je Kontrolle=… | ok |
| dienstleister | SN01 | Sicherungskonzept | Daten, Turnus, Ziel, Aufbewahrung=Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen … | ok |
| dienstleister | SN03 | Ersatzverfahren | Ersatzverfahren=Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf… | ok |
| dienstleister | SN04 | Nachbearbeitung | Nacherfassung und Nachweis=Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.… | ok |
| dienstleister | SN05 | Notfallkontakte | Rolle oder Stelle (keine privaten Telefonnummern)=Kontakt: Lea Nordlicht und Externer IT-Dienstleister (Cloud … | ok |
| dienstleister | SN92 | Kontrollen im Modul | Durchgeführte Kontrollen=Backup-Erfolgskontrolle, Jährlicher Restore-Test / Turnus, wer, Nachweis je Kontrolle… | ok |
| dienstleister | KF01 | Vollständigkeitskontrollen | Kontrollen=Vollständigkeit Leistungsnachweis vor Rechnung, Nummernkreise Ausgang, Bank/OP, Schnittstelle DATEV… | ok |
| dienstleister | KF02 | Richtigkeitskontrollen | Kontrollen=Erkennung über Abstimmungen und Systemhinweise.… | teilweise (keine Richtigkeitskontrolle benannt) |
| dienstleister | KF03 | Abweichungen und Fehler | Ablauf=Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrekt… | ok |
| dienstleister | KF04 | Kontrollnachweise | Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)=Abstimmungsprotokolle, Checklisten zum Monatsabschlu… | ok |
| dienstleister | KF05 | Überwachung des Kontrollsystems | Überwachung durch=Lea Nordlicht / Turnus=Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessänderung… | ok |
| dienstleister | AU01 | Buchhaltungsservice und weitere Dienstleister | Dienstleister und Aufgaben=FiBu und Abschluss: Kanzlei Hafensteuer GmbH (fiktiv). Lohnabrechnung: Kanzlei Hafe… | ok |
| dienstleister | AU02 | IT- und Cloud-Dienstleister | Anbieter, Leistung, Speicherort=IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich z… | ok |
| dienstleister | AU03 | Übergaben | Übergaben und Nachweis=Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Ü… | ok |
| dienstleister | AU04 | Kontrolle der Dienstleister | Kontrolle=Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. Tim Harms.… | ok |
| dienstleister | AU05 | Verantwortungsgrenzen | Abgrenzung=Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Vera… | ok |
| dienstleister | PZ00 | Ansprechpartner | Ansprechpartner (Name oder Rolle)=Lea Nordlicht / Vertretung=Tim Harms… | ok |
| dienstleister | PZ01 | Unmittelbarer Zugriff (Z1) | Nur-Lese-Zugang möglich=ja / Systeme=Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch IT und d… | ok |
| dienstleister | PZ02 | Mittelbarer Zugriff (Z2) | Wer erstellt Auswertungen=Tim Harms erstellt Auswertungen nach Vorgabe der Prüfer.… | ok |
| dienstleister | PZ04 | Bereitstellung von Belegen | Ablauf=Ankündigung, Benennung der Ansprechperson (Lea Nordlicht), Bereitstellung von Leserecht oder Export, Pr… | ok |
| dienstleister | PZ06 | Altdaten | Regelung (z. B. Lesezugang, Export, Archivsystem)=Frühere Fassungen der Verfahrensdokumentation und ältere Exp… | ok |
| dienstleister | AE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lea Nordlicht / Vertretung=Externer IT-Dienstleister (Cloud & Rechte)… | ok |
| dienstleister | AE01 | Einführung neuer Systeme | Ablauf=Neue Systeme nur nach Freigabe Lea Nordlicht, mit Eintrag in der Systemliste und Anpassung dieser Dokum… | ok |
| dienstleister | AE02 | Updates und Versionswechsel | Ablauf=Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet un… | ok |
| dienstleister | AE03 | Migration und Datenübernahme | Übernahme und Prüfung=Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende… | ok |
| dienstleister | AE05 | Ablaufänderungen | Meldung und Übernahme=Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen … | ok |
| dienstleister | AE06 | Historische Nachvollziehbarkeit | Änderungsverzeichnis, Versionen, Gültigkeitszeiträume=Frühere Fassungen bleiben versioniert im Kundenkonto dow… | ok |
| dienstleister | AE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Änderungsverzeichnis gepflegt, Systemliste nach Änderung aktualisiert / Turnus, wer, … | ok |
| dienstleister | PF01 | Prüfturnus | Turnus=jährlich / Prüfung durch=Lea Nordlicht mit Tim Harms. Jährliche Durchsicht aller aktiven Module und nac… | ok |
| dienstleister | PF03 | Freigabe durch die Geschäftsleitung | Ablauf (z. B. Unterschrift, Freigabevermerk)=Inhaltliche Freigabe der geänderten Kapitel durch Lea Nordlicht v… | ok |
| handel | KA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Clara Sonnenkorn (Geschäftsführung) / Vertretung=Jonas Weber (Büro)… | ok |
| handel | KA01 | Kassenart | Art=Elektronisches Kassensystem mit TSE / Hersteller und Software=KassaPro (fiktiv) auf Tablet-Kassen / Anzahl… | ok |
| handel | KA02 | TSE und Mitteilung | TSE-Art (z. B. USB, SD, Cloud-TSE)=Cloud-TSE des Kassenanbieters / BSI-Zertifikat der TSE liegt vor=ja / Mitte… | ok |
| handel | KA03 | Belegausgabe | Belegausgabe=Papierbon, Elektronischer Beleg (QR, E-Mail, App) / Befreiung von der Belegausgabepflicht beantra… | ok |
| handel | KA04 | Kassenöffnung und Bedienende | Ablauf der Kassenöffnung=Filialleitung zählt morgens das Wechselgeld (200 Euro je Kasse) und erfasst den Anfan… | ok |
| handel | KA05 | Tagesabschluss | Ablauf Tagesabschluss=Nach Ladenschluss zählt die Filialleitung den Bestand mit Zählprotokoll im Kassensystem,… | ok |
| handel | KA06 | Kassenbuch oder Kassenbericht | Form=Kassenbuch im Kassensystem / Wer führt=Filialleitung, Kontrolle durch Jonas Weber / Zählprotokoll wird er… | ok |
| handel | KA07 | Einlagen, Entnahmen, Sonderfälle | Erfassung der Sonderfälle=Storni nur mit Filialleitungs-Kennung und Grund. Entnahmen und Einlagen als eigene B… | ok |
| handel | KA08 | Bargeldtransfer | Ablauf=Abschöpfung über 500 Euro in den Tresor mit Buchung im System. Bankeinzahlung zweimal wöchentlich durch… | ok |
| handel | KA09 | Programmierung und Organisationsunterlagen | Wer darf ändern=Clara Sonnenkorn, technische Umsetzung durch den Kassenhändler / Änderungen werden protokollie… | ok |
| handel | KA10 | Übergabe an die Buchhaltung | Weg der Übergabe=Monatlicher DATEV-Export aus dem Kassensystem, Upload in DATEV Unternehmen online. / Turnus=m… | ok |
| handel | KA11 | Kassen-Nachschau | Ansprechperson vor Ort=Filialleitung vor Ort, telefonisch Clara Sonnenkorn / Datenzugriff / Export=DSFinV-K-Ex… | ok |
| handel | KA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Filialen (Hauptstraße und Bahnhof) mit allen drei Kassen. / Ausgenommen… | ok |
| handel | KA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=KassaPro (fiktiv): Kassensoftware, Anbieter KassaPro GmbH. Cloud-TSE des Anbie… | ok |
| handel | KA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Täglicher Kassensturz (Soll-Ist-Abgleich), Abgleich Z-Bon mit Kassenbuch und Bankeinz… | ok |
| handel | KA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handel | KA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall des Kassensystems: Notbetrieb mit Quittungsblock und Strichliste, Ausfallzeit… | ok |
| handel | KA96 | Ablage und Archiv | Ablageort=Cloud-Archiv des Kassenanbieters und jährlicher Export auf das NAS / Form (Originaldatei, Export, Pa… | ok |
| handel | WW00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lagerleitung (Peter Holm) / Vertretung=Martin Eichenblatt… | ok |
| handel | WW01 | System | System=WaWi Lagerplus (fiktiv), Version 9 / Erfasste Vorgänge=Artikelstamm, Bestellungen, Wareneingang, Liefer… | ok |
| handel | WW02 | Artikelstammdaten und Preise | Wer pflegt Artikel und Preise=Einkauf (Lena Brandt) / Wer gibt Preisänderungen frei=Martin Eichenblatt bei Pre… | ok |
| handel | WW03 | Wareneingang | Ablauf=Lagerpersonal prüft Menge und Zustand gegen Lieferschein und Bestellung, scannt den Lieferschein und bu… | ok |
| handel | WW04 | Warenausgang | Ablauf=Warenausgang wird mit dem Lieferschein aus dem Auftrag gebucht; Eigenverbrauch über eigene Bewegungsart… | ok |
| handel | WW05 | Bestandsführung und Bewertung | Bestandsführung=Laufend im System / Bewertungsverfahren (z. B. Durchschnitt, Einzelbewertung)=Gleitender Durch… | ok |
| handel | WW06 | Lagerorte und Umlagerungen | Lagerorte=Halle A, Halle B, Freilager / Buchung von Umlagerungen=Umlagerung als eigene Buchung mit Quell- und … | ok |
| handel | WW07 | Bestandskorrekturen | Wer bucht=Lagerleitung / Wer gibt frei=Martin Eichenblatt ab 500 Euro / Korrekturgrund wird erfasst=ja… | ok |
| handel | WW08 | Inventur | Verfahren=Permanente Inventur / Wer zählt und prüft=Zählteams aus zwei Personen, Prüfung durch die Lagerleitun… | ok |
| handel | WW09 | Inventurdifferenzen | Ablauf der Klärung=Differenzen über 2 Prozent werden nachgezählt. Ungeklärte Differenzen bucht die Lagerleitun… | ok |
| handel | WW10 | Übergabe an die Buchhaltung | Weg der Übergabe=Monatliche Bestandsliste mit Bestandswert als PDF und CSV an die Kanzlei über DATEV Unternehm… | ok |
| handel | WW90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle drei Lagerorte am Standort Musterhausen. / Ausgenommen und wo dokumentie… | ok |
| handel | WW91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=WaWi Lagerplus (fiktiv) auf dem Firmenserver; Handscanner im Lager; DATEV Unte… | ok |
| handel | WW92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Wareneingang mit Lieferschein und Bestellung, Freigabe von Bestandskorrektur… | ok |
| handel | WW93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträge… | ok |
| handel | WW94 | Änderungsmanagement | Wer gibt Änderungen frei=Martin Eichenblatt / Dokumentation der Änderungen=Änderungen an Bewertungsparametern,… | ok |
| handel | WW95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Serverausfall Erfassung auf Papierlieferscheinen, Nacherfassung nach Wiederanlauf. / … | ok |
| handel | EK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Einkaufsleitung (Murat Aydin) / Vertretung=Eva Lindner… | ok |
| handel | EK01 | Bedarfsmeldung | Ablauf=Bedarf entsteht aus Mindestbeständen im ERP und aus Fertigungsaufträgen; Abteilungen melden Sonderbedar… | ok |
| handel | EK02 | Bestellberechtigung | Wer bestellt=Einkauf / Freigabegrenzen=bis 5.000 Euro Einkauf allein; darüber Freigabe / Wer gibt frei=Eva Lin… | ok |
| handel | EK03 | Bestellweg | Bestellwege=ERP / Warenwirtschaft, Lieferantenportal, E-Mail / System=ERP Fertigplan (fiktiv)… | ok |
| handel | EK04 | Auftragsbestätigung | Wer prüft=Einkauf / Umgang mit Abweichungen=Abweichungen bei Preis oder Termin werden im ERP vermerkt und mit … | ok |
| handel | EK05 | Wareneingang und Leistungsnachweis | Ablauf=Wareneingang im ERP gegen die Bestellung; Dienstleistungen bestätigt die anfordernde Abteilung im ERP. … | ok |
| handel | EK06 | Abgleich Bestellung, Lieferung, Rechnung | Ablauf=Rechnung wird im ERP der Bestellung und dem Wareneingang zugeordnet; Abweichungen über 2 Prozent gehen … | ok |
| handel | EK07 | Lieferantenstammdaten | Wer pflegt=Einkauf legt an, Buchhaltung bestätigt Bankdaten / Bankdatenänderung im Vier-Augen-Prinzip=ja… | ok |
| handel | EK08 | Rahmenverträge und Abonnements | Verträge und Überwachung=Rahmenverträge für Rohmaterial und Wartungsverträge, Liste im ERP mit Laufzeit und Kü… | ok |
| handel | EK10 | Ablage der Einkaufsunterlagen | Ablageort=ERP Fertigplan (fiktiv), Dokumente am Bestellvorgang / Ordnung (z. B. Bestellnummer)=Bestellnummer… | ok |
| handel | EK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Einkauf von Material, Handelsware und Dienstleistungen am Standort Musterbach… | ok |
| handel | EK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=ERP Fertigplan (fiktiv): Einkauf und Lager, Cloud. Lieferantenportale zweier G… | ok |
| handel | EK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Freigabe nach Wertgrenzen, Drei-Wege-Abgleich Bestellung, Lieferung, Rechnung, Vier-A… | ok |
| handel | EK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handel | EK94 | Änderungsmanagement | Wer gibt Änderungen frei=Eva Lindner / Dokumentation der Änderungen=Änderungen an Freigabegrenzen und Rollen a… | ok |
| handel | EK95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei ERP-Ausfall Bestellungen per E-Mail mit Bestellnummernliste, Nacherfassung im ERP. / … | ok |
| handel | EK96 | Ablage und Archiv | Ablageort=ERP Fertigplan (fiktiv) mit jährlichem Export auf das Firmenlaufwerk / Form (Originaldatei, Export, … | ok |
| handel | VK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nora Klar (Geschäftsführung) / Vertretung=Felix Hahn (Büro)… | ok |
| handel | VK01 | Ablauf und System | Ablauf=Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst… | ok |
| handel | VK02 | Angebote und Aufträge | System=Faktura+ (fiktiv) / Ablage=Am Projekt in Faktura+… | ok |
| handel | VK03 | Preise und Konditionen | Wer legt fest=Nora Klar / Wer gibt Sonderkonditionen frei=Nora Klar bei Rabatten über 10 Prozent… | ok |
| handel | VK04 | Kundenstammdaten | Wer pflegt=Felix Hahn / Änderungen werden protokolliert=ja… | ok |
| handel | VK05 | Rechnungsnummern | Vergabe=Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer / Nummernkreise=Ein Nummernkrei… | ok |
| handel | VK06 | Pflichtangaben | Vorlage und Prüfung=Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem P… | ok |
| handel | VK07 | Rechnungsversand | Format=PDF per E-Mail, XRechnung / E-Rechnungen können versendet werden=ja… | ok |
| handel | VK08 | Korrektur und Storno | Ablauf=Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kei… | ok |
| handel | VK09 | Offene Posten und Mahnwesen | Wer=Felix Hahn / Turnus=wöchentlich; Mahnung nach 14 Tagen Verzug… | ok |
| handel | VK10 | Übergabe an die Buchhaltung | Weg der Übergabe=Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen onli… | ok |
| handel | VK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Leistungen der Agentur an Geschäftskunden. / Ausgenommen und wo dokument… | ok |
| handel | VK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen on… | ok |
| handel | VK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Lückenprüfung der Rechnungsnummern, Abgleich erbrachter Leistungen mit gestellten Rec… | ok |
| handel | VK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handel | VK94 | Änderungsmanagement | Wer gibt Änderungen frei=Nora Klar / Dokumentation der Änderungen=Änderungen an Rechnungsvorlage, Nummernkreis… | ok |
| handel | BA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jana Hellweg (Partnerin) / Vertretung=Lukas Berger (Partner)… | ok |
| handel | BA01 | Konten | Konten (Bank, Zweck)=Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).… | ok |
| handel | BA02 | Vollmachten und Zugänge | Vollmachten (Einzel- oder Gemeinschaftsvollmacht)=Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam.… | ok |
| handel | BA03 | Kontoauszüge | Format=Elektronisch (Datensatz/Schnittstelle) / Ablage=DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Ko… | ok |
| handel | BA04 | Zahlungsvorbereitung | Ablauf=Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software. / Wer… | ok |
| handel | BA05 | Zahlungsfreigabe | Wer gibt frei=Ein Partner, über 10.000 Euro beide Partner / Vier-Augen-Prinzip=ja / Limits=Einzelfreigabe bis … | ok |
| handel | BA06 | Lastschriften und Daueraufträge | Überwachung=Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht. / Wer überwac… | ok |
| handel | BA07 | Bankabstimmung | Wer=Paul Richter / Turnus=monatlich… | ok |
| handel | BA08 | Übergabe an die Buchhaltung | Weg=Automatischer Abruf in die FiBu / Beschreibung=Kontoumsätze werden täglich über DATEV Bankdaten abgerufen.… | ok |
| handel | BA10 | Ungeklärte Posten | Ablauf=Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage. / Wer klärt=Pa… | ok |
| handel | BA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Bankkonten und die Firmenkreditkarte. / Ausgenommen und wo dokumentiert… | ok |
| handel | BA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen o… | ok |
| handel | BA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Vier-Augen-Freigabe von Zahlungen, Monatliche Abstimmung Saldo Bank und FiBu, Durchsi… | ok |
| handel | BA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handel | BA94 | Änderungsmanagement | Wer gibt Änderungen frei=Jana Hellweg / Dokumentation der Änderungen=Änderungen an Vollmachten und Limits mit … | ok |
| handel | BA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der Banking-Software Freigabe direkt im Bankportal. / Nacherfassung und Nachw… | ok |
| handel | BA96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Bankportal / Form (Originaldatei, Export, Papier)=Elektronische Kontoau… | ok |
| handel | RT00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Leitung Kundenservice (Anja Berg) / Vertretung=Kai Laufer… | ok |
| handel | RT01 | Retourenkanäle und Erfassung | Wege und Erfassung=Retourenportal im Shop mit Retourenlabel; Marktplatzretouren über das Marktplatz-Backend. /… | ok |
| handel | RT02 | Rückgaberegeln | Regeln und Fristen=Widerruf 14 Tage gesetzlich, freiwilliges Rückgaberecht 30 Tage, Gewährleistung nach Prüfun… | ok |
| handel | RT03 | Warenannahme und Zuordnung | Ablauf=Lager scannt das Retourenlabel, die Retoure wird automatisch der Bestellung zugeordnet. / Zuordnung übe… | ok |
| handel | RT04 | Prüfung und Entscheidung | Wer prüft und entscheidet=Lager prüft, Kundenservice entscheidet / Wie wird die Entscheidung festgehalten=Prüf… | ok |
| handel | RT05 | Korrekturbeleg | Beleg=Stornorechnung / Bezug auf die Ursprungsrechnung=Stornorechnung nennt Nummer und Datum der Ursprungsrech… | ok |
| handel | RT06 | Umsatzsteuerberichtigung | Ablauf=Stornorechnung mindert Umsatz und Umsatzsteuer im selben Voranmeldungszeitraum; Buchung über die DATEV-… | ok |
| handel | RT07 | Erstattung | Erstattungsweg=Rückzahlung über den ursprünglichen Zahlungsweg (Zahlungsdienstleister) / Freigabe=Kundenservic… | ok |
| handel | RT08 | Bestandsbuchung | Bestandsbuchung=Wieder verkaufbare Ware wird zurückgebucht; B-Ware auf eigenen Lagerort; Verschrottung mit Gru… | ok |
| handel | RT10 | Ablage | Ablageort=WaWi Lagerplus (fiktiv), Retourenvorgang / Ordnung (z. B. Retourennummer)=Retourennummer… | ok |
| handel | RT90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Retouren aus eigenem Shop und Marktplätzen. / Ausgenommen und wo dokumentiert… | ok |
| handel | RT91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Shopsystem (fiktiv) mit Retourenportal; WaWi Lagerplus (fiktiv); Zahlungsdiens… | ok |
| handel | RT92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Erstattungen mit Korrekturbelegen, Zusätzliche Freigabe von Erstattungen übe… | ok |
| handel | RT93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handel | RT94 | Änderungsmanagement | Wer gibt Änderungen frei=Kai Laufer / Dokumentation der Änderungen=Änderungen an Rückgaberegeln, Retourengründ… | ok |
| handel | RT95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall des Retourenportals werden Retouren im Lager auf einer Liste erfasst und spät… | ok |
| handel | RT96 | Ablage und Archiv | Ablageort=WaWi Lagerplus (fiktiv) und DATEV Unternehmen online / Form (Originaldatei, Export, Papier)=Original… | ok |
| handel | LO00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Robert Funke (Geschäftsführung) / Vertretung=Ines Wolf (Büro)… | ok |
| handel | LO01 | Abrechnung | Abrechnung durch=Kanzlei / Lohnprogramm (z. B. DATEV Lohn und Gehalt, LODAS)=DATEV Lohn und Gehalt / Abrechnun… | ok |
| handel | LO02 | Abrechnungsunterlagen | Unterlagen=Lohnabrechnungen, Lohnjournal, Buchungsliste, Zahlungsliste / SEPA-Datei, Beitragsnachweise, Lohnst… | ok |
| handel | LO03 | Personalstammdaten und Änderungen | Wer meldet=Ines Wolf / Wer gibt frei=Robert Funke / Meldeweg (z. B. Formular, Portal)=Personalfragebogen und Ä… | ok |
| handel | LO04 | Bewegungsdaten | Weg der Übergabe=Stunden aus den Stundenzetteln, Zuschläge und Abwesenheiten als Monatsliste per DATEV Upload … | ok |
| handel | LO05 | Lohnkonto und Lohnunterlagen | Ablageort=DATEV-Rechenzentrum über die Kanzlei, Auswertungen in DATEV Unternehmen online / Form (z. B. im Lohn… | ok |
| handel | LO06 | Meldungen und Anmeldungen | Wer übermittelt=Kanzlei / Kontrolle der Übermittlung=Kanzlei stellt Übermittlungsprotokolle monatlich in DATEV… | ok |
| handel | LO07 | Übergabe an die Buchhaltung | Schnittstelle=Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu) / Weg der Übergabe=Die Kanzlei … | ok |
| handel | LO08 | Zugriff auf Lohndaten | Zugriffsberechtigte=Robert Funke, Ines Wolf, Kanzlei / Schutz (z. B. eigene Rolle, Passwort)=Eigene Rolle in D… | ok |
| handel | LO09 | Auszahlung | Freigabe der Auszahlung=Ines Wolf bereitet vor, Robert Funke gibt im Onlinebanking frei / Vier-Augen-Prinzip=j… | ok |
| handel | LO10 | Reisekosten und Sachbezüge | Erfassung und Nachweis=Reisekosten über Abrechnungsformular mit Belegen, Prüfung durch Robert Funke; Dienstwag… | ok |
| handel | LO90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten einschließlich Auszubildender und Minijobs. / Ausgenommen … | ok |
| handel | LO91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Lohn und Gehalt (Kanzlei); DATEV Unternehmen online; Onlinebanking. / Sc… | ok |
| handel | LO92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Personalbestand mit der Abrechnung (Ein- und Austritte), Plausibilitätsprüfu… | ok |
| handel | LO93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| handel | LO94 | Änderungsmanagement | Wer gibt Änderungen frei=Robert Funke / Dokumentation der Änderungen=Änderungen an Lohnarten, Zuschlagsregeln … | ok |
| handel | LO95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Fällt die Abrechnung aus, zahlt die Geschäftsführung Abschläge; Korrektur mit der nächste… | ok |
| handel | LO96 | Ablage und Archiv | Ablageort=DATEV über die Kanzlei, Personalakten im verschlossenen Schrank / Form (Originaldatei, Export, Papie… | ok |
| handel | UO01 | Gesellschaften und Standorte | Gesellschaften (Name, Rechtsform, Steuernummer optional)=Marktwege Handel GmbH (Muster, fiktiv), einzige Gesel… | ok |
| handel | UO02 | Tätigkeiten und Geschäftsvorfälle | Tätigkeiten und Umsatzarten=Einzel- und Großhandel mit Filiale und Lager. Steuerrelevante Vorgänge: Aufträge b… | ok |
| handel | UO03 | Zuständigkeiten | Aufgabe und zuständige Person oder Rolle=Geschäftsführung und Gesamtverantwortung: Jonas Marktwege. Interne Bu… | ok |
| handel | UO04 | Vertretungsregelung | Vertretungsregelung=Bei Abwesenheit von Jonas Marktwege übernimmt Sara Linden die laufende Belegprüfung und Za… | ok |
| handel | UO05 | Zeichnungs- und Freigabebefugnisse | Befugnis, Person oder Rolle, Betragsgrenze=Vertragsabschluss und Ausgangsrechnungen: Jonas Marktwege. Zahlungs… | ok |
| handel | UO06 | Geltungsbereich und Abgrenzung | Geltungsbereich=Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort Hannover. / Nicht erfass… | ok |
| handel | LE01 | Auftragsänderungen und Nachträge | Ablauf und Form der Bestätigung=Auftragsänderungen nur schriftlich (E-Mail) und mit neuer Auftragsversion. Sto… | ok |
| handel | LE02 | Lieferung und Leistungsnachweis | Nachweisarten=Leistung wird durch Lieferschein, Abnahmeprotokoll oder Leistungsnachweis (Stunden/Projekt) doku… | ok |
| handel | LE03 | Abnahmen | Ablauf der Abnahme=Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestäti… | ok |
| handel | LE05 | Vollständige Abrechnung | Abgleich Leistung – Rechnung=Nach Leistungserbringung bzw. Lieferung erstellt Sara Linden die Rechnung. Laufen… | ok |
| handel | LE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abstimmung offene Aufträge mit Rechnungen, Stichprobe Leistungsnachweis vor Rechnung … | ok |
| handel | AR00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Sara Linden / Vertretung=Jonas Marktwege… | ok |
| handel | AR01 | Abschlags- und Schlussrechnungen | Ablauf und Verrechnung=Abschlags- und Schlussrechnungen bei Projekten; Schlussrechnung stellt den Gesamtbezug … | ok |
| handel | AR02 | Gutschriften | Art=Korrektur / Rechnungsminderung / Bezeichnung auf dem Beleg=Gutschrift, mit eigener Nummer und Verweis auf … | ok |
| handel | AR03 | Stornos und Berichtigungen | Ablauf mit Bezug zur Ursprungsrechnung=Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Beric… | ok |
| handel | AR04 | Rechnungsdoppel und Archiv | Ablageort=Archiv der Rechnungssoftware bzw. DATEV / Format (PDF, XML, Papier)=PDF und strukturierte Rechnungsd… | ok |
| handel | AR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Nummernkreis lückenlos, Abstimmung Ausgangsrechnungen mit FiBu / Turnus, wer, Nachwei… | ok |
| handel | ER00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Sara Linden / Vertretung=Jonas Marktwege… | ok |
| handel | ER01 | Empfangskanäle | Zentrales Postfach oder Portal=E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen… | ok |
| handel | ER02 | Anzeige und Prüfung | Viewer oder Software=Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch… | ok |
| handel | ER03 | Erstellung und Versand | Format=XRechnung, ZUGFeRD / System für Erstellung und Versand=Ausgangs-E-Rechnungen erzeugt die Rechnungssoftw… | ok |
| handel | ER04 | Speicherung der strukturierten Daten | Speicherort und Verknüpfung=Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID. Da… | ok |
| handel | ER92 | Kontrollen im Modul | Durchgeführte Kontrollen=Validierung E-Rechnung, Vollständigkeit Eingangsjournal / Turnus, wer, Nachweis je Ko… | ok |
| handel | PB00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Sara Linden / Vertretung=Jonas Marktwege… | ok |
| handel | PB01 | Scanvorgang | Gerät oder App=Büroscanner (fiktiv) / Ablauf und Zeitpunkt=Papierpost wird zentral geöffnet, mit Eingangsstemp… | ok |
| handel | PB02 | Qualitätskontrolle | Wer prüft=Sara Linden / Prüfkriterien=Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) … | ok |
| handel | PB03 | Übergabe ins Archiv | Übergabe und Indexierung=Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitges… | ok |
| handel | PB04 | Aufbewahrung der Papieroriginale | Ablageort=Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat. / Dauer=bis zur … | ok |
| handel | PB05 | Vernichtung der Originale | Vernichtung nach dem Scannen=ja / Zeitpunkt, Freigabe, Ausnahmen=Vernichtung nach Checkliste (Frist, keine Bet… | ok |
| handel | PB92 | Kontrollen im Modul | Durchgeführte Kontrollen=Scan-Qualitätskontrolle, Eingangsstempel und Vollständigkeit / Turnus, wer, Nachweis … | ok |
| handel | ZD01 | Zahlungsdienstleister und Kartenzahlung | Anbieter, Zahlungsarten, Auszahlungsrhythmus=Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Last… | ok |
| handel | ZD02 | Gebühren und Auszahlungsabrechnungen | Abruf, Ablage, Buchung=Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten du… | ok |
| handel | ZD03 | Rückzahlungen und Rückbelastungen | Ablauf und Beleg=Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt. … | ok |
| handel | ZD04 | Abgleich offener Posten | Abgleich und Klärung=Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; n… | ok |
| handel | BU00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Sara Linden / Vertretung=Jonas Marktwege… | ok |
| handel | BU01 | Belegzuordnung und Kontierung | Wer kontiert=Sara Linden / Automatische Buchungsregeln oder Vorschläge=Interne Vorkontierung in DATEV Unterneh… | ok |
| handel | BU02 | Buchungsrhythmus und Festschreibung | Buchungsrhythmus=zum Periodenabschluss / Festschreibung (wann, durch wen)=Festschreibung nach Abstimmung mit d… | ok |
| handel | BU03 | Korrekturen | Ablauf=Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze… | ok |
| handel | BU04 | Abstimmungen | Abstimmungen=Bank, Offene Posten Debitoren, Offene Posten Kreditoren, Umsatzsteuer / Turnus und wer=Monatlich:… | ok |
| handel | BU06 | Abschlussarbeiten | Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)=Jahresabschluss erstellt di… | ok |
| handel | BU07 | Übergabe an die Kanzlei | Inhalt, Termin, Weg=Kanzlei: Kanzlei Leinetal GmbH (fiktiv). Laufende FiBu, USt-Voranmeldung, Jahresabschluss,… | teilweise (Mandatsumfang statt Übergabe/Termin/Weg/Nachweis) |
| handel | BU92 | Kontrollen im Modul | Durchgeführte Kontrollen=Monatsabschluss-Abstimmung, Belegvollständigkeit / Turnus, wer, Nachweis je Kontrolle… | ok |
| handel | BS00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jonas Marktwege / Vertretung=Sara Linden… | ok |
| handel | BS01 | Branchenspezifische Vorgänge | Branche=Handel / Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträge)=Branchenty… | ok |
| handel | BS02 | Branchensoftware | System oder Gerät, Zweck, Anbieter=Branchensoftware bzw. Gerät laut Modul Vorsystem (fiktiv); Schnittstelle zu… | ok |
| handel | BS03 | Erfassung der Grunddaten | Erfassung, wer, wann=Grunddaten erfasst fachlich geschultes Personal; Änderungen an Preisen/Stammdaten nur mit… | ok |
| handel | BS04 | Nachweise | Nachweis und Ablageort=Je Vorgang die branchentypischen Nachweise (z. B. Projektnachweis, Leistungsdokumentati… | ok |
| handel | BS06 | Besondere steuerliche Regeln | Regel und wie sie im Ablauf umgesetzt wird=Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch Sara Li… | **falsch** (Abstimmung statt steuerlicher Regel) |
| handel | BS07 | Übergabe an die Buchhaltung | Weg (Schnittstelle, Export, manuell)=Periodischer Export an DATEV Unternehmen online. / Turnus=Monatlich.… | ok |
| handel | BS92 | Kontrollen im Modul | Durchgeführte Kontrollen=Summenabstimmung Vorsystem/FiBu, Rechteprüfung / Turnus, wer, Nachweis je Kontrolle=M… | ok |
| handel | AW01 | Archivsystem | Elektronisches Archiv=DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und … | ok |
| handel | AW02 | Suchmerkmale | Suchmerkmale=Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATE… | ok |
| handel | AW03 | Verknüpfung Beleg und Buchung | Verknüpfung=Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: Sara Linden… | ok |
| handel | AW04 | Lesbarkeit über die Frist | Maßnahmen=PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch Sara Linden. For… | ok |
| handel | AW05 | Schutz vor unbemerkten Änderungen | Maßnahmen=Schreibschutz / Unveränderbarkeit im Archiv, Versionierung mit Protokoll / Details=Keine Überschreib… | ok |
| handel | AW92 | Kontrollen im Modul | Durchgeführte Kontrollen=Stichprobe Wiederauffindbarkeit, Lesbarkeitsprüfung / Turnus, wer, Nachweis je Kontro… | ok |
| handel | AF01 | Fristzuordnung | Verfahren der Zuordnung=Jeder Unterlagenart wird ihre Frist nach § 147 Abs. 1, 3 AO zugeordnet: Bücher, Aufzei… | ok |
| handel | AF02 | Weitere Aufbewahrungsgründe | Prüfung vor Löschung=Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wi… | ok |
| handel | AF03 | Löschfreigabe | Freigabe durch=Löschung erst nach Fristende und schriftlicher Freigabe durch Jonas Marktwege, Abstimmung mit K… | ok |
| handel | AF04 | Durchführung und Protokoll | Durchführung=Technische Löschung durch IT-Betreuung Kassensystem und WaWi (fiktiv) bzw. Anbieter nach Freigabe… | ok |
| handel | AF05 | Datenschutz und Aufbewahrung | Vorgehen (z. B. Sperrung statt Löschung)=Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach … | ok |
| handel | SY01 | Hardware und Betriebsumgebung | Umgebung=Rechnungssoftware, DATEV Unternehmen online, E-Mail, NAS, ggf. Kasse/Shop/WaWi laut Betriebs-Check. I… | ok |
| handel | SY02 | Schnittstellen | Schnittstellen=Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über … | ok |
| handel | SY03 | Importe, Exporte und Konvertierungen | Vorgänge und Prüfung=Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, … | ok |
| handel | SY04 | Eigene Berechnungen und Automatisierungen | Vorhanden=ja / Beschreibung (Zweck, Ersteller, Änderung)=Wiederkehrende Exporte und Erinnerungen; keine unprot… | ok |
| handel | SY92 | Kontrollen im Modul | Durchgeführte Kontrollen=Schnittstellenprotokoll, Systemliste aktuell / Turnus, wer, Nachweis je Kontrolle=Nac… | ok |
| handel | ZR01 | Rollen und Berechtigungen | Rolle und Rechte je System=Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränk… | ok |
| handel | ZR02 | Vergabe von Rechten | Antrag durch=Jonas Marktwege beantragt neue Zugänge / Genehmigung durch=IT-Betreuung Kassensystem und WaWi (fi… | teilweise („Genehmigung durch“: IT „richtet ein“) |
| handel | ZR03 | Entzug von Rechten | Ablauf=Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.… | ok |
| handel | ZR04 | Schutzmaßnahmen | Maßnahmen=Persönliche Zugänge (keine Sammelkonten), Zwei-Faktor-Anmeldung, Passwortregeln, Bildschirmsperre… | ok |
| handel | ZR05 | Protokollierung | Protokollierung vorhanden=ja / Auswertung durch=Anbieterprotokolle zu Logins und kritischen Änderungen werden … | **falsch** (Feld „Auswertung durch“ ohne Person) |
| handel | ZR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Jährliche Rechteprüfung, Offboarding-Checkliste / Turnus, wer, Nachweis je Kontrolle=… | ok |
| handel | SN01 | Sicherungskonzept | Daten, Turnus, Ziel, Aufbewahrung=Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen … | ok |
| handel | SN03 | Ersatzverfahren | Ersatzverfahren=Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf… | ok |
| handel | SN04 | Nachbearbeitung | Nacherfassung und Nachweis=Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.… | ok |
| handel | SN05 | Notfallkontakte | Rolle oder Stelle (keine privaten Telefonnummern)=Kontakt: Jonas Marktwege und IT-Betreuung Kassensystem und W… | ok |
| handel | SN92 | Kontrollen im Modul | Durchgeführte Kontrollen=Backup-Erfolgskontrolle, Jährlicher Restore-Test / Turnus, wer, Nachweis je Kontrolle… | ok |
| handel | KF01 | Vollständigkeitskontrollen | Kontrollen=Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen. Sa… | ok |
| handel | KF02 | Richtigkeitskontrollen | Kontrollen=Erkennung über Abstimmungen und Systemhinweise.… | teilweise (keine Richtigkeitskontrolle benannt) |
| handel | KF03 | Abweichungen und Fehler | Ablauf=Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrekt… | ok |
| handel | KF04 | Kontrollnachweise | Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)=Abstimmungsprotokolle, Checklisten zum Monatsabschlu… | ok |
| handel | KF05 | Überwachung des Kontrollsystems | Überwachung durch=Jonas Marktwege / Turnus=Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessänderu… | ok |
| handel | AU01 | Buchhaltungsservice und weitere Dienstleister | Dienstleister und Aufgaben=FiBu und Abschluss: Kanzlei Leinetal GmbH (fiktiv). IT/Cloud: Anbieter und IT-Betre… | ok |
| handel | AU02 | IT- und Cloud-Dienstleister | Anbieter, Leistung, Speicherort=IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich z… | ok |
| handel | AU03 | Übergaben | Übergaben und Nachweis=Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Ü… | ok |
| handel | AU04 | Kontrolle der Dienstleister | Kontrolle=Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. Sara Linde… | ok |
| handel | AU05 | Verantwortungsgrenzen | Abgrenzung=Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Vera… | ok |
| handel | PZ00 | Ansprechpartner | Ansprechpartner (Name oder Rolle)=Jonas Marktwege / Vertretung=Sara Linden… | ok |
| handel | PZ01 | Unmittelbarer Zugriff (Z1) | Nur-Lese-Zugang möglich=ja / Systeme=Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch IT-Betre… | ok |
| handel | PZ02 | Mittelbarer Zugriff (Z2) | Wer erstellt Auswertungen=Sara Linden erstellt Auswertungen nach Vorgabe der Prüfer.… | ok |
| handel | PZ04 | Bereitstellung von Belegen | Ablauf=Ankündigung, Benennung der Ansprechperson (Jonas Marktwege), Bereitstellung von Leserecht oder Export, … | ok |
| handel | PZ06 | Altdaten | Regelung (z. B. Lesezugang, Export, Archivsystem)=Frühere Fassungen der Verfahrensdokumentation und ältere Exp… | ok |
| handel | AE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jonas Marktwege / Vertretung=IT-Betreuung Kassensystem und WaWi (fiktiv)… | ok |
| handel | AE01 | Einführung neuer Systeme | Ablauf=Neue Systeme nur nach Freigabe Jonas Marktwege, mit Eintrag in der Systemliste und Anpassung dieser Dok… | ok |
| handel | AE02 | Updates und Versionswechsel | Ablauf=Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet un… | ok |
| handel | AE03 | Migration und Datenübernahme | Übernahme und Prüfung=Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende… | ok |
| handel | AE05 | Ablaufänderungen | Meldung und Übernahme=Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen … | ok |
| handel | AE06 | Historische Nachvollziehbarkeit | Änderungsverzeichnis, Versionen, Gültigkeitszeiträume=Frühere Fassungen bleiben versioniert im Kundenkonto dow… | ok |
| handel | AE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Änderungsverzeichnis gepflegt, Systemliste nach Änderung aktualisiert / Turnus, wer, … | ok |
| handel | PF01 | Prüfturnus | Turnus=jährlich / Prüfung durch=Jonas Marktwege mit Sara Linden. Jährliche Durchsicht aller aktiven Module und… | ok |
| handel | PF03 | Freigabe durch die Geschäftsleitung | Ablauf (z. B. Unterschrift, Freigabevermerk)=Inhaltliche Freigabe der geänderten Kapitel durch Jonas Marktwege… | ok |
| ecommerce | EC00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lea Bohn (Geschäftsführung) / Vertretung=Steuerkanzlei für Abstimmung, Aushil… | ok |
| ecommerce | EC01 | Verkaufskanäle | Shops und Marktplätze=Eigener Onlineshop (fiktiv) und ein Marktplatz (fiktiv), Verkauf an Privatpersonen in De… | ok |
| ecommerce | EC02 | Shopsystem und Erweiterungen | Shopsystem=Shopsystem (fiktiv) / Plugins und Apps=Rechnungs-Plugin des Shopanbieters, Versandlabel-App… | ok |
| ecommerce | EC03 | Zahlungsdienstleister | Zahlungsdienstleister=Zahlungsdienstleister (fiktiv) für Karte und Wallet; Marktplatz zahlt selbst aus.… | ok |
| ecommerce | EC04 | Bestelldaten | System=Shopsystem und Marktplatz-Backend / Export und Turnus=Monatlicher CSV-Export je Kanal bis zum 5.… | ok |
| ecommerce | EC05 | Steuersätze und Länder | Wer pflegt Steuersätze=Lea Bohn; Steuersätze im Shop je Land hinterlegt / OSS-Verfahren wird genutzt=ja… | ok |
| ecommerce | EC06 | Rechnungen an Kunden | Rechnungserstellung=Shop erstellt die Rechnung automatisch bei Versand als PDF; Marktplatzrechnungen über den … | ok |
| ecommerce | EC07 | Gebühren- und Auszahlungsabrechnungen | Abruf=Gebühren- und Auszahlungsreports monatlich als CSV und PDF aus dem Marktplatz-Backend und dem Händlerkon… | ok |
| ecommerce | EC08 | Abstimmung der Auszahlungen | Wer=Lea Bohn / Turnus=monatlich / Verrechnungskonto in der FiBu=Je Anbieter ein Verrechnungskonto… | ok |
| ecommerce | EC10 | Aufbewahrung der Rohdaten | Ablage=Cloud-Laufwerk, Ordner E-Commerce, monatliche Exporte / Wie lange hält der Anbieter die Daten vor=Markt… | ok |
| ecommerce | EC90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Onlineshop und Marktplatz. / Ausgenommen und wo dokumentiert=Verkauf auf Woch… | ok |
| ecommerce | EC91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Shopsystem (fiktiv), Marktplatz (fiktiv), Zahlungsdienstleister (fiktiv), DATE… | ok |
| ecommerce | EC92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Bestellungen mit Rechnungen, Abgleich Auszahlungen mit dem Bankeingang, Prüf… | ok |
| ecommerce | EC93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, DATEV-Format)=CSV aus Shop, M… | ok |
| ecommerce | EC95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Shopausfall werden keine Bestellungen angenommen; Marktplatz läuft weiter. / Nacherfa… | ok |
| ecommerce | EC96 | Ablage und Archiv | Ablageort=Cloud-Laufwerk, Ordner E-Commerce / Form (Originaldatei, Export, Papier)=Originalexporte CSV und PDF… | ok |
| ecommerce | RT00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Leitung Kundenservice (Anja Berg) / Vertretung=Kai Laufer… | ok |
| ecommerce | RT01 | Retourenkanäle und Erfassung | Wege und Erfassung=Retourenportal im Shop mit Retourenlabel; Marktplatzretouren über das Marktplatz-Backend. /… | ok |
| ecommerce | RT02 | Rückgaberegeln | Regeln und Fristen=Widerruf 14 Tage gesetzlich, freiwilliges Rückgaberecht 30 Tage, Gewährleistung nach Prüfun… | ok |
| ecommerce | RT03 | Warenannahme und Zuordnung | Ablauf=Lager scannt das Retourenlabel, die Retoure wird automatisch der Bestellung zugeordnet. / Zuordnung übe… | ok |
| ecommerce | RT04 | Prüfung und Entscheidung | Wer prüft und entscheidet=Lager prüft, Kundenservice entscheidet / Wie wird die Entscheidung festgehalten=Prüf… | ok |
| ecommerce | RT05 | Korrekturbeleg | Beleg=Stornorechnung / Bezug auf die Ursprungsrechnung=Stornorechnung nennt Nummer und Datum der Ursprungsrech… | ok |
| ecommerce | RT06 | Umsatzsteuerberichtigung | Ablauf=Stornorechnung mindert Umsatz und Umsatzsteuer im selben Voranmeldungszeitraum; Buchung über die DATEV-… | ok |
| ecommerce | RT07 | Erstattung | Erstattungsweg=Rückzahlung über den ursprünglichen Zahlungsweg (Zahlungsdienstleister) / Freigabe=Kundenservic… | ok |
| ecommerce | RT08 | Bestandsbuchung | Bestandsbuchung=Wieder verkaufbare Ware wird zurückgebucht; B-Ware auf eigenen Lagerort; Verschrottung mit Gru… | ok |
| ecommerce | RT10 | Ablage | Ablageort=WaWi Lagerplus (fiktiv), Retourenvorgang / Ordnung (z. B. Retourennummer)=Retourennummer… | ok |
| ecommerce | RT90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Retouren aus eigenem Shop und Marktplätzen. / Ausgenommen und wo dokumentiert… | ok |
| ecommerce | RT91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Shopsystem (fiktiv) mit Retourenportal; WaWi Lagerplus (fiktiv); Zahlungsdiens… | ok |
| ecommerce | RT92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Erstattungen mit Korrekturbelegen, Zusätzliche Freigabe von Erstattungen übe… | ok |
| ecommerce | RT93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| ecommerce | RT94 | Änderungsmanagement | Wer gibt Änderungen frei=Kai Laufer / Dokumentation der Änderungen=Änderungen an Rückgaberegeln, Retourengründ… | ok |
| ecommerce | RT95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall des Retourenportals werden Retouren im Lager auf einer Liste erfasst und spät… | ok |
| ecommerce | RT96 | Ablage und Archiv | Ablageort=WaWi Lagerplus (fiktiv) und DATEV Unternehmen online / Form (Originaldatei, Export, Papier)=Original… | ok |
| ecommerce | WW00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lagerleitung (Peter Holm) / Vertretung=Martin Eichenblatt… | ok |
| ecommerce | WW01 | System | System=WaWi Lagerplus (fiktiv), Version 9 / Erfasste Vorgänge=Artikelstamm, Bestellungen, Wareneingang, Liefer… | ok |
| ecommerce | WW02 | Artikelstammdaten und Preise | Wer pflegt Artikel und Preise=Einkauf (Lena Brandt) / Wer gibt Preisänderungen frei=Martin Eichenblatt bei Pre… | ok |
| ecommerce | WW03 | Wareneingang | Ablauf=Lagerpersonal prüft Menge und Zustand gegen Lieferschein und Bestellung, scannt den Lieferschein und bu… | ok |
| ecommerce | WW04 | Warenausgang | Ablauf=Warenausgang wird mit dem Lieferschein aus dem Auftrag gebucht; Eigenverbrauch über eigene Bewegungsart… | ok |
| ecommerce | WW05 | Bestandsführung und Bewertung | Bestandsführung=Laufend im System / Bewertungsverfahren (z. B. Durchschnitt, Einzelbewertung)=Gleitender Durch… | ok |
| ecommerce | WW06 | Lagerorte und Umlagerungen | Lagerorte=Halle A, Halle B, Freilager / Buchung von Umlagerungen=Umlagerung als eigene Buchung mit Quell- und … | ok |
| ecommerce | WW07 | Bestandskorrekturen | Wer bucht=Lagerleitung / Wer gibt frei=Martin Eichenblatt ab 500 Euro / Korrekturgrund wird erfasst=ja… | ok |
| ecommerce | WW08 | Inventur | Verfahren=Permanente Inventur / Wer zählt und prüft=Zählteams aus zwei Personen, Prüfung durch die Lagerleitun… | ok |
| ecommerce | WW09 | Inventurdifferenzen | Ablauf der Klärung=Differenzen über 2 Prozent werden nachgezählt. Ungeklärte Differenzen bucht die Lagerleitun… | ok |
| ecommerce | WW10 | Übergabe an die Buchhaltung | Weg der Übergabe=Monatliche Bestandsliste mit Bestandswert als PDF und CSV an die Kanzlei über DATEV Unternehm… | ok |
| ecommerce | WW90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle drei Lagerorte am Standort Musterhausen. / Ausgenommen und wo dokumentie… | ok |
| ecommerce | WW91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=WaWi Lagerplus (fiktiv) auf dem Firmenserver; Handscanner im Lager; DATEV Unte… | ok |
| ecommerce | WW92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Wareneingang mit Lieferschein und Bestellung, Freigabe von Bestandskorrektur… | ok |
| ecommerce | WW93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträge… | ok |
| ecommerce | WW94 | Änderungsmanagement | Wer gibt Änderungen frei=Martin Eichenblatt / Dokumentation der Änderungen=Änderungen an Bewertungsparametern,… | ok |
| ecommerce | WW95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Serverausfall Erfassung auf Papierlieferscheinen, Nacherfassung nach Wiederanlauf. / … | ok |
| ecommerce | BA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jana Hellweg (Partnerin) / Vertretung=Lukas Berger (Partner)… | ok |
| ecommerce | BA01 | Konten | Konten (Bank, Zweck)=Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).… | ok |
| ecommerce | BA02 | Vollmachten und Zugänge | Vollmachten (Einzel- oder Gemeinschaftsvollmacht)=Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam.… | ok |
| ecommerce | BA03 | Kontoauszüge | Format=Elektronisch (Datensatz/Schnittstelle) / Ablage=DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Ko… | ok |
| ecommerce | BA04 | Zahlungsvorbereitung | Ablauf=Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software. / Wer… | ok |
| ecommerce | BA05 | Zahlungsfreigabe | Wer gibt frei=Ein Partner, über 10.000 Euro beide Partner / Vier-Augen-Prinzip=ja / Limits=Einzelfreigabe bis … | ok |
| ecommerce | BA06 | Lastschriften und Daueraufträge | Überwachung=Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht. / Wer überwac… | ok |
| ecommerce | BA07 | Bankabstimmung | Wer=Paul Richter / Turnus=monatlich… | ok |
| ecommerce | BA08 | Übergabe an die Buchhaltung | Weg=Automatischer Abruf in die FiBu / Beschreibung=Kontoumsätze werden täglich über DATEV Bankdaten abgerufen.… | ok |
| ecommerce | BA10 | Ungeklärte Posten | Ablauf=Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage. / Wer klärt=Pa… | ok |
| ecommerce | BA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Bankkonten und die Firmenkreditkarte. / Ausgenommen und wo dokumentiert… | ok |
| ecommerce | BA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen o… | ok |
| ecommerce | BA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Vier-Augen-Freigabe von Zahlungen, Monatliche Abstimmung Saldo Bank und FiBu, Durchsi… | ok |
| ecommerce | BA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| ecommerce | BA94 | Änderungsmanagement | Wer gibt Änderungen frei=Jana Hellweg / Dokumentation der Änderungen=Änderungen an Vollmachten und Limits mit … | ok |
| ecommerce | BA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der Banking-Software Freigabe direkt im Bankportal. / Nacherfassung und Nachw… | ok |
| ecommerce | BA96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Bankportal / Form (Originaldatei, Export, Papier)=Elektronische Kontoau… | ok |
| ecommerce | VK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nora Klar (Geschäftsführung) / Vertretung=Felix Hahn (Büro)… | ok |
| ecommerce | VK01 | Ablauf und System | Ablauf=Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst… | ok |
| ecommerce | VK02 | Angebote und Aufträge | System=Faktura+ (fiktiv) / Ablage=Am Projekt in Faktura+… | ok |
| ecommerce | VK03 | Preise und Konditionen | Wer legt fest=Nora Klar / Wer gibt Sonderkonditionen frei=Nora Klar bei Rabatten über 10 Prozent… | ok |
| ecommerce | VK04 | Kundenstammdaten | Wer pflegt=Felix Hahn / Änderungen werden protokolliert=ja… | ok |
| ecommerce | VK05 | Rechnungsnummern | Vergabe=Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer / Nummernkreise=Ein Nummernkrei… | ok |
| ecommerce | VK06 | Pflichtangaben | Vorlage und Prüfung=Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem P… | ok |
| ecommerce | VK07 | Rechnungsversand | Format=PDF per E-Mail, XRechnung / E-Rechnungen können versendet werden=ja… | ok |
| ecommerce | VK08 | Korrektur und Storno | Ablauf=Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kei… | ok |
| ecommerce | VK09 | Offene Posten und Mahnwesen | Wer=Felix Hahn / Turnus=wöchentlich; Mahnung nach 14 Tagen Verzug… | ok |
| ecommerce | VK10 | Übergabe an die Buchhaltung | Weg der Übergabe=Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen onli… | ok |
| ecommerce | VK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Leistungen der Agentur an Geschäftskunden. / Ausgenommen und wo dokument… | ok |
| ecommerce | VK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen on… | ok |
| ecommerce | VK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Lückenprüfung der Rechnungsnummern, Abgleich erbrachter Leistungen mit gestellten Rec… | ok |
| ecommerce | VK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| ecommerce | VK94 | Änderungsmanagement | Wer gibt Änderungen frei=Nora Klar / Dokumentation der Änderungen=Änderungen an Rechnungsvorlage, Nummernkreis… | ok |
| ecommerce | UO01 | Gesellschaften und Standorte | Gesellschaften (Name, Rechtsform, Steuernummer optional)=Paketpfad Online GmbH (Muster, fiktiv), einzige Gesel… | ok |
| ecommerce | UO02 | Tätigkeiten und Geschäftsvorfälle | Tätigkeiten und Umsatzarten=E-Commerce über eigenen Shop und Marktplätze. Steuerrelevante Vorgänge: Aufträge b… | ok |
| ecommerce | UO03 | Zuständigkeiten | Aufgabe und zuständige Person oder Rolle=Geschäftsführung und Gesamtverantwortung: Mira Paketpfad. Interne Buc… | ok |
| ecommerce | UO04 | Vertretungsregelung | Vertretungsregelung=Bei Abwesenheit von Mira Paketpfad übernimmt Nils Strom die laufende Belegprüfung und Zahl… | ok |
| ecommerce | UO05 | Zeichnungs- und Freigabebefugnisse | Befugnis, Person oder Rolle, Betragsgrenze=Vertragsabschluss und Ausgangsrechnungen: Mira Paketpfad. Zahlungsf… | ok |
| ecommerce | UO06 | Geltungsbereich und Abgrenzung | Geltungsbereich=Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort Leipzig. / Nicht erfasst… | ok |
| ecommerce | LE01 | Auftragsänderungen und Nachträge | Ablauf und Form der Bestätigung=Auftragsänderungen nur schriftlich (E-Mail) und mit neuer Auftragsversion. Sto… | ok |
| ecommerce | LE02 | Lieferung und Leistungsnachweis | Nachweisarten=Leistung wird durch Lieferschein, Abnahmeprotokoll oder Leistungsnachweis (Stunden/Projekt) doku… | ok |
| ecommerce | LE03 | Abnahmen | Ablauf der Abnahme=Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestäti… | ok |
| ecommerce | LE05 | Vollständige Abrechnung | Abgleich Leistung – Rechnung=Nach Leistungserbringung bzw. Lieferung erstellt Nils Strom die Rechnung. Laufend… | ok |
| ecommerce | LE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abstimmung offene Aufträge mit Rechnungen, Stichprobe Leistungsnachweis vor Rechnung … | ok |
| ecommerce | AR00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nils Strom / Vertretung=Mira Paketpfad… | ok |
| ecommerce | AR01 | Abschlags- und Schlussrechnungen | Ablauf und Verrechnung=Abschlags- und Schlussrechnungen bei Projekten; Schlussrechnung stellt den Gesamtbezug … | ok |
| ecommerce | AR02 | Gutschriften | Art=Korrektur / Rechnungsminderung / Bezeichnung auf dem Beleg=Gutschrift, mit eigener Nummer und Verweis auf … | ok |
| ecommerce | AR03 | Stornos und Berichtigungen | Ablauf mit Bezug zur Ursprungsrechnung=Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Beric… | ok |
| ecommerce | AR04 | Rechnungsdoppel und Archiv | Ablageort=Archiv der Rechnungssoftware bzw. DATEV / Format (PDF, XML, Papier)=PDF und strukturierte Rechnungsd… | ok |
| ecommerce | AR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Nummernkreis lückenlos, Abstimmung Ausgangsrechnungen mit FiBu / Turnus, wer, Nachwei… | ok |
| ecommerce | ER00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nils Strom / Vertretung=Mira Paketpfad… | ok |
| ecommerce | ER01 | Empfangskanäle | Zentrales Postfach oder Portal=E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen… | ok |
| ecommerce | ER02 | Anzeige und Prüfung | Viewer oder Software=Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch… | ok |
| ecommerce | ER03 | Erstellung und Versand | Format=XRechnung, ZUGFeRD / System für Erstellung und Versand=Ausgangs-E-Rechnungen erzeugt die Rechnungssoftw… | ok |
| ecommerce | ER04 | Speicherung der strukturierten Daten | Speicherort und Verknüpfung=Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID. Da… | ok |
| ecommerce | ER92 | Kontrollen im Modul | Durchgeführte Kontrollen=Validierung E-Rechnung, Vollständigkeit Eingangsjournal / Turnus, wer, Nachweis je Ko… | ok |
| ecommerce | PB00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nils Strom / Vertretung=Mira Paketpfad… | ok |
| ecommerce | PB01 | Scanvorgang | Gerät oder App=Büroscanner (fiktiv) / Ablauf und Zeitpunkt=Papierpost wird zentral geöffnet, mit Eingangsstemp… | ok |
| ecommerce | PB02 | Qualitätskontrolle | Wer prüft=Nils Strom / Prüfkriterien=Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) v… | ok |
| ecommerce | PB03 | Übergabe ins Archiv | Übergabe und Indexierung=Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitges… | ok |
| ecommerce | PB04 | Aufbewahrung der Papieroriginale | Ablageort=Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat. / Dauer=bis zur … | ok |
| ecommerce | PB05 | Vernichtung der Originale | Vernichtung nach dem Scannen=ja / Zeitpunkt, Freigabe, Ausnahmen=Vernichtung nach Checkliste (Frist, keine Bet… | ok |
| ecommerce | PB92 | Kontrollen im Modul | Durchgeführte Kontrollen=Scan-Qualitätskontrolle, Eingangsstempel und Vollständigkeit / Turnus, wer, Nachweis … | ok |
| ecommerce | ZD01 | Zahlungsdienstleister und Kartenzahlung | Anbieter, Zahlungsarten, Auszahlungsrhythmus=Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Last… | ok |
| ecommerce | ZD02 | Gebühren und Auszahlungsabrechnungen | Abruf, Ablage, Buchung=Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten du… | ok |
| ecommerce | ZD03 | Rückzahlungen und Rückbelastungen | Ablauf und Beleg=Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt. … | ok |
| ecommerce | ZD04 | Abgleich offener Posten | Abgleich und Klärung=Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; n… | ok |
| ecommerce | BU00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nils Strom / Vertretung=Mira Paketpfad… | ok |
| ecommerce | BU01 | Belegzuordnung und Kontierung | Wer kontiert=Nils Strom / Automatische Buchungsregeln oder Vorschläge=Interne Vorkontierung in DATEV Unternehm… | ok |
| ecommerce | BU02 | Buchungsrhythmus und Festschreibung | Buchungsrhythmus=zum Periodenabschluss / Festschreibung (wann, durch wen)=Festschreibung nach Abstimmung mit d… | ok |
| ecommerce | BU03 | Korrekturen | Ablauf=Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze… | ok |
| ecommerce | BU04 | Abstimmungen | Abstimmungen=Bank, Offene Posten Debitoren, Offene Posten Kreditoren, Umsatzsteuer / Turnus und wer=Monatlich:… | ok |
| ecommerce | BU06 | Abschlussarbeiten | Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)=Jahresabschluss erstellt di… | ok |
| ecommerce | BU07 | Übergabe an die Kanzlei | Inhalt, Termin, Weg=Kanzlei: Kanzlei Elsterbogen GmbH (fiktiv). Laufende FiBu, USt-Voranmeldung, Jahresabschlu… | teilweise (Mandatsumfang statt Übergabe/Termin/Weg/Nachweis) |
| ecommerce | BU92 | Kontrollen im Modul | Durchgeführte Kontrollen=Monatsabschluss-Abstimmung, Belegvollständigkeit / Turnus, wer, Nachweis je Kontrolle… | ok |
| ecommerce | BS00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Mira Paketpfad / Vertretung=Nils Strom… | ok |
| ecommerce | BS01 | Branchenspezifische Vorgänge | Branche=E-Commerce / Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträge)=Branch… | ok |
| ecommerce | BS02 | Branchensoftware | System oder Gerät, Zweck, Anbieter=Branchensoftware bzw. Gerät laut Modul Vorsystem (fiktiv); Schnittstelle zu… | ok |
| ecommerce | BS03 | Erfassung der Grunddaten | Erfassung, wer, wann=Grunddaten erfasst fachlich geschultes Personal; Änderungen an Preisen/Stammdaten nur mit… | ok |
| ecommerce | BS04 | Nachweise | Nachweis und Ablageort=Je Vorgang die branchentypischen Nachweise (z. B. Projektnachweis, Leistungsdokumentati… | ok |
| ecommerce | BS06 | Besondere steuerliche Regeln | Regel und wie sie im Ablauf umgesetzt wird=Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch Nils St… | **falsch** (Abstimmung statt steuerlicher Regel) |
| ecommerce | BS07 | Übergabe an die Buchhaltung | Weg (Schnittstelle, Export, manuell)=Periodischer Export an DATEV Unternehmen online. / Turnus=Monatlich.… | ok |
| ecommerce | BS92 | Kontrollen im Modul | Durchgeführte Kontrollen=Summenabstimmung Vorsystem/FiBu, Rechteprüfung / Turnus, wer, Nachweis je Kontrolle=M… | ok |
| ecommerce | AW01 | Archivsystem | Elektronisches Archiv=DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und … | ok |
| ecommerce | AW02 | Suchmerkmale | Suchmerkmale=Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATE… | ok |
| ecommerce | AW03 | Verknüpfung Beleg und Buchung | Verknüpfung=Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: Nils Strom.… | ok |
| ecommerce | AW04 | Lesbarkeit über die Frist | Maßnahmen=PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch Nils Strom. Form… | ok |
| ecommerce | AW05 | Schutz vor unbemerkten Änderungen | Maßnahmen=Schreibschutz / Unveränderbarkeit im Archiv, Versionierung mit Protokoll / Details=Keine Überschreib… | ok |
| ecommerce | AW92 | Kontrollen im Modul | Durchgeführte Kontrollen=Stichprobe Wiederauffindbarkeit, Lesbarkeitsprüfung / Turnus, wer, Nachweis je Kontro… | ok |
| ecommerce | AF01 | Fristzuordnung | Verfahren der Zuordnung=Jeder Unterlagenart wird ihre Frist nach § 147 Abs. 1, 3 AO zugeordnet: Bücher, Aufzei… | ok |
| ecommerce | AF02 | Weitere Aufbewahrungsgründe | Prüfung vor Löschung=Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wi… | ok |
| ecommerce | AF03 | Löschfreigabe | Freigabe durch=Löschung erst nach Fristende und schriftlicher Freigabe durch Mira Paketpfad, Abstimmung mit Ka… | ok |
| ecommerce | AF04 | Durchführung und Protokoll | Durchführung=Technische Löschung durch Shop- und Marktplatz-Technik (extern, fiktiv) bzw. Anbieter nach Freiga… | ok |
| ecommerce | AF05 | Datenschutz und Aufbewahrung | Vorgehen (z. B. Sperrung statt Löschung)=Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach … | ok |
| ecommerce | SY01 | Hardware und Betriebsumgebung | Umgebung=Rechnungssoftware, DATEV Unternehmen online, E-Mail, NAS, ggf. Kasse/Shop/WaWi laut Betriebs-Check. I… | ok |
| ecommerce | SY02 | Schnittstellen | Schnittstellen=Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über … | ok |
| ecommerce | SY03 | Importe, Exporte und Konvertierungen | Vorgänge und Prüfung=Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, … | ok |
| ecommerce | SY04 | Eigene Berechnungen und Automatisierungen | Vorhanden=ja / Beschreibung (Zweck, Ersteller, Änderung)=Wiederkehrende Exporte und Erinnerungen; keine unprot… | ok |
| ecommerce | SY92 | Kontrollen im Modul | Durchgeführte Kontrollen=Schnittstellenprotokoll, Systemliste aktuell / Turnus, wer, Nachweis je Kontrolle=Nac… | ok |
| ecommerce | ZR01 | Rollen und Berechtigungen | Rolle und Rechte je System=Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränk… | ok |
| ecommerce | ZR02 | Vergabe von Rechten | Antrag durch=Mira Paketpfad beantragt neue Zugänge / Genehmigung durch=Shop- und Marktplatz-Technik (extern, f… | teilweise („Genehmigung durch“: IT „richtet ein“) |
| ecommerce | ZR03 | Entzug von Rechten | Ablauf=Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.… | ok |
| ecommerce | ZR04 | Schutzmaßnahmen | Maßnahmen=Persönliche Zugänge (keine Sammelkonten), Zwei-Faktor-Anmeldung, Passwortregeln, Bildschirmsperre… | ok |
| ecommerce | ZR05 | Protokollierung | Protokollierung vorhanden=ja / Auswertung durch=Anbieterprotokolle zu Logins und kritischen Änderungen werden … | **falsch** (Feld „Auswertung durch“ ohne Person) |
| ecommerce | ZR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Jährliche Rechteprüfung, Offboarding-Checkliste / Turnus, wer, Nachweis je Kontrolle=… | ok |
| ecommerce | SN01 | Sicherungskonzept | Daten, Turnus, Ziel, Aufbewahrung=Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen … | ok |
| ecommerce | SN03 | Ersatzverfahren | Ersatzverfahren=Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf… | ok |
| ecommerce | SN04 | Nachbearbeitung | Nacherfassung und Nachweis=Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.… | ok |
| ecommerce | SN05 | Notfallkontakte | Rolle oder Stelle (keine privaten Telefonnummern)=Kontakt: Mira Paketpfad und Shop- und Marktplatz-Technik (ex… | ok |
| ecommerce | SN92 | Kontrollen im Modul | Durchgeführte Kontrollen=Backup-Erfolgskontrolle, Jährlicher Restore-Test / Turnus, wer, Nachweis je Kontrolle… | ok |
| ecommerce | KF01 | Vollständigkeitskontrollen | Kontrollen=Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen. Ni… | ok |
| ecommerce | KF02 | Richtigkeitskontrollen | Kontrollen=Erkennung über Abstimmungen und Systemhinweise.… | teilweise (keine Richtigkeitskontrolle benannt) |
| ecommerce | KF03 | Abweichungen und Fehler | Ablauf=Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrekt… | ok |
| ecommerce | KF04 | Kontrollnachweise | Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)=Abstimmungsprotokolle, Checklisten zum Monatsabschlu… | ok |
| ecommerce | KF05 | Überwachung des Kontrollsystems | Überwachung durch=Mira Paketpfad / Turnus=Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessänderun… | ok |
| ecommerce | AU01 | Buchhaltungsservice und weitere Dienstleister | Dienstleister und Aufgaben=FiBu und Abschluss: Kanzlei Elsterbogen GmbH (fiktiv). IT/Cloud: Anbieter und Shop-… | ok |
| ecommerce | AU02 | IT- und Cloud-Dienstleister | Anbieter, Leistung, Speicherort=IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich z… | ok |
| ecommerce | AU03 | Übergaben | Übergaben und Nachweis=Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Ü… | ok |
| ecommerce | AU04 | Kontrolle der Dienstleister | Kontrolle=Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. Nils Strom… | ok |
| ecommerce | AU05 | Verantwortungsgrenzen | Abgrenzung=Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Vera… | ok |
| ecommerce | PZ00 | Ansprechpartner | Ansprechpartner (Name oder Rolle)=Mira Paketpfad / Vertretung=Nils Strom… | ok |
| ecommerce | PZ01 | Unmittelbarer Zugriff (Z1) | Nur-Lese-Zugang möglich=ja / Systeme=Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch Shop- un… | ok |
| ecommerce | PZ02 | Mittelbarer Zugriff (Z2) | Wer erstellt Auswertungen=Nils Strom erstellt Auswertungen nach Vorgabe der Prüfer.… | ok |
| ecommerce | PZ04 | Bereitstellung von Belegen | Ablauf=Ankündigung, Benennung der Ansprechperson (Mira Paketpfad), Bereitstellung von Leserecht oder Export, P… | ok |
| ecommerce | PZ06 | Altdaten | Regelung (z. B. Lesezugang, Export, Archivsystem)=Frühere Fassungen der Verfahrensdokumentation und ältere Exp… | ok |
| ecommerce | AE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Mira Paketpfad / Vertretung=Shop- und Marktplatz-Technik (extern, fiktiv)… | ok |
| ecommerce | AE01 | Einführung neuer Systeme | Ablauf=Neue Systeme nur nach Freigabe Mira Paketpfad, mit Eintrag in der Systemliste und Anpassung dieser Doku… | ok |
| ecommerce | AE02 | Updates und Versionswechsel | Ablauf=Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet un… | ok |
| ecommerce | AE03 | Migration und Datenübernahme | Übernahme und Prüfung=Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende… | ok |
| ecommerce | AE05 | Ablaufänderungen | Meldung und Übernahme=Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen … | ok |
| ecommerce | AE06 | Historische Nachvollziehbarkeit | Änderungsverzeichnis, Versionen, Gültigkeitszeiträume=Frühere Fassungen bleiben versioniert im Kundenkonto dow… | ok |
| ecommerce | AE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Änderungsverzeichnis gepflegt, Systemliste nach Änderung aktualisiert / Turnus, wer, … | ok |
| ecommerce | PF01 | Prüfturnus | Turnus=jährlich / Prüfung durch=Mira Paketpfad mit Nils Strom. Jährliche Durchsicht aller aktiven Module und n… | ok |
| ecommerce | PF03 | Freigabe durch die Geschäftsleitung | Ablauf (z. B. Unterschrift, Freigabevermerk)=Inhaltliche Freigabe der geänderten Kapitel durch Mira Paketpfad … | ok |
| gastro | KA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Clara Sonnenkorn (Geschäftsführung) / Vertretung=Jonas Weber (Büro)… | ok |
| gastro | KA01 | Kassenart | Art=Elektronisches Kassensystem mit TSE / Hersteller und Software=KassaPro Gastro (fiktiv) auf Stationen Theke… | ok |
| gastro | KA02 | TSE und Mitteilung | TSE-Art (z. B. USB, SD, Cloud-TSE)=Cloud-TSE des Kassenanbieters / BSI-Zertifikat der TSE liegt vor=ja / Mitte… | ok |
| gastro | KA03 | Belegausgabe | Belegausgabe=Papierbon, Elektronischer Beleg (QR, E-Mail, App) / Befreiung von der Belegausgabepflicht beantra… | ok |
| gastro | KA04 | Kassenöffnung und Bedienende | Ablauf der Kassenöffnung=Filialleitung zählt morgens das Wechselgeld (200 Euro je Kasse) und erfasst den Anfan… | ok |
| gastro | KA05 | Tagesabschluss | Ablauf Tagesabschluss=Nach Ladenschluss zählt die Filialleitung den Bestand mit Zählprotokoll im Kassensystem,… | ok |
| gastro | KA06 | Kassenbuch oder Kassenbericht | Form=Kassenbuch im Kassensystem / Wer führt=Filialleitung, Kontrolle durch Jonas Weber / Zählprotokoll wird er… | ok |
| gastro | KA07 | Einlagen, Entnahmen, Sonderfälle | Erfassung der Sonderfälle=Storni nur mit Filialleitungs-Kennung und Grund. Entnahmen und Einlagen als eigene B… | ok |
| gastro | KA08 | Bargeldtransfer | Ablauf=Abschöpfung über 500 Euro in den Tresor mit Buchung im System. Bankeinzahlung zweimal wöchentlich durch… | ok |
| gastro | KA09 | Programmierung und Organisationsunterlagen | Wer darf ändern=Clara Sonnenkorn, technische Umsetzung durch den Kassenhändler / Änderungen werden protokollie… | ok |
| gastro | KA10 | Übergabe an die Buchhaltung | Weg der Übergabe=Monatlicher DATEV-Export aus dem Kassensystem, Upload in DATEV Unternehmen online. / Turnus=m… | ok |
| gastro | KA11 | Kassen-Nachschau | Ansprechperson vor Ort=Filialleitung vor Ort, telefonisch Clara Sonnenkorn / Datenzugriff / Export=DSFinV-K-Ex… | ok |
| gastro | KA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Filialen (Hauptstraße und Bahnhof) mit allen drei Kassen. / Ausgenommen… | ok |
| gastro | KA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=KassaPro (fiktiv): Kassensoftware, Anbieter KassaPro GmbH. Cloud-TSE des Anbie… | ok |
| gastro | KA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Täglicher Kassensturz (Soll-Ist-Abgleich), Abgleich Z-Bon mit Kassenbuch und Bankeinz… | ok |
| gastro | KA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| gastro | KA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall des Kassensystems: Notbetrieb mit Quittungsblock und Strichliste, Ausfallzeit… | ok |
| gastro | KA96 | Ablage und Archiv | Ablageort=Cloud-Archiv des Kassenanbieters und jährlicher Export auf das NAS / Form (Originaldatei, Export, Pa… | ok |
| gastro | WW00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Lagerleitung (Peter Holm) / Vertretung=Martin Eichenblatt… | ok |
| gastro | WW01 | System | System=WaWi Lagerplus (fiktiv), Version 9 / Erfasste Vorgänge=Artikelstamm, Bestellungen, Wareneingang, Liefer… | ok |
| gastro | WW02 | Artikelstammdaten und Preise | Wer pflegt Artikel und Preise=Einkauf (Lena Brandt) / Wer gibt Preisänderungen frei=Martin Eichenblatt bei Pre… | ok |
| gastro | WW03 | Wareneingang | Ablauf=Lagerpersonal prüft Menge und Zustand gegen Lieferschein und Bestellung, scannt den Lieferschein und bu… | ok |
| gastro | WW04 | Warenausgang | Ablauf=Warenausgang wird mit dem Lieferschein aus dem Auftrag gebucht; Eigenverbrauch über eigene Bewegungsart… | ok |
| gastro | WW05 | Bestandsführung und Bewertung | Bestandsführung=Laufend im System / Bewertungsverfahren (z. B. Durchschnitt, Einzelbewertung)=Gleitender Durch… | ok |
| gastro | WW06 | Lagerorte und Umlagerungen | Lagerorte=Halle A, Halle B, Freilager / Buchung von Umlagerungen=Umlagerung als eigene Buchung mit Quell- und … | ok |
| gastro | WW07 | Bestandskorrekturen | Wer bucht=Lagerleitung / Wer gibt frei=Martin Eichenblatt ab 500 Euro / Korrekturgrund wird erfasst=ja… | ok |
| gastro | WW08 | Inventur | Verfahren=Permanente Inventur / Wer zählt und prüft=Zählteams aus zwei Personen, Prüfung durch die Lagerleitun… | ok |
| gastro | WW09 | Inventurdifferenzen | Ablauf der Klärung=Differenzen über 2 Prozent werden nachgezählt. Ungeklärte Differenzen bucht die Lagerleitun… | ok |
| gastro | WW10 | Übergabe an die Buchhaltung | Weg der Übergabe=Monatliche Bestandsliste mit Bestandswert als PDF und CSV an die Kanzlei über DATEV Unternehm… | ok |
| gastro | WW90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle drei Lagerorte am Standort Musterhausen. / Ausgenommen und wo dokumentie… | ok |
| gastro | WW91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=WaWi Lagerplus (fiktiv) auf dem Firmenserver; Handscanner im Lager; DATEV Unte… | ok |
| gastro | WW92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Wareneingang mit Lieferschein und Bestellung, Freigabe von Bestandskorrektur… | ok |
| gastro | WW93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträge… | ok |
| gastro | WW94 | Änderungsmanagement | Wer gibt Änderungen frei=Martin Eichenblatt / Dokumentation der Änderungen=Änderungen an Bewertungsparametern,… | ok |
| gastro | WW95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Serverausfall Erfassung auf Papierlieferscheinen, Nacherfassung nach Wiederanlauf. / … | ok |
| gastro | EK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Einkaufsleitung (Murat Aydin) / Vertretung=Eva Lindner… | ok |
| gastro | EK01 | Bedarfsmeldung | Ablauf=Bedarf entsteht aus Mindestbeständen im ERP und aus Fertigungsaufträgen; Abteilungen melden Sonderbedar… | ok |
| gastro | EK02 | Bestellberechtigung | Wer bestellt=Einkauf / Freigabegrenzen=bis 5.000 Euro Einkauf allein; darüber Freigabe / Wer gibt frei=Eva Lin… | ok |
| gastro | EK03 | Bestellweg | Bestellwege=ERP / Warenwirtschaft, Lieferantenportal, E-Mail / System=ERP Fertigplan (fiktiv)… | ok |
| gastro | EK04 | Auftragsbestätigung | Wer prüft=Einkauf / Umgang mit Abweichungen=Abweichungen bei Preis oder Termin werden im ERP vermerkt und mit … | ok |
| gastro | EK05 | Wareneingang und Leistungsnachweis | Ablauf=Wareneingang im ERP gegen die Bestellung; Dienstleistungen bestätigt die anfordernde Abteilung im ERP. … | ok |
| gastro | EK06 | Abgleich Bestellung, Lieferung, Rechnung | Ablauf=Rechnung wird im ERP der Bestellung und dem Wareneingang zugeordnet; Abweichungen über 2 Prozent gehen … | ok |
| gastro | EK07 | Lieferantenstammdaten | Wer pflegt=Einkauf legt an, Buchhaltung bestätigt Bankdaten / Bankdatenänderung im Vier-Augen-Prinzip=ja… | ok |
| gastro | EK08 | Rahmenverträge und Abonnements | Verträge und Überwachung=Rahmenverträge für Rohmaterial und Wartungsverträge, Liste im ERP mit Laufzeit und Kü… | ok |
| gastro | EK10 | Ablage der Einkaufsunterlagen | Ablageort=ERP Fertigplan (fiktiv), Dokumente am Bestellvorgang / Ordnung (z. B. Bestellnummer)=Bestellnummer… | ok |
| gastro | EK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Einkauf von Material, Handelsware und Dienstleistungen am Standort Musterbach… | ok |
| gastro | EK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=ERP Fertigplan (fiktiv): Einkauf und Lager, Cloud. Lieferantenportale zweier G… | ok |
| gastro | EK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Freigabe nach Wertgrenzen, Drei-Wege-Abgleich Bestellung, Lieferung, Rechnung, Vier-A… | ok |
| gastro | EK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| gastro | EK94 | Änderungsmanagement | Wer gibt Änderungen frei=Eva Lindner / Dokumentation der Änderungen=Änderungen an Freigabegrenzen und Rollen a… | ok |
| gastro | EK95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei ERP-Ausfall Bestellungen per E-Mail mit Bestellnummernliste, Nacherfassung im ERP. / … | ok |
| gastro | EK96 | Ablage und Archiv | Ablageort=ERP Fertigplan (fiktiv) mit jährlichem Export auf das Firmenlaufwerk / Form (Originaldatei, Export, … | ok |
| gastro | VK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nora Klar (Geschäftsführung) / Vertretung=Felix Hahn (Büro)… | ok |
| gastro | VK01 | Ablauf und System | Ablauf=Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst… | ok |
| gastro | VK02 | Angebote und Aufträge | System=Faktura+ (fiktiv) / Ablage=Am Projekt in Faktura+… | ok |
| gastro | VK03 | Preise und Konditionen | Wer legt fest=Nora Klar / Wer gibt Sonderkonditionen frei=Nora Klar bei Rabatten über 10 Prozent… | ok |
| gastro | VK04 | Kundenstammdaten | Wer pflegt=Felix Hahn / Änderungen werden protokolliert=ja… | ok |
| gastro | VK05 | Rechnungsnummern | Vergabe=Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer / Nummernkreise=Ein Nummernkrei… | ok |
| gastro | VK06 | Pflichtangaben | Vorlage und Prüfung=Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem P… | ok |
| gastro | VK07 | Rechnungsversand | Format=PDF per E-Mail, XRechnung / E-Rechnungen können versendet werden=ja… | ok |
| gastro | VK08 | Korrektur und Storno | Ablauf=Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kei… | ok |
| gastro | VK09 | Offene Posten und Mahnwesen | Wer=Felix Hahn / Turnus=wöchentlich; Mahnung nach 14 Tagen Verzug… | ok |
| gastro | VK10 | Übergabe an die Buchhaltung | Weg der Übergabe=Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen onli… | ok |
| gastro | VK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Leistungen der Agentur an Geschäftskunden. / Ausgenommen und wo dokument… | ok |
| gastro | VK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen on… | ok |
| gastro | VK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Lückenprüfung der Rechnungsnummern, Abgleich erbrachter Leistungen mit gestellten Rec… | ok |
| gastro | VK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| gastro | VK94 | Änderungsmanagement | Wer gibt Änderungen frei=Nora Klar / Dokumentation der Änderungen=Änderungen an Rechnungsvorlage, Nummernkreis… | ok |
| gastro | BA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jana Hellweg (Partnerin) / Vertretung=Lukas Berger (Partner)… | ok |
| gastro | BA01 | Konten | Konten (Bank, Zweck)=Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).… | ok |
| gastro | BA02 | Vollmachten und Zugänge | Vollmachten (Einzel- oder Gemeinschaftsvollmacht)=Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam.… | ok |
| gastro | BA03 | Kontoauszüge | Format=Elektronisch (Datensatz/Schnittstelle) / Ablage=DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Ko… | ok |
| gastro | BA04 | Zahlungsvorbereitung | Ablauf=Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software. / Wer… | ok |
| gastro | BA05 | Zahlungsfreigabe | Wer gibt frei=Ein Partner, über 10.000 Euro beide Partner / Vier-Augen-Prinzip=ja / Limits=Einzelfreigabe bis … | ok |
| gastro | BA06 | Lastschriften und Daueraufträge | Überwachung=Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht. / Wer überwac… | ok |
| gastro | BA07 | Bankabstimmung | Wer=Paul Richter / Turnus=monatlich… | ok |
| gastro | BA08 | Übergabe an die Buchhaltung | Weg=Automatischer Abruf in die FiBu / Beschreibung=Kontoumsätze werden täglich über DATEV Bankdaten abgerufen.… | ok |
| gastro | BA10 | Ungeklärte Posten | Ablauf=Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage. / Wer klärt=Pa… | ok |
| gastro | BA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Bankkonten und die Firmenkreditkarte. / Ausgenommen und wo dokumentiert… | ok |
| gastro | BA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen o… | ok |
| gastro | BA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Vier-Augen-Freigabe von Zahlungen, Monatliche Abstimmung Saldo Bank und FiBu, Durchsi… | ok |
| gastro | BA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| gastro | BA94 | Änderungsmanagement | Wer gibt Änderungen frei=Jana Hellweg / Dokumentation der Änderungen=Änderungen an Vollmachten und Limits mit … | ok |
| gastro | BA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der Banking-Software Freigabe direkt im Bankportal. / Nacherfassung und Nachw… | ok |
| gastro | BA96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Bankportal / Form (Originaldatei, Export, Papier)=Elektronische Kontoau… | ok |
| gastro | LO00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Robert Funke (Geschäftsführung) / Vertretung=Ines Wolf (Büro)… | ok |
| gastro | LO01 | Abrechnung | Abrechnung durch=Kanzlei / Lohnprogramm (z. B. DATEV Lohn und Gehalt, LODAS)=DATEV Lohn und Gehalt / Abrechnun… | ok |
| gastro | LO02 | Abrechnungsunterlagen | Unterlagen=Lohnabrechnungen, Lohnjournal, Buchungsliste, Zahlungsliste / SEPA-Datei, Beitragsnachweise, Lohnst… | ok |
| gastro | LO03 | Personalstammdaten und Änderungen | Wer meldet=Ines Wolf / Wer gibt frei=Robert Funke / Meldeweg (z. B. Formular, Portal)=Personalfragebogen und Ä… | ok |
| gastro | LO04 | Bewegungsdaten | Weg der Übergabe=Stunden aus den Stundenzetteln, Zuschläge und Abwesenheiten als Monatsliste per DATEV Upload … | ok |
| gastro | LO05 | Lohnkonto und Lohnunterlagen | Ablageort=DATEV-Rechenzentrum über die Kanzlei, Auswertungen in DATEV Unternehmen online / Form (z. B. im Lohn… | ok |
| gastro | LO06 | Meldungen und Anmeldungen | Wer übermittelt=Kanzlei / Kontrolle der Übermittlung=Kanzlei stellt Übermittlungsprotokolle monatlich in DATEV… | ok |
| gastro | LO07 | Übergabe an die Buchhaltung | Schnittstelle=Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu) / Weg der Übergabe=Die Kanzlei … | ok |
| gastro | LO08 | Zugriff auf Lohndaten | Zugriffsberechtigte=Robert Funke, Ines Wolf, Kanzlei / Schutz (z. B. eigene Rolle, Passwort)=Eigene Rolle in D… | ok |
| gastro | LO09 | Auszahlung | Freigabe der Auszahlung=Ines Wolf bereitet vor, Robert Funke gibt im Onlinebanking frei / Vier-Augen-Prinzip=j… | ok |
| gastro | LO10 | Reisekosten und Sachbezüge | Erfassung und Nachweis=Reisekosten über Abrechnungsformular mit Belegen, Prüfung durch Robert Funke; Dienstwag… | ok |
| gastro | LO90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten einschließlich Auszubildender und Minijobs. / Ausgenommen … | ok |
| gastro | LO91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Lohn und Gehalt (Kanzlei); DATEV Unternehmen online; Onlinebanking. / Sc… | ok |
| gastro | LO92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Personalbestand mit der Abrechnung (Ein- und Austritte), Plausibilitätsprüfu… | ok |
| gastro | LO93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| gastro | LO94 | Änderungsmanagement | Wer gibt Änderungen frei=Robert Funke / Dokumentation der Änderungen=Änderungen an Lohnarten, Zuschlagsregeln … | ok |
| gastro | LO95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Fällt die Abrechnung aus, zahlt die Geschäftsführung Abschläge; Korrektur mit der nächste… | ok |
| gastro | LO96 | Ablage und Archiv | Ablageort=DATEV über die Kanzlei, Personalakten im verschlossenen Schrank / Form (Originaldatei, Export, Papie… | ok |
| gastro | ZE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Teamleitung (Ute Sommer) / Vertretung=Sandra Linde… | ok |
| gastro | ZE01 | System | Art=App / Software / System=Zeiterfassungs-App Takt (fiktiv) auf Diensthandys… | ok |
| gastro | ZE02 | Personenkreis | Gruppen (z. B. alle, Minijobs, Aushilfen)=Alle Beschäftigten einschließlich Minijobs und Aushilfen.… | ok |
| gastro | ZE03 | Erfassung | Wer erfasst=Beschäftigte selbst per App / Erfasste Angaben=Beginn, Ende, Pausen, Dauer / Bis wann (z. B. tägli… | ok |
| gastro | ZE04 | Abwesenheiten | Ablauf=Urlaub per Antrag in der App, Krankheit meldet die Teamleitung im System. / Wer gibt frei=Teamleitung… | ok |
| gastro | ZE05 | Korrekturen | Wer darf korrigieren=Nur Teamleitung / Korrekturen werden protokolliert=ja… | ok |
| gastro | ZE06 | Monatsabschluss | Wer prüft und schließt ab=Teamleitung / Termin (z. B. 3. Werktag)=bis zum 2. Werktag des Folgemonats… | ok |
| gastro | ZE07 | Überstunden und Zuschläge | Ermittlung=Die App berechnet Überstunden gegen die Sollzeit und Zuschläge für Nacht-, Sonn- und Feiertagsarbei… | ok |
| gastro | ZE08 | Übergabe an die Lohnabrechnung | Weg der Übergabe=Monatsexport der Stunden und Zuschläge aus der App, Upload in DATEV Unternehmen online für di… | ok |
| gastro | ZE09 | Aufbewahrung und Export | Ablage=App-Cloud und monatlicher PDF-Export in DATEV Unternehmen online / Export möglich und geprüft=ja… | ok |
| gastro | ZE90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten des Betriebs am Standort Musterdorf. / Ausgenommen und wo … | ok |
| gastro | ZE91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Zeiterfassungs-App Takt (fiktiv), Anbieter Takt GmbH (fiktiv), Cloud. DATEV Un… | ok |
| gastro | ZE92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Monatliche Plausibilitätsprüfung der Zeiten, Durchsicht des Korrekturprotokolls, Abgl… | ok |
| gastro | ZE93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| gastro | ZE94 | Änderungsmanagement | Wer gibt Änderungen frei=Sandra Linde / Dokumentation der Änderungen=Änderungen an Sollzeiten, Zuschlagsregeln… | ok |
| gastro | ZE95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der App Stundenzettel auf Papier, Übertrag durch die Teamleitung. / Nacherfas… | ok |
| gastro | UO01 | Gesellschaften und Standorte | Gesellschaften (Name, Rechtsform, Steuernummer optional)=Speicherblick Gastro GmbH (Muster, fiktiv), einzige G… | ok |
| gastro | UO02 | Tätigkeiten und Geschäftsvorfälle | Tätigkeiten und Umsatzarten=Restaurant mit Tagesgeschäft und Veranstaltungen. Steuerrelevante Vorgänge: Aufträ… | ok |
| gastro | UO03 | Zuständigkeiten | Aufgabe und zuständige Person oder Rolle=Geschäftsführung und Gesamtverantwortung: Paula Speicherblick. Intern… | ok |
| gastro | UO04 | Vertretungsregelung | Vertretungsregelung=Bei Abwesenheit von Paula Speicherblick übernimmt Keno Bruns die laufende Belegprüfung und… | ok |
| gastro | UO05 | Zeichnungs- und Freigabebefugnisse | Befugnis, Person oder Rolle, Betragsgrenze=Vertragsabschluss und Ausgangsrechnungen: Paula Speicherblick. Zahl… | ok |
| gastro | UO06 | Geltungsbereich und Abgrenzung | Geltungsbereich=Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort Bremen. / Nicht erfasst … | ok |
| gastro | LE01 | Auftragsänderungen und Nachträge | Ablauf und Form der Bestätigung=Auftragsänderungen nur schriftlich (E-Mail) und mit neuer Auftragsversion. Sto… | ok |
| gastro | LE02 | Lieferung und Leistungsnachweis | Nachweisarten=Leistung wird durch Lieferschein, Abnahmeprotokoll oder Leistungsnachweis (Stunden/Projekt) doku… | ok |
| gastro | LE03 | Abnahmen | Ablauf der Abnahme=Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestäti… | ok |
| gastro | LE05 | Vollständige Abrechnung | Abgleich Leistung – Rechnung=Nach Leistungserbringung bzw. Lieferung erstellt Keno Bruns die Rechnung. Laufend… | ok |
| gastro | LE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abstimmung offene Aufträge mit Rechnungen, Stichprobe Leistungsnachweis vor Rechnung … | ok |
| gastro | AR00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Keno Bruns / Vertretung=Paula Speicherblick… | ok |
| gastro | AR01 | Abschlags- und Schlussrechnungen | Ablauf und Verrechnung=Abschlags- und Schlussrechnungen bei Projekten; Schlussrechnung stellt den Gesamtbezug … | ok |
| gastro | AR02 | Gutschriften | Art=Korrektur / Rechnungsminderung / Bezeichnung auf dem Beleg=Gutschrift, mit eigener Nummer und Verweis auf … | ok |
| gastro | AR03 | Stornos und Berichtigungen | Ablauf mit Bezug zur Ursprungsrechnung=Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Beric… | ok |
| gastro | AR04 | Rechnungsdoppel und Archiv | Ablageort=Archiv der Rechnungssoftware bzw. DATEV / Format (PDF, XML, Papier)=PDF und strukturierte Rechnungsd… | ok |
| gastro | AR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Nummernkreis lückenlos, Abstimmung Ausgangsrechnungen mit FiBu / Turnus, wer, Nachwei… | ok |
| gastro | ER00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Keno Bruns / Vertretung=Paula Speicherblick… | ok |
| gastro | ER01 | Empfangskanäle | Zentrales Postfach oder Portal=E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen… | ok |
| gastro | ER02 | Anzeige und Prüfung | Viewer oder Software=Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch… | ok |
| gastro | ER03 | Erstellung und Versand | Format=XRechnung, ZUGFeRD / System für Erstellung und Versand=Ausgangs-E-Rechnungen erzeugt die Rechnungssoftw… | ok |
| gastro | ER04 | Speicherung der strukturierten Daten | Speicherort und Verknüpfung=Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID. Da… | ok |
| gastro | ER92 | Kontrollen im Modul | Durchgeführte Kontrollen=Validierung E-Rechnung, Vollständigkeit Eingangsjournal / Turnus, wer, Nachweis je Ko… | ok |
| gastro | PB00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Keno Bruns / Vertretung=Paula Speicherblick… | ok |
| gastro | PB01 | Scanvorgang | Gerät oder App=Büroscanner (fiktiv) / Ablauf und Zeitpunkt=Papierpost wird zentral geöffnet, mit Eingangsstemp… | ok |
| gastro | PB02 | Qualitätskontrolle | Wer prüft=Keno Bruns / Prüfkriterien=Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) v… | ok |
| gastro | PB03 | Übergabe ins Archiv | Übergabe und Indexierung=Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitges… | ok |
| gastro | PB04 | Aufbewahrung der Papieroriginale | Ablageort=Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat. / Dauer=bis zur … | ok |
| gastro | PB05 | Vernichtung der Originale | Vernichtung nach dem Scannen=ja / Zeitpunkt, Freigabe, Ausnahmen=Vernichtung nach Checkliste (Frist, keine Bet… | ok |
| gastro | PB92 | Kontrollen im Modul | Durchgeführte Kontrollen=Scan-Qualitätskontrolle, Eingangsstempel und Vollständigkeit / Turnus, wer, Nachweis … | ok |
| gastro | ZD01 | Zahlungsdienstleister und Kartenzahlung | Anbieter, Zahlungsarten, Auszahlungsrhythmus=Kartenterminal über Zahlungsdienstleister (fiktiv) und SEPA über … | ok |
| gastro | ZD02 | Gebühren und Auszahlungsabrechnungen | Abruf, Ablage, Buchung=Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten du… | ok |
| gastro | ZD03 | Rückzahlungen und Rückbelastungen | Ablauf und Beleg=Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt. … | ok |
| gastro | ZD04 | Abgleich offener Posten | Abgleich und Klärung=Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; n… | ok |
| gastro | BU00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Keno Bruns / Vertretung=Paula Speicherblick… | ok |
| gastro | BU01 | Belegzuordnung und Kontierung | Wer kontiert=Keno Bruns / Automatische Buchungsregeln oder Vorschläge=Interne Vorkontierung in DATEV Unternehm… | ok |
| gastro | BU02 | Buchungsrhythmus und Festschreibung | Buchungsrhythmus=zum Periodenabschluss / Festschreibung (wann, durch wen)=Festschreibung nach Abstimmung mit d… | ok |
| gastro | BU03 | Korrekturen | Ablauf=Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze… | ok |
| gastro | BU04 | Abstimmungen | Abstimmungen=Bank, Offene Posten Debitoren, Offene Posten Kreditoren, Umsatzsteuer / Turnus und wer=Monatlich:… | ok |
| gastro | BU06 | Abschlussarbeiten | Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)=Jahresabschluss erstellt di… | ok |
| gastro | BU07 | Übergabe an die Kanzlei | Inhalt, Termin, Weg=Kanzlei: Kanzlei Weserbogen GmbH (fiktiv). Laufende FiBu, USt-Voranmeldung, Jahresabschlus… | teilweise (Mandatsumfang statt Übergabe/Termin/Weg/Nachweis) |
| gastro | BU92 | Kontrollen im Modul | Durchgeführte Kontrollen=Monatsabschluss-Abstimmung, Belegvollständigkeit / Turnus, wer, Nachweis je Kontrolle… | ok |
| gastro | BS00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Paula Speicherblick / Vertretung=Keno Bruns… | ok |
| gastro | BS01 | Branchenspezifische Vorgänge | Branche=Gastronomie / Hotel / Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträg… | ok |
| gastro | BS02 | Branchensoftware | System oder Gerät, Zweck, Anbieter=Elektronisches Kassensystem mit Cloud-TSE (fiktiv); ggf. Küchen-/Bestellmon… | ok |
| gastro | BS03 | Erfassung der Grunddaten | Erfassung, wer, wann=Artikel und Preise pflegt die Geschäftsführung; Bedienerkennungen vergibt die Schichtleit… | ok |
| gastro | BS04 | Nachweise | Nachweis und Ablageort=Z-Bons und Zählprotokolle, TSE-Signaturen, Wareneingangsscheine, Inventurlisten, Schich… | ok |
| gastro | BS06 | Besondere steuerliche Regeln | Regel und wie sie im Ablauf umgesetzt wird=Summen Z-Bons und Kartenzahlungen gegen Bank und FiBu-Erlöse durch … | **falsch** (Abstimmung statt steuerlicher Regel) |
| gastro | BS07 | Übergabe an die Buchhaltung | Weg (Schnittstelle, Export, manuell)=Monatlicher DATEV-Export aus dem Kassensystem sowie Wareneinsatzlisten; U… | ok |
| gastro | BS92 | Kontrollen im Modul | Durchgeführte Kontrollen=Kassensturz, Abgleich Z-Bon/Bank, Wareneinsatz / Turnus, wer, Nachweis je Kontrolle=T… | ok |
| gastro | AW01 | Archivsystem | Elektronisches Archiv=DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und … | ok |
| gastro | AW02 | Suchmerkmale | Suchmerkmale=Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATE… | ok |
| gastro | AW03 | Verknüpfung Beleg und Buchung | Verknüpfung=Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: Keno Bruns.… | ok |
| gastro | AW04 | Lesbarkeit über die Frist | Maßnahmen=PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch Keno Bruns. Form… | ok |
| gastro | AW05 | Schutz vor unbemerkten Änderungen | Maßnahmen=Schreibschutz / Unveränderbarkeit im Archiv, Versionierung mit Protokoll / Details=Keine Überschreib… | ok |
| gastro | AW92 | Kontrollen im Modul | Durchgeführte Kontrollen=Stichprobe Wiederauffindbarkeit, Lesbarkeitsprüfung / Turnus, wer, Nachweis je Kontro… | ok |
| gastro | AF01 | Fristzuordnung | Verfahren der Zuordnung=Jeder Unterlagenart wird ihre Frist nach § 147 Abs. 1, 3 AO zugeordnet: Bücher, Aufzei… | ok |
| gastro | AF02 | Weitere Aufbewahrungsgründe | Prüfung vor Löschung=Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wi… | ok |
| gastro | AF03 | Löschfreigabe | Freigabe durch=Löschung erst nach Fristende und schriftlicher Freigabe durch Paula Speicherblick, Abstimmung m… | ok |
| gastro | AF04 | Durchführung und Protokoll | Durchführung=Technische Löschung durch Kassenhändler und Küchen-IT (fiktiv) bzw. Anbieter nach Freigabe; Bestä… | ok |
| gastro | AF05 | Datenschutz und Aufbewahrung | Vorgehen (z. B. Sperrung statt Löschung)=Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach … | ok |
| gastro | SY01 | Hardware und Betriebsumgebung | Umgebung=Rechnungssoftware, DATEV Unternehmen online, E-Mail, NAS, ggf. Kasse/Shop/WaWi laut Betriebs-Check. I… | ok |
| gastro | SY02 | Schnittstellen | Schnittstellen=Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über … | ok |
| gastro | SY03 | Importe, Exporte und Konvertierungen | Vorgänge und Prüfung=Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, … | ok |
| gastro | SY04 | Eigene Berechnungen und Automatisierungen | Vorhanden=ja / Beschreibung (Zweck, Ersteller, Änderung)=Wiederkehrende Exporte und Erinnerungen; keine unprot… | ok |
| gastro | SY92 | Kontrollen im Modul | Durchgeführte Kontrollen=Schnittstellenprotokoll, Systemliste aktuell / Turnus, wer, Nachweis je Kontrolle=Nac… | ok |
| gastro | ZR01 | Rollen und Berechtigungen | Rolle und Rechte je System=Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränk… | ok |
| gastro | ZR02 | Vergabe von Rechten | Antrag durch=Paula Speicherblick beantragt neue Zugänge / Genehmigung durch=Kassenhändler und Küchen-IT (fikti… | teilweise („Genehmigung durch“: IT „richtet ein“) |
| gastro | ZR03 | Entzug von Rechten | Ablauf=Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.… | ok |
| gastro | ZR04 | Schutzmaßnahmen | Maßnahmen=Persönliche Zugänge (keine Sammelkonten), Zwei-Faktor-Anmeldung, Passwortregeln, Bildschirmsperre… | ok |
| gastro | ZR05 | Protokollierung | Protokollierung vorhanden=ja / Auswertung durch=Anbieterprotokolle zu Logins und kritischen Änderungen werden … | **falsch** (Feld „Auswertung durch“ ohne Person) |
| gastro | ZR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Jährliche Rechteprüfung, Offboarding-Checkliste / Turnus, wer, Nachweis je Kontrolle=… | ok |
| gastro | SN01 | Sicherungskonzept | Daten, Turnus, Ziel, Aufbewahrung=Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen … | ok |
| gastro | SN03 | Ersatzverfahren | Ersatzverfahren=Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf… | ok |
| gastro | SN04 | Nachbearbeitung | Nacherfassung und Nachweis=Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.… | ok |
| gastro | SN05 | Notfallkontakte | Rolle oder Stelle (keine privaten Telefonnummern)=Kontakt: Paula Speicherblick und Kassenhändler und Küchen-IT… | ok |
| gastro | SN92 | Kontrollen im Modul | Durchgeführte Kontrollen=Backup-Erfolgskontrolle, Jährlicher Restore-Test / Turnus, wer, Nachweis je Kontrolle… | ok |
| gastro | KF01 | Vollständigkeitskontrollen | Kontrollen=Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen. Ke… | ok |
| gastro | KF02 | Richtigkeitskontrollen | Kontrollen=Erkennung über Abstimmungen und Systemhinweise.… | teilweise (keine Richtigkeitskontrolle benannt) |
| gastro | KF03 | Abweichungen und Fehler | Ablauf=Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrekt… | ok |
| gastro | KF04 | Kontrollnachweise | Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)=Abstimmungsprotokolle, Checklisten zum Monatsabschlu… | ok |
| gastro | KF05 | Überwachung des Kontrollsystems | Überwachung durch=Paula Speicherblick / Turnus=Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessän… | ok |
| gastro | AU01 | Buchhaltungsservice und weitere Dienstleister | Dienstleister und Aufgaben=FiBu und Abschluss: Kanzlei Weserbogen GmbH (fiktiv). IT/Cloud: Anbieter und Kassen… | ok |
| gastro | AU02 | IT- und Cloud-Dienstleister | Anbieter, Leistung, Speicherort=IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich z… | ok |
| gastro | AU03 | Übergaben | Übergaben und Nachweis=Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Ü… | ok |
| gastro | AU04 | Kontrolle der Dienstleister | Kontrolle=Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. Keno Bruns… | ok |
| gastro | AU05 | Verantwortungsgrenzen | Abgrenzung=Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Vera… | ok |
| gastro | PZ00 | Ansprechpartner | Ansprechpartner (Name oder Rolle)=Paula Speicherblick / Vertretung=Keno Bruns… | ok |
| gastro | PZ01 | Unmittelbarer Zugriff (Z1) | Nur-Lese-Zugang möglich=ja / Systeme=Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch Kassenhä… | ok |
| gastro | PZ02 | Mittelbarer Zugriff (Z2) | Wer erstellt Auswertungen=Keno Bruns erstellt Auswertungen nach Vorgabe der Prüfer.… | ok |
| gastro | PZ04 | Bereitstellung von Belegen | Ablauf=Ankündigung, Benennung der Ansprechperson (Paula Speicherblick), Bereitstellung von Leserecht oder Expo… | ok |
| gastro | PZ06 | Altdaten | Regelung (z. B. Lesezugang, Export, Archivsystem)=Frühere Fassungen der Verfahrensdokumentation und ältere Exp… | ok |
| gastro | AE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Paula Speicherblick / Vertretung=Kassenhändler und Küchen-IT (fiktiv)… | ok |
| gastro | AE01 | Einführung neuer Systeme | Ablauf=Neue Systeme nur nach Freigabe Paula Speicherblick, mit Eintrag in der Systemliste und Anpassung dieser… | ok |
| gastro | AE02 | Updates und Versionswechsel | Ablauf=Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet un… | ok |
| gastro | AE03 | Migration und Datenübernahme | Übernahme und Prüfung=Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende… | ok |
| gastro | AE05 | Ablaufänderungen | Meldung und Übernahme=Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen … | ok |
| gastro | AE06 | Historische Nachvollziehbarkeit | Änderungsverzeichnis, Versionen, Gültigkeitszeiträume=Frühere Fassungen bleiben versioniert im Kundenkonto dow… | ok |
| gastro | AE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Änderungsverzeichnis gepflegt, Systemliste nach Änderung aktualisiert / Turnus, wer, … | ok |
| gastro | PF01 | Prüfturnus | Turnus=jährlich / Prüfung durch=Paula Speicherblick mit Keno Bruns. Jährliche Durchsicht aller aktiven Module … | ok |
| gastro | PF03 | Freigabe durch die Geschäftsleitung | Ablauf (z. B. Unterschrift, Freigabevermerk)=Inhaltliche Freigabe der geänderten Kapitel durch Paula Speicherb… | ok |
| handwerk | VK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Nora Klar (Geschäftsführung) / Vertretung=Felix Hahn (Büro)… | ok |
| handwerk | VK01 | Ablauf und System | Ablauf=Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst… | ok |
| handwerk | VK02 | Angebote und Aufträge | System=Faktura+ (fiktiv) / Ablage=Am Projekt in Faktura+… | ok |
| handwerk | VK03 | Preise und Konditionen | Wer legt fest=Nora Klar / Wer gibt Sonderkonditionen frei=Nora Klar bei Rabatten über 10 Prozent… | ok |
| handwerk | VK04 | Kundenstammdaten | Wer pflegt=Felix Hahn / Änderungen werden protokolliert=ja… | ok |
| handwerk | VK05 | Rechnungsnummern | Vergabe=Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer / Nummernkreise=Ein Nummernkrei… | ok |
| handwerk | VK06 | Pflichtangaben | Vorlage und Prüfung=Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem P… | ok |
| handwerk | VK07 | Rechnungsversand | Format=PDF per E-Mail, XRechnung / E-Rechnungen können versendet werden=ja… | ok |
| handwerk | VK08 | Korrektur und Storno | Ablauf=Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kei… | ok |
| handwerk | VK09 | Offene Posten und Mahnwesen | Wer=Felix Hahn / Turnus=wöchentlich; Mahnung nach 14 Tagen Verzug… | ok |
| handwerk | VK10 | Übergabe an die Buchhaltung | Weg der Übergabe=Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen onli… | ok |
| handwerk | VK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Leistungen der Agentur an Geschäftskunden. / Ausgenommen und wo dokument… | ok |
| handwerk | VK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen on… | ok |
| handwerk | VK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Lückenprüfung der Rechnungsnummern, Abgleich erbrachter Leistungen mit gestellten Rec… | ok |
| handwerk | VK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handwerk | VK94 | Änderungsmanagement | Wer gibt Änderungen frei=Nora Klar / Dokumentation der Änderungen=Änderungen an Rechnungsvorlage, Nummernkreis… | ok |
| handwerk | EK00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Einkaufsleitung (Murat Aydin) / Vertretung=Eva Lindner… | ok |
| handwerk | EK01 | Bedarfsmeldung | Ablauf=Bedarf entsteht aus Mindestbeständen im ERP und aus Fertigungsaufträgen; Abteilungen melden Sonderbedar… | ok |
| handwerk | EK02 | Bestellberechtigung | Wer bestellt=Einkauf / Freigabegrenzen=bis 5.000 Euro Einkauf allein; darüber Freigabe / Wer gibt frei=Eva Lin… | ok |
| handwerk | EK03 | Bestellweg | Bestellwege=ERP / Warenwirtschaft, Lieferantenportal, E-Mail / System=ERP Fertigplan (fiktiv)… | ok |
| handwerk | EK04 | Auftragsbestätigung | Wer prüft=Einkauf / Umgang mit Abweichungen=Abweichungen bei Preis oder Termin werden im ERP vermerkt und mit … | ok |
| handwerk | EK05 | Wareneingang und Leistungsnachweis | Ablauf=Wareneingang im ERP gegen die Bestellung; Dienstleistungen bestätigt die anfordernde Abteilung im ERP. … | ok |
| handwerk | EK06 | Abgleich Bestellung, Lieferung, Rechnung | Ablauf=Rechnung wird im ERP der Bestellung und dem Wareneingang zugeordnet; Abweichungen über 2 Prozent gehen … | ok |
| handwerk | EK07 | Lieferantenstammdaten | Wer pflegt=Einkauf legt an, Buchhaltung bestätigt Bankdaten / Bankdatenänderung im Vier-Augen-Prinzip=ja… | ok |
| handwerk | EK08 | Rahmenverträge und Abonnements | Verträge und Überwachung=Rahmenverträge für Rohmaterial und Wartungsverträge, Liste im ERP mit Laufzeit und Kü… | ok |
| handwerk | EK10 | Ablage der Einkaufsunterlagen | Ablageort=ERP Fertigplan (fiktiv), Dokumente am Bestellvorgang / Ordnung (z. B. Bestellnummer)=Bestellnummer… | ok |
| handwerk | EK90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Einkauf von Material, Handelsware und Dienstleistungen am Standort Musterbach… | ok |
| handwerk | EK91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=ERP Fertigplan (fiktiv): Einkauf und Lager, Cloud. Lieferantenportale zweier G… | ok |
| handwerk | EK92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Freigabe nach Wertgrenzen, Drei-Wege-Abgleich Bestellung, Lieferung, Rechnung, Vier-A… | ok |
| handwerk | EK93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handwerk | EK94 | Änderungsmanagement | Wer gibt Änderungen frei=Eva Lindner / Dokumentation der Änderungen=Änderungen an Freigabegrenzen und Rollen a… | ok |
| handwerk | EK95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei ERP-Ausfall Bestellungen per E-Mail mit Bestellnummernliste, Nacherfassung im ERP. / … | ok |
| handwerk | EK96 | Ablage und Archiv | Ablageort=ERP Fertigplan (fiktiv) mit jährlichem Export auf das Firmenlaufwerk / Form (Originaldatei, Export, … | ok |
| handwerk | BA00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Jana Hellweg (Partnerin) / Vertretung=Lukas Berger (Partner)… | ok |
| handwerk | BA01 | Konten | Konten (Bank, Zweck)=Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).… | ok |
| handwerk | BA02 | Vollmachten und Zugänge | Vollmachten (Einzel- oder Gemeinschaftsvollmacht)=Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam.… | ok |
| handwerk | BA03 | Kontoauszüge | Format=Elektronisch (Datensatz/Schnittstelle) / Ablage=DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Ko… | ok |
| handwerk | BA04 | Zahlungsvorbereitung | Ablauf=Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software. / Wer… | ok |
| handwerk | BA05 | Zahlungsfreigabe | Wer gibt frei=Ein Partner, über 10.000 Euro beide Partner / Vier-Augen-Prinzip=ja / Limits=Einzelfreigabe bis … | ok |
| handwerk | BA06 | Lastschriften und Daueraufträge | Überwachung=Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht. / Wer überwac… | ok |
| handwerk | BA07 | Bankabstimmung | Wer=Paul Richter / Turnus=monatlich… | ok |
| handwerk | BA08 | Übergabe an die Buchhaltung | Weg=Automatischer Abruf in die FiBu / Beschreibung=Kontoumsätze werden täglich über DATEV Bankdaten abgerufen.… | ok |
| handwerk | BA10 | Ungeklärte Posten | Ablauf=Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage. / Wer klärt=Pa… | ok |
| handwerk | BA90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Beide Bankkonten und die Firmenkreditkarte. / Ausgenommen und wo dokumentiert… | ok |
| handwerk | BA91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen o… | ok |
| handwerk | BA92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Vier-Augen-Freigabe von Zahlungen, Monatliche Abstimmung Saldo Bank und FiBu, Durchsi… | ok |
| handwerk | BA93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handwerk | BA94 | Änderungsmanagement | Wer gibt Änderungen frei=Jana Hellweg / Dokumentation der Änderungen=Änderungen an Vollmachten und Limits mit … | ok |
| handwerk | BA95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der Banking-Software Freigabe direkt im Bankportal. / Nacherfassung und Nachw… | ok |
| handwerk | BA96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Bankportal / Form (Originaldatei, Export, Papier)=Elektronische Kontoau… | ok |
| handwerk | AN00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Birgit Kranz (Buchhaltung) / Vertretung=Hannes Papke… | ok |
| handwerk | AN01 | Anlagenverzeichnis | System=DATEV Anlagenbuchführung über die Kanzlei / Wer führt es=Kanzlei nach Meldung durch Birgit Kranz… | ok |
| handwerk | AN02 | Zugang und Aktivierung | Wer entscheidet=Birgit Kranz nach Rücksprache mit der Kanzlei / Ablauf=Rechnungen über 250 Euro netto werden a… | ok |
| handwerk | AN03 | Anschaffungskosten | Ermittlung=Anschaffungspreis zuzüglich Fracht und Montage, abzüglich Skonti und Zuschüsse; Nachweise am Anlage… | ok |
| handwerk | AN04 | Kennzeichnung und Standort | Kennzeichnung=Inventarnummer mit Etikett / Standortvermerk=Halle und Raum im Anlagenverzeichnis… | ok |
| handwerk | AN05 | Abschreibung | Methode (z. B. linear)=linear / Wer legt Nutzungsdauern fest=Kanzlei nach amtlicher AfA-Tabelle, Abweichungen … | ok |
| handwerk | AN07 | Abgang | Ablauf=Verkauf oder Verschrottung mit Abgangsformular, Verkaufsrechnung bzw. Entsorgungsnachweis. / Freigabe=H… | ok |
| handwerk | AN08 | Bestandsaufnahme | Bestandsaufnahme=Ja, jährlich / Wer=Birgit Kranz mit Produktionsleitung… | ok |
| handwerk | AN09 | Leasing und Miete | Verträge und Ablage=Leasing für eine Digitaldruckmaschine und zwei Fahrzeuge; Verträge im Ordner Verträge, Lis… | ok |
| handwerk | AN90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Gesamtes Sachanlagevermögen am Standort Mustertal. / Ausgenommen und wo dokum… | ok |
| handwerk | AN91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Anlagenbuchführung (Kanzlei); DATEV Unternehmen online. / Schnittstellen… | ok |
| handwerk | AN92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Anlagenverzeichnis mit den Anlagenkonten, Durchsicht der Aufwandskonten auf … | ok |
| handwerk | AN93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| handwerk | AN94 | Änderungsmanagement | Wer gibt Änderungen frei=Hannes Papke / Dokumentation der Änderungen=Änderungen an Nutzungsdauern oder Methode… | ok |
| handwerk | AN96 | Ablage und Archiv | Ablageort=DATEV Unternehmen online und Ordner Anlagen auf dem NAS / Form (Originaldatei, Export, Papier)=Elekt… | ok |
| handwerk | LO00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | LO01 | Abrechnung | Abrechnung durch=Kanzlei / Lohnprogramm (z. B. DATEV Lohn und Gehalt, LODAS)=DATEV Lohn und Gehalt / Abrechnun… | ok |
| handwerk | LO02 | Abrechnungsunterlagen | Unterlagen=Lohnabrechnungen, Lohnjournal, Buchungsliste, Zahlungsliste / SEPA-Datei, Beitragsnachweise, Lohnst… | ok |
| handwerk | LO03 | Personalstammdaten und Änderungen | Wer meldet=Ines Wolf / Wer gibt frei=Robert Funke / Meldeweg (z. B. Formular, Portal)=Personalfragebogen und Ä… | ok |
| handwerk | LO04 | Bewegungsdaten | Weg der Übergabe=Stunden aus den Stundenzetteln, Zuschläge und Abwesenheiten als Monatsliste per DATEV Upload … | ok |
| handwerk | LO05 | Lohnkonto und Lohnunterlagen | Ablageort=DATEV-Rechenzentrum über die Kanzlei, Auswertungen in DATEV Unternehmen online / Form (z. B. im Lohn… | ok |
| handwerk | LO06 | Meldungen und Anmeldungen | Wer übermittelt=Kanzlei / Kontrolle der Übermittlung=Kanzlei stellt Übermittlungsprotokolle monatlich in DATEV… | ok |
| handwerk | LO07 | Übergabe an die Buchhaltung | Schnittstelle=Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu) / Weg der Übergabe=Die Kanzlei … | ok |
| handwerk | LO08 | Zugriff auf Lohndaten | Zugriffsberechtigte=Robert Funke, Ines Wolf, Kanzlei / Schutz (z. B. eigene Rolle, Passwort)=Eigene Rolle in D… | ok |
| handwerk | LO09 | Auszahlung | Freigabe der Auszahlung=Ines Wolf bereitet vor, Robert Funke gibt im Onlinebanking frei / Vier-Augen-Prinzip=j… | ok |
| handwerk | LO10 | Reisekosten und Sachbezüge | Erfassung und Nachweis=Reisekosten über Abrechnungsformular mit Belegen, Prüfung durch Robert Funke; Dienstwag… | ok |
| handwerk | LO90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten einschließlich Auszubildender und Minijobs. / Ausgenommen … | ok |
| handwerk | LO91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=DATEV Lohn und Gehalt (Kanzlei); DATEV Unternehmen online; Onlinebanking. / Sc… | ok |
| handwerk | LO92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Abgleich Personalbestand mit der Abrechnung (Ein- und Austritte), Plausibilitätsprüfu… | ok |
| handwerk | LO93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z2 Auswertung nach Vorgabe, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV, D… | ok |
| handwerk | LO94 | Änderungsmanagement | Wer gibt Änderungen frei=Robert Funke / Dokumentation der Änderungen=Änderungen an Lohnarten, Zuschlagsregeln … | ok |
| handwerk | LO95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Fällt die Abrechnung aus, zahlt die Geschäftsführung Abschläge; Korrektur mit der nächste… | ok |
| handwerk | LO96 | Ablage und Archiv | Ablageort=DATEV über die Kanzlei, Personalakten im verschlossenen Schrank / Form (Originaldatei, Export, Papie… | ok |
| handwerk | ZE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | ZE01 | System | Art=App / Software / System=Zeiterfassungs-App Takt (fiktiv) auf Diensthandys… | ok |
| handwerk | ZE02 | Personenkreis | Gruppen (z. B. alle, Minijobs, Aushilfen)=Alle Beschäftigten einschließlich Minijobs und Aushilfen.… | ok |
| handwerk | ZE03 | Erfassung | Wer erfasst=Beschäftigte selbst per App / Erfasste Angaben=Beginn, Ende, Pausen, Dauer / Bis wann (z. B. tägli… | ok |
| handwerk | ZE04 | Abwesenheiten | Ablauf=Urlaub per Antrag in der App, Krankheit meldet die Teamleitung im System. / Wer gibt frei=Teamleitung… | ok |
| handwerk | ZE05 | Korrekturen | Wer darf korrigieren=Nur Teamleitung / Korrekturen werden protokolliert=ja… | ok |
| handwerk | ZE06 | Monatsabschluss | Wer prüft und schließt ab=Teamleitung / Termin (z. B. 3. Werktag)=bis zum 2. Werktag des Folgemonats… | ok |
| handwerk | ZE07 | Überstunden und Zuschläge | Ermittlung=Die App berechnet Überstunden gegen die Sollzeit und Zuschläge für Nacht-, Sonn- und Feiertagsarbei… | ok |
| handwerk | ZE08 | Übergabe an die Lohnabrechnung | Weg der Übergabe=Monatsexport der Stunden und Zuschläge aus der App, Upload in DATEV Unternehmen online für di… | ok |
| handwerk | ZE09 | Aufbewahrung und Export | Ablage=App-Cloud und monatlicher PDF-Export in DATEV Unternehmen online / Export möglich und geprüft=ja… | ok |
| handwerk | ZE90 | Umfang und Abgrenzung | Umfang (Standorte, Teilprozesse)=Alle Beschäftigten des Betriebs am Standort Musterdorf. / Ausgenommen und wo … | ok |
| handwerk | ZE91 | Systeme und Schnittstellen | Systeme (Name, Zweck, Anbieter)=Zeiterfassungs-App Takt (fiktiv), Anbieter Takt GmbH (fiktiv), Cloud. DATEV Un… | ok |
| handwerk | ZE92 | Kontrollen im Bereich | Durchgeführte Kontrollen=Monatliche Plausibilitätsprüfung der Zeiten, Durchsicht des Korrekturprotokolls, Abgl… | ok |
| handwerk | ZE93 | Datenzugriff der Finanzverwaltung | Mögliche Zugriffsarten=Z1 Nur-Lesezugriff im System, Z3 Datenexport auf Datenträger / Exportformat (z. B. CSV,… | ok |
| handwerk | ZE94 | Änderungsmanagement | Wer gibt Änderungen frei=Sandra Linde / Dokumentation der Änderungen=Änderungen an Sollzeiten, Zuschlagsregeln… | ok |
| handwerk | ZE95 | Ausfall und Notbetrieb | Vorgehen bei Ausfall=Bei Ausfall der App Stundenzettel auf Papier, Übertrag durch die Teamleitung. / Nacherfas… | ok |
| handwerk | UO01 | Gesellschaften und Standorte | Gesellschaften (Name, Rechtsform, Steuernummer optional)=Bauwerk Nord GmbH (Muster, fiktiv), einzige Gesellsch… | ok |
| handwerk | UO02 | Tätigkeiten und Geschäftsvorfälle | Tätigkeiten und Umsatzarten=Ausbau und Sanierung (Handwerk / Bau). Steuerrelevante Vorgänge: Aufträge bzw. Ver… | ok |
| handwerk | UO03 | Zuständigkeiten | Aufgabe und zuständige Person oder Rolle=Geschäftsführung und Gesamtverantwortung: Henrik Bauwerk. Interne Buc… | ok |
| handwerk | UO04 | Vertretungsregelung | Vertretungsregelung=Bei Abwesenheit von Henrik Bauwerk übernimmt Silke Moor die laufende Belegprüfung und Zahl… | ok |
| handwerk | UO05 | Zeichnungs- und Freigabebefugnisse | Befugnis, Person oder Rolle, Betragsgrenze=Vertragsabschluss und Ausgangsrechnungen: Henrik Bauwerk. Zahlungsf… | ok |
| handwerk | UO06 | Geltungsbereich und Abgrenzung | Geltungsbereich=Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort Oldenburg. / Nicht erfas… | ok |
| handwerk | LE01 | Auftragsänderungen und Nachträge | Ablauf und Form der Bestätigung=Henrik Bauwerk oder die Projektleitung hält Änderungen (Scope, Zeit, Honorar) … | ok |
| handwerk | LE02 | Lieferung und Leistungsnachweis | Nachweisarten=Leistungsnachweis je Monat bzw. Meilenstein (Stundenübersicht oder Deliverable-Liste), Freigabe … | ok |
| handwerk | LE03 | Abnahmen | Ablauf der Abnahme=Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestäti… | ok |
| handwerk | LE05 | Vollständige Abrechnung | Abgleich Leistung – Rechnung=Nach Leistungsnachweis erstellt die Buchhaltung die Rechnung in der Rechnungssoft… | ok |
| handwerk | LE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abstimmung offene Aufträge mit Rechnungen, Stichprobe Leistungsnachweis vor Rechnung … | ok |
| handwerk | AR00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | AR01 | Abschlags- und Schlussrechnungen | Ablauf und Verrechnung=Abschlagsrechnungen nach Baufortschritt bzw. Aufmaß; Schlussrechnung mit Auflistung all… | ok |
| handwerk | AR02 | Gutschriften | Art=Korrektur / Rechnungsminderung / Bezeichnung auf dem Beleg=Gutschrift, mit eigener Nummer und Verweis auf … | ok |
| handwerk | AR03 | Stornos und Berichtigungen | Ablauf mit Bezug zur Ursprungsrechnung=Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Beric… | ok |
| handwerk | AR04 | Rechnungsdoppel und Archiv | Ablageort=Archiv der Rechnungssoftware bzw. DATEV / Format (PDF, XML, Papier)=PDF und strukturierte Rechnungsd… | ok |
| handwerk | AR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Nummernkreis lückenlos, Abstimmung Ausgangsrechnungen mit FiBu / Turnus, wer, Nachwei… | ok |
| handwerk | ER00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | ER01 | Empfangskanäle | Zentrales Postfach oder Portal=E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen… | ok |
| handwerk | ER02 | Anzeige und Prüfung | Viewer oder Software=Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch… | ok |
| handwerk | ER03 | Erstellung und Versand | Format=XRechnung, ZUGFeRD / System für Erstellung und Versand=Ausgangs-E-Rechnungen erzeugt die Rechnungssoftw… | ok |
| handwerk | ER04 | Speicherung der strukturierten Daten | Speicherort und Verknüpfung=Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID. Da… | ok |
| handwerk | ER92 | Kontrollen im Modul | Durchgeführte Kontrollen=Validierung E-Rechnung, Vollständigkeit Eingangsjournal / Turnus, wer, Nachweis je Ko… | ok |
| handwerk | PB00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | PB01 | Scanvorgang | Gerät oder App=Büroscanner (fiktiv) / Ablauf und Zeitpunkt=Papierpost wird zentral geöffnet, mit Eingangsstemp… | ok |
| handwerk | PB02 | Qualitätskontrolle | Wer prüft=Silke Moor / Prüfkriterien=Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) v… | ok |
| handwerk | PB03 | Übergabe ins Archiv | Übergabe und Indexierung=Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitges… | ok |
| handwerk | PB04 | Aufbewahrung der Papieroriginale | Ablageort=Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat. / Dauer=bis zur … | ok |
| handwerk | PB05 | Vernichtung der Originale | Vernichtung nach dem Scannen=ja / Zeitpunkt, Freigabe, Ausnahmen=Vernichtung nach Checkliste (Frist, keine Bet… | ok |
| handwerk | PB92 | Kontrollen im Modul | Durchgeführte Kontrollen=Scan-Qualitätskontrolle, Eingangsstempel und Vollständigkeit / Turnus, wer, Nachweis … | ok |
| handwerk | ZD01 | Zahlungsdienstleister und Kartenzahlung | Anbieter, Zahlungsarten, Auszahlungsrhythmus=Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Last… | ok |
| handwerk | ZD02 | Gebühren und Auszahlungsabrechnungen | Abruf, Ablage, Buchung=Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten du… | ok |
| handwerk | ZD03 | Rückzahlungen und Rückbelastungen | Ablauf und Beleg=Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt. … | ok |
| handwerk | ZD04 | Abgleich offener Posten | Abgleich und Klärung=Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; n… | ok |
| handwerk | BU00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Silke Moor / Vertretung=Henrik Bauwerk… | ok |
| handwerk | BU01 | Belegzuordnung und Kontierung | Wer kontiert=Silke Moor / Automatische Buchungsregeln oder Vorschläge=Interne Vorkontierung in DATEV Unternehm… | ok |
| handwerk | BU02 | Buchungsrhythmus und Festschreibung | Buchungsrhythmus=zum Periodenabschluss / Festschreibung (wann, durch wen)=Festschreibung nach Abstimmung mit d… | ok |
| handwerk | BU03 | Korrekturen | Ablauf=Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze… | ok |
| handwerk | BU04 | Abstimmungen | Abstimmungen=Bank, Offene Posten Debitoren, Offene Posten Kreditoren, Umsatzsteuer / Turnus und wer=Monatlich:… | ok |
| handwerk | BU06 | Abschlussarbeiten | Abschlussarbeiten (z. B. Abgrenzungen, Inventurübernahme, Anlagen, Rückstellungen)=Jahresabschluss erstellt Ka… | ok |
| handwerk | BU07 | Übergabe an die Kanzlei | Inhalt, Termin, Weg=Kanzlei: Kanzlei Dammstieg GmbH (fiktiv). Laufende FiBu, USt-Voranmeldung, Jahresabschluss… | teilweise (Mandatsumfang statt Übergabe/Termin/Weg/Nachweis) |
| handwerk | BU92 | Kontrollen im Modul | Durchgeführte Kontrollen=Monatsabschluss-Abstimmung, Belegvollständigkeit / Turnus, wer, Nachweis je Kontrolle… | ok |
| handwerk | BS00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Henrik Bauwerk / Vertretung=Silke Moor… | ok |
| handwerk | BS01 | Branchenspezifische Vorgänge | Branche=Handwerk / Bau / Vorgänge (z. B. Projekte, Mietverträge, Behandlungen, Fahrten, Fertigungsaufträge)=Ba… | ok |
| handwerk | BS02 | Branchensoftware | System oder Gerät, Zweck, Anbieter=Projekt- und Aufmaßsoftware (fiktiv); Rechnungssoftware mit Abschlags-/Schl… | ok |
| handwerk | BS03 | Erfassung der Grunddaten | Erfassung, wer, wann=Projektstammdaten und Nachträge erfasst die Projektleitung; Materialbedarf aus Stückliste… | ok |
| handwerk | BS04 | Nachweise | Nachweis und Ablageort=Aufmaß, Bautagebuch bzw. Stundenzettel, Lieferscheine Material, Nachunternehmerrechnung… | ok |
| handwerk | BS06 | Besondere steuerliche Regeln | Regel und wie sie im Ablauf umgesetzt wird=Projektumsätze und Materialaufwand gegen FiBu durch Silke Moor; off… | **falsch** (Abstimmung statt steuerlicher Regel) |
| handwerk | BS07 | Übergabe an die Buchhaltung | Weg (Schnittstelle, Export, manuell)=Periodischer DATEV-Export der Ausgangsrechnungen und Eingangsbelege; Proj… | ok |
| handwerk | BS92 | Kontrollen im Modul | Durchgeführte Kontrollen=Abschläge gegen Aufmaß, Material gegen Lieferschein, Stunden gegen Lohn / Turnus, wer… | ok |
| handwerk | AW01 | Archivsystem | Elektronisches Archiv=DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und … | ok |
| handwerk | AW02 | Suchmerkmale | Suchmerkmale=Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATE… | ok |
| handwerk | AW03 | Verknüpfung Beleg und Buchung | Verknüpfung=Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: Silke Moor.… | ok |
| handwerk | AW04 | Lesbarkeit über die Frist | Maßnahmen=PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch Silke Moor. Form… | ok |
| handwerk | AW05 | Schutz vor unbemerkten Änderungen | Maßnahmen=Schreibschutz / Unveränderbarkeit im Archiv, Versionierung mit Protokoll / Details=Keine Überschreib… | ok |
| handwerk | AW92 | Kontrollen im Modul | Durchgeführte Kontrollen=Stichprobe Wiederauffindbarkeit, Lesbarkeitsprüfung / Turnus, wer, Nachweis je Kontro… | ok |
| handwerk | AF01 | Fristzuordnung | Verfahren der Zuordnung=Jeder Unterlagenart wird ihre Frist nach § 147 Abs. 1, 3 AO zugeordnet: Bücher, Aufzei… | ok |
| handwerk | AF02 | Weitere Aufbewahrungsgründe | Prüfung vor Löschung=Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wi… | ok |
| handwerk | AF03 | Löschfreigabe | Freigabe durch=Löschung erst nach Fristende und schriftlicher Freigabe durch Henrik Bauwerk, Abstimmung mit Ka… | ok |
| handwerk | AF04 | Durchführung und Protokoll | Durchführung=Technische Löschung durch Projekt- und Büro-IT (extern, fiktiv) bzw. Anbieter nach Freigabe; Best… | ok |
| handwerk | AF05 | Datenschutz und Aufbewahrung | Vorgehen (z. B. Sperrung statt Löschung)=Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach … | ok |
| handwerk | SY01 | Hardware und Betriebsumgebung | Umgebung=Rechnungssoftware, DATEV Unternehmen online, E-Mail, NAS, ggf. Kasse/Shop/WaWi laut Betriebs-Check. I… | ok |
| handwerk | SY02 | Schnittstellen | Schnittstellen=Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über … | ok |
| handwerk | SY03 | Importe, Exporte und Konvertierungen | Vorgänge und Prüfung=Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, … | ok |
| handwerk | SY04 | Eigene Berechnungen und Automatisierungen | Vorhanden=ja / Beschreibung (Zweck, Ersteller, Änderung)=Wiederkehrende Exporte und Erinnerungen; keine unprot… | ok |
| handwerk | SY92 | Kontrollen im Modul | Durchgeführte Kontrollen=Schnittstellenprotokoll, Systemliste aktuell / Turnus, wer, Nachweis je Kontrolle=Nac… | ok |
| handwerk | ZR01 | Rollen und Berechtigungen | Rolle und Rechte je System=Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränk… | ok |
| handwerk | ZR02 | Vergabe von Rechten | Antrag durch=Henrik Bauwerk beantragt neue Zugänge / Genehmigung durch=Projekt- und Büro-IT (extern, fiktiv) r… | teilweise („Genehmigung durch“: IT „richtet ein“) |
| handwerk | ZR03 | Entzug von Rechten | Ablauf=Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.… | ok |
| handwerk | ZR04 | Schutzmaßnahmen | Maßnahmen=Persönliche Zugänge (keine Sammelkonten), Zwei-Faktor-Anmeldung, Passwortregeln, Bildschirmsperre… | ok |
| handwerk | ZR05 | Protokollierung | Protokollierung vorhanden=ja / Auswertung durch=Anbieterprotokolle zu Logins und kritischen Änderungen werden … | **falsch** (Feld „Auswertung durch“ ohne Person) |
| handwerk | ZR92 | Kontrollen im Modul | Durchgeführte Kontrollen=Jährliche Rechteprüfung, Offboarding-Checkliste / Turnus, wer, Nachweis je Kontrolle=… | ok |
| handwerk | SN01 | Sicherungskonzept | Daten, Turnus, Ziel, Aufbewahrung=Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen … | ok |
| handwerk | SN03 | Ersatzverfahren | Ersatzverfahren=Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf… | ok |
| handwerk | SN04 | Nachbearbeitung | Nacherfassung und Nachweis=Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.… | ok |
| handwerk | SN05 | Notfallkontakte | Rolle oder Stelle (keine privaten Telefonnummern)=Kontakt: Henrik Bauwerk und Projekt- und Büro-IT (extern, fi… | ok |
| handwerk | SN92 | Kontrollen im Modul | Durchgeführte Kontrollen=Backup-Erfolgskontrolle, Jährlicher Restore-Test / Turnus, wer, Nachweis je Kontrolle… | ok |
| handwerk | KF01 | Vollständigkeitskontrollen | Kontrollen=Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen. Si… | ok |
| handwerk | KF02 | Richtigkeitskontrollen | Kontrollen=Erkennung über Abstimmungen und Systemhinweise.… | teilweise (keine Richtigkeitskontrolle benannt) |
| handwerk | KF03 | Abweichungen und Fehler | Ablauf=Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrekt… | ok |
| handwerk | KF04 | Kontrollnachweise | Nachweis (z. B. Abhakliste, Protokoll, Vermerk im System)=Abstimmungsprotokolle, Checklisten zum Monatsabschlu… | ok |
| handwerk | KF05 | Überwachung des Kontrollsystems | Überwachung durch=Henrik Bauwerk / Turnus=Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessänderun… | ok |
| handwerk | AU01 | Buchhaltungsservice und weitere Dienstleister | Dienstleister und Aufgaben=FiBu und Abschluss: Kanzlei Dammstieg GmbH (fiktiv). IT/Cloud: Anbieter und Projekt… | ok |
| handwerk | AU02 | IT- und Cloud-Dienstleister | Anbieter, Leistung, Speicherort=IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich z… | ok |
| handwerk | AU03 | Übergaben | Übergaben und Nachweis=Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Ü… | ok |
| handwerk | AU04 | Kontrolle der Dienstleister | Kontrolle=Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. Silke Moor… | ok |
| handwerk | AU05 | Verantwortungsgrenzen | Abgrenzung=Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Vera… | ok |
| handwerk | PZ00 | Ansprechpartner | Ansprechpartner (Name oder Rolle)=Henrik Bauwerk / Vertretung=Silke Moor… | ok |
| handwerk | PZ01 | Unmittelbarer Zugriff (Z1) | Nur-Lese-Zugang möglich=ja / Systeme=Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch IT und d… | ok |
| handwerk | PZ02 | Mittelbarer Zugriff (Z2) | Wer erstellt Auswertungen=Silke Moor erstellt Auswertungen nach Vorgabe der Prüfer.… | ok |
| handwerk | PZ04 | Bereitstellung von Belegen | Ablauf=Ankündigung, Benennung der Ansprechperson (Henrik Bauwerk), Bereitstellung von Leserecht oder Export, P… | ok |
| handwerk | PZ06 | Altdaten | Regelung (z. B. Lesezugang, Export, Archivsystem)=Frühere Fassungen der Verfahrensdokumentation und ältere Exp… | ok |
| handwerk | AE00 | Verantwortung und Vertretung | Verantwortlich (Name oder Rolle)=Henrik Bauwerk / Vertretung=Projekt- und Büro-IT (extern, fiktiv)… | ok |
| handwerk | AE01 | Einführung neuer Systeme | Ablauf=Neue Systeme nur nach Freigabe Henrik Bauwerk, mit Eintrag in der Systemliste und Anpassung dieser Doku… | ok |
| handwerk | AE02 | Updates und Versionswechsel | Ablauf=Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet un… | ok |
| handwerk | AE03 | Migration und Datenübernahme | Übernahme und Prüfung=Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende… | ok |
| handwerk | AE05 | Ablaufänderungen | Meldung und Übernahme=Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen … | ok |
| handwerk | AE06 | Historische Nachvollziehbarkeit | Änderungsverzeichnis, Versionen, Gültigkeitszeiträume=Frühere Fassungen bleiben versioniert im Kundenkonto dow… | ok |
| handwerk | AE92 | Kontrollen im Modul | Durchgeführte Kontrollen=Änderungsverzeichnis gepflegt, Systemliste nach Änderung aktualisiert / Turnus, wer, … | ok |
| handwerk | PF01 | Prüfturnus | Turnus=jährlich / Prüfung durch=Henrik Bauwerk mit Silke Moor. Jährliche Durchsicht aller aktiven Module und n… | ok |
| handwerk | PF03 | Freigabe durch die Geschäftsleitung | Ablauf (z. B. Unterschrift, Freigabevermerk)=Inhaltliche Freigabe der geänderten Kapitel durch Henrik Bauwerk … | ok |
| handwerk | BS05 | Abrechnung | Abrechnungsweg=Abschlags- und Schlussrechnungen mit Bezug zur Auftragsnummer.… | ok |
| handwerk | WW01 | System | System=Einfache Materialliste je Projekt (fiktiv), kein Voll-WaWi-Filialbetrieb / Erfasste Vorgänge=Materialei… | ok |

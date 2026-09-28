# Verfahrensdokumentation zur Belegablage

**für**

## {{identity.company | or "nicht angegeben"}}

Arbeitsfassung aus dem Fragebogen. Die Erzeugung ist keine Freigabe durch die Geschäftsführung und kein Nachweis gelebter Praxis.

| | |
| --- | --- |
| **Version** | {{version}} |
| **Gültig ab** | {{validFrom | or "—"}} |
| **Gültig bis** | {{validTo | or "offen"}} |
| **Änderung** | {{changeSummary | or "—"}} |
| **Geändert durch** | {{changedBy | or "—"}} |
| **Stand der Erzeugung** | {{generatedAt}} |
| **Erstellt für** | {{identity.email | or "nicht angegeben"}} |

## Für diese Fassung festgelegte Angaben

| Merkmal | Angabe aus dem Fragebogen |
| --- | --- |
| Rechtsform | {{answers.rechtsform | or "nicht angegeben"}} |
| Branche | {{answers.branchen | join ", " | or "nicht angegeben"}} |
| Mitarbeitende | {{answers.mitarbeitende | or "nicht angegeben"}} |
| Eingangsbelege | {{answers.eingangsbelege | join ", " | or "nicht angegeben"}} |
| Ausgangsrechnungen | {{answers.ausgangsrechnungen | join ", " | or "nicht angegeben"}} |
| Finanzbuchhaltung | {{answers.fibu | join ", " | or "nicht angegeben"}} |
| Archiv | {{answers.archiv | or "nicht angegeben"}} |
| Hosting | {{answers.hosting | or "nicht angegeben"}} |
| Sicherung | {{answers.backup | join ", " | or "nicht angegeben"}} |
| Zugriff | {{answers.zugriff | or "nicht angegeben"}} |
| Geschäftsführung | {{answers.gf | or "nicht angegeben"}} |
| Buchhaltung | {{answers.buchhaltung | or "nicht angegeben"}} |
| IT | {{answers.it | or "nicht angegeben"}} |
| Steuerberatung | {{answers.steuerberater | or "nicht angegeben"}} |
| Weitere Systeme | {{answers.weitereSysteme | or "nicht angegeben"}} |

Nicht genannte Schritte stehen als offener Punkt oder als „zu beschreiben/zu bestätigen“.

---

{{disclaimer}}

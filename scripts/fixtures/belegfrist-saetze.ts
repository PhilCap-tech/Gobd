/**
 * 21 Testsätze aus dem Zählungsbericht zu #348 (c-zaehlung-probe.txt).
 * Erwartet true, wenn die alte Zehnjahresfrist für Buchungsbelege behauptet wird.
 */
export const BELEGFRIST_SAETZE: ReadonlyArray<{ name: string; text: string; hit: boolean }> = [
  { name: "Basis", text: "Die Buchungsbelege werden 10 Jahre aufbewahrt.", hit: true },
  { name: "nach 10 Jahren", text: "Buchungsbelege werden nach 10 Jahren gelöscht.", hit: true },
  { name: "zehnjährige", text: "Für Buchungsbelege gilt eine zehnjährige Frist.", hit: true },
  { name: "Buchungsbelege + zehnjährige", text: "Buchungsbelege + zehnjährige Aufbewahrung im DMS.", hit: true },
  { name: "Buchungsbelege: zehnjährige", text: "Buchungsbelege: zehnjährige Aufbewahrung.", hit: true },
  { name: "10-jährige", text: "Für Buchungsbelege gilt die 10-jährige Frist.", hit: true },
  { name: "zehn Jahre", text: "Buchungsbelege werden zehn Jahre aufbewahrt.", hit: true },
  { name: "Einzahl", text: "Der Buchungsbeleg wird 10 Jahre aufbewahrt.", hit: true },
  {
    name: "Negation nicht mehr sondern",
    text: "Buchungsbelege werden nicht mehr 10 Jahre, sondern 8 Jahre aufbewahrt.",
    hit: false,
  },
  { name: "Negation 8 statt 10", text: "Für Buchungsbelege gelten 8 statt 10 Jahre.", hit: false },
  {
    name: "Negation ungleich pauschal",
    text: "Aufbewahrungsdauer (Buchungsbelege ≠ pauschal 10 Jahre)",
    hit: false,
  },
  {
    name: "Negation nicht 10 sondern",
    text: "Buchungsbelege werden nicht 10 Jahre aufbewahrt, sondern 8 Jahre.",
    hit: false,
  },
  { name: "Negation nicht 10", text: "Buchungsbelege werden nicht 10 Jahre aufbewahrt.", hit: false },
  { name: "Negation keine 10 mehr", text: "Für Buchungsbelege gelten keine 10 Jahre mehr.", hit: false },
  {
    name: "Negation nicht mehr zehn",
    text: "Buchungsbelege müssen nicht mehr zehn Jahre aufbewahrt werden.",
    hit: false,
  },
  {
    name: "Negation nicht länger",
    text: "Buchungsbelege werden nicht länger 10 Jahre aufbewahrt, sondern 8.",
    hit: false,
  },
  {
    name: "Negation statt 10 jetzt 8",
    text: "Statt 10 Jahren gelten für Buchungsbelege jetzt 8 Jahre.",
    hit: false,
  },
  { name: "Historie in Klammer", text: "Buchungsbelege: 8 Jahre (früher 10 Jahre).", hit: false },
  {
    name: "Dreiklang Komma",
    text: "Bücher 10 Jahre, Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre.",
    hit: false,
  },
  { name: "Dreiklang und", text: "Buchungsbelege acht Jahre und Bücher zehn Jahre.", hit: false },
  { name: "10 statt 8", text: "Buchungsbelege werden 10 statt 8 Jahre aufbewahrt.", hit: true },
];

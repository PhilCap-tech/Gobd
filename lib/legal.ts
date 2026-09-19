export const LEGAL_OPERATOR = {
  name: "IKAT GmbH",
  street: "Gartzenweg 1a",
  zipCity: "40789 Monheim am Rhein",
  country: "Deutschland",
  email: "info@gobd-doku-erstellen.de",
  phone: "+49 231 580 456 06",
  registerCourt: "Amtsgericht Düsseldorf",
  registerNumber: "HRB 81430",
  managingDirector: "Philip Cappelletti",
  vatId: "DE 313 803 988",
  siteUrl: "https://www.gobd-doku-erstellen.de",
  product: "GoBD Verfahrensdoku",
} as const;

export const LEGAL_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/cookies", label: "Cookies" },
] as const;

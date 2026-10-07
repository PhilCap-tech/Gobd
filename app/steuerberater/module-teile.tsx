import { TEIL_TITEL, moduleImTeil } from "@/lib/module/katalog";
import type { ModulTeil } from "@/lib/module/typen";

const TEILE: ModulTeil[] = [1, 2, 3, 4];

/** Teil II is the long Anwenderdokumentation (13 modules) and starts open. */
const DEFAULT_OPEN: ModulTeil = 2;

function modulAnzahl(count: number): string {
  return count === 1 ? "1 Modul" : `${count} Module`;
}

export function PartnerModuleTeile() {
  return (
    <div className="teil-accordion">
      {TEILE.map((teil) => {
        const eintraege = moduleImTeil(teil);
        const titel = TEIL_TITEL[teil];
        return (
          <details
            key={teil}
            className="teil-panel"
            open={teil === DEFAULT_OPEN}
          >
            <summary>
              <h3>{titel}</h3>
              <span className="teil-count">{modulAnzahl(eintraege.length)}</span>
            </summary>
            <div className="teil-panel-body">
              <nav className="teil-chips" aria-label={`Module in ${titel}`}>
                {eintraege.map((modul) => (
                  <a
                    key={modul.id}
                    className="chip teil-chip"
                    href={`#sb-modul-${modul.id}`}
                  >
                    {modul.nr}. {modul.titel}
                  </a>
                ))}
              </nav>
              <ul className="teil-module-list">
                {eintraege.map((modul) => (
                  <li key={modul.id} id={`sb-modul-${modul.id}`}>
                    <strong>
                      {modul.nr}. {modul.titel}
                    </strong>
                    <span>{modul.kurz}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}
    </div>
  );
}

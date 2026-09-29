// Connecteur : places libres des parkings de Berne
// Source : Parkleitsystem Bern AG — interface XML officielle pour services externes
// Conditions : mettre au moins un lien vers www.bernparking.ch ; revente des données interdite.
const URL_DONNEES = process.env.BERN_URL || "https://www.parking-bern.ch/parkdata.xml";
const INTERVALLE = 60 * 1000; // toutes les minutes
const SOURCE = "Parkleitsystem Bern AG";
const SOURCE_LIEN = "https://www.bernparking.ch";

// Noms et positions, repris de la page officielle www.parking-bern.ch
const PARKINGS = {
  "P01": { nom: "Bahnhof Parking", lat: 46.94991, lon: 7.43776 },
  "P02": { nom: "Metro Parking", lat: 46.94987, lon: 7.44520 },
  "P03": { nom: "Rathaus Parking", lat: 46.94895, lon: 7.45183 },
  "P04": { nom: "Parking City West", lat: 46.94631, lon: 7.43400 },
  "P05": { nom: "Mobiliar Parking", lat: 46.94505, lon: 7.43839 },
  "P06": { nom: "Casinoparking", lat: 46.94683, lon: 7.44725 },
  "P08": { nom: "expo Parking", lat: 46.95686, lon: 7.46834 },
  "P10": { nom: "Kursaal Parking", lat: 46.952943, lon: 7.448015 },
  "P+R": { nom: "Park + Ride Neufeld", lat: 46.96399, lon: 7.43130 },
  // même bâtiment que le Bahnhof Parking : légèrement décalé pour rester visible sur la carte
  "Kurzparking Bahnhof": { nom: "SBB Kurzparking (Bahnhof)", lat: 46.95010, lon: 7.43810 },
};

const attributs = (balise) => {
  const o = {};
  for (const m of balise.matchAll(/(\w+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};

async function interroger(majExterne) {
  try {
    const r = await fetch(URL_DONNEES, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("réponse " + r.status);
    const xml = await r.text();
    let n = 0;
    for (const [balise] of xml.matchAll(/<parking\b[^>]*\/?>/g)) {
      const a = attributs(balise);
      const code = (a.name || "").trim();
      const capacite = Number(a.spacecount);
      const libres = Number(a.spacefree);
      if (!code || !(capacite > 0)) continue; // parking inactif ou sans données (ex. spacecount = -1)
      const info = PARKINGS[code] || { nom: code };
      const ouvert = a.state !== "0";
      majExterne({
        id: "be-" + code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        nom: info.nom + (ouvert ? "" : " (fermé)"),
        ville: "Berne",
        capacite,
        lat: info.lat, lon: info.lon,
        libres: ouvert && Number.isFinite(libres) ? Math.max(0, Math.min(capacite, libres)) : 0,
        source: SOURCE,
        sourceLien: SOURCE_LIEN,
      });
      n++;
    }
    console.log(`[Berne] ${n} parkings mis à jour`);
  } catch (e) {
    console.error("[Berne] erreur de lecture des données :", e.message);
  }
}

exports.demarrer = (majExterne) => {
  interroger(majExterne);
  setInterval(() => interroger(majExterne), INTERVALLE);
};

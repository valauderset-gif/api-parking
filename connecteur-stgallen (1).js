// Connecteur de démonstration : places libres des parkings de Saint-Gall (open data officiel)
// Source : Stadt St.Gallen / PLS Parkleitsystem St.Gallen AG — daten.stadt.sg.ch
// Plusieurs adresses possibles du même jeu de données : on essaie dans l'ordre
const JEU = "freie-parkplatze-in-der-stadt-stgallen-pls";
const URLS = process.env.SG_URL ? [process.env.SG_URL] : [
  `https://daten.stadt.sg.ch/api/explore/v2.1/catalog/datasets/${JEU}/records?limit=100`,
  `https://daten.stadt.sg.ch/api/v2/catalog/datasets/${JEU}/exports/json`,
  `https://daten.stadt.sg.ch/api/records/1.0/search/?dataset=${JEU}&rows=100`,
];
const INTERVALLE = 60 * 1000; // toutes les minutes
const SOURCE = "Ville de Saint-Gall / PLS Parkleitsystem St.Gallen (open data)";

const nombre = (v) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? n : null; };
function premier(o, cles) { for (const k of cles) if (o[k] != null && o[k] !== "") return o[k]; }
function parMotif(o, motifs) {
  const k = Object.keys(o).find((k) => motifs.some((m) => k.toLowerCase().includes(m)) && nombre(o[k]) != null);
  return k ? o[k] : undefined;
}
function coordonnees(g) {
  if (!g) return {};
  if (Array.isArray(g)) return { lat: nombre(g[0]), lon: nombre(g[1]) };
  if (typeof g === "string") { const [a, b] = g.split(","); return { lat: nombre(a), lon: nombre(b) }; }
  if (g.lat != null) return { lat: nombre(g.lat), lon: nombre(g.lon ?? g.lng) };
  if (g.coordinates) return { lat: nombre(g.coordinates[1]), lon: nombre(g.coordinates[0]) };
  return {};
}

let champsAffiches = false;

async function interroger(majExterne) {
  try {
    let json = null, erreurs = [];
    for (const url of URLS) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) { erreurs.push(`${r.status} sur ${url}`); continue; }
        json = await r.json();
        break;
      } catch (e) { erreurs.push(`${e.message} sur ${url}`); }
    }
    if (!json) throw new Error(erreurs.join(" | "));
    let lignes = Array.isArray(json) ? json : json.results || json.records || [];
    lignes = lignes.map((l) => l.fields || l.record?.fields || l); // formats des anciennes versions
    if (!lignes.length) console.log("[Saint-Gall] réponse reçue mais vide :", JSON.stringify(json).slice(0, 300));
    if (!champsAffiches && lignes[0]) {
      console.log("[Saint-Gall] champs reçus :", Object.keys(lignes[0]).join(", "));
      champsAffiches = true;
    }
    const vus = new Set();
    for (const l of lignes) {
      const id = String(premier(l, ["phid", "id"]) ?? "").trim();
      if (!id || vus.has(id)) continue;
      vus.add(id);
      const libres = nombre(premier(l, ["shortfree", "frei", "free", "freie_parkplatze"]) ?? parMotif(l, ["free", "frei"]));
      const capacite = nombre(premier(l, ["shortmax", "max", "kapazitat", "capacity"]) ?? parMotif(l, ["max", "kapaz", "capac"]));
      const { lat, lon } = coordonnees(premier(l, ["geopoint", "geo_point_2d", "koordinaten", "coordinates"]));
      majExterne({
        id: "sg-" + id,
        nom: premier(l, ["phname", "name"]) || "Parking " + id,
        capacite, lat, lon,
        libres: libres == null ? null : Math.max(0, capacite ? Math.min(capacite, libres) : libres),
        source: SOURCE,
      });
    }
    console.log(`[Saint-Gall] ${vus.size} parkings mis à jour`);
  } catch (e) {
    console.error("[Saint-Gall] erreur de lecture des données :", e.message);
  }
}

exports.demarrer = (majExterne) => {
  interroger(majExterne);
  setInterval(() => interroger(majExterne), INTERVALLE);
};

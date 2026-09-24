// API temps réel des places libres — parkings
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-moi"; // clé secrète pour les capteurs

const app = express();
app.use(cors());          // permet à ton site WordPress d'appeler l'API
app.use(express.json());

// Chargement des parkings (infos fixes) + état en mémoire
const parkings = JSON.parse(fs.readFileSync(__dirname + "/parkings.json", "utf8"));
const etat = {}; // id -> { libres, majLe }
for (const p of parkings) etat[p.id] = { libres: null, majLe: null };

const clients = new Set(); // connexions temps réel (SSE)

function vue(p) {
  const e = etat[p.id];
  const libres = e.libres;
  return {
    ...p,
    libres,
    occupes: libres == null ? null : p.capacite - libres,
    statut: libres == null ? "inconnu" : libres === 0 ? "complet" : libres < p.capacite * 0.1 ? "presque complet" : "disponible",
    majLe: e.majLe,
  };
}

function diffuser(p) {
  const msg = `data: ${JSON.stringify(vue(p))}\n\n`;
  for (const res of clients) res.write(msg);
}

// Page d'affichage à intégrer dans un site via <iframe>
app.get("/widget", (req, res) => res.sendFile(__dirname + "/widget.html"));

// --- Lecture publique ---
app.get("/api/parkings", (req, res) => res.json(parkings.map(vue)));

app.get("/api/parkings/:id", (req, res) => {
  const p = parkings.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erreur: "Parking inconnu" });
  res.json(vue(p));
});

// Flux temps réel : le navigateur reçoit chaque changement instantanément
app.get("/api/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  for (const p of parkings) res.write(`data: ${JSON.stringify(vue(p))}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// --- Écriture par les capteurs (protégée par clé) ---
function auth(req, res, next) {
  if (req.get("x-api-key") !== API_KEY) return res.status(401).json({ erreur: "Clé API invalide" });
  next();
}

// Deux façons d'envoyer : { "libres": 42 } ou { "evenement": "entree" | "sortie" }
app.post("/api/parkings/:id/capteur", auth, (req, res) => {
  const p = parkings.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erreur: "Parking inconnu" });
  const e = etat[p.id];
  const { libres, evenement } = req.body || {};

  if (Number.isInteger(libres)) {
    e.libres = Math.max(0, Math.min(p.capacite, libres));
  } else if (evenement === "entree" || evenement === "sortie") {
    const base = e.libres ?? p.capacite;
    e.libres = Math.max(0, Math.min(p.capacite, base + (evenement === "entree" ? -1 : 1)));
  } else {
    return res.status(400).json({ erreur: 'Envoie { "libres": nombre } ou { "evenement": "entree"|"sortie" }' });
  }
  e.majLe = new Date().toISOString();
  diffuser(p);
  res.json(vue(p));
});

app.listen(PORT, () => console.log(`API parkings sur http://localhost:${PORT}`));

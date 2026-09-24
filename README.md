# API parkings — places libres en temps réel

## Lancer
```
npm install
API_KEY=ta-cle-secrete npm start
```
Modifie `parkings.json` avec tes vrais parkings (nom, adresse, capacité, coordonnées).

## Lecture (public)
- `GET /api/parkings` : tous les parkings avec places libres et statut
- `GET /api/parkings/:id` : un parking
- `GET /api/stream` : flux temps réel (Server-Sent Events), une mise à jour à chaque changement

## Envoi par les capteurs (protégé)
En-tête `x-api-key: ta-cle-secrete`, puis :
```
POST /api/parkings/p1/capteur   {"libres": 42}
POST /api/parkings/p1/capteur   {"evenement": "entree"}   // ou "sortie"
```

## Afficher sur un site (iframe)
Une page d'affichage prête est servie sur `/widget`. Dans la page du site, en mode Source :
```html
<iframe src="https://TON-API/widget" title="Places libres dans les parkings" width="100%" height="400" style="border:0"></iframe>
```
Remplace `TON-API` par l'adresse réelle du serveur hébergé (en https).

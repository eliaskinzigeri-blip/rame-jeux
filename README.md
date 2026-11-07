# Rame & Jeux

Web app de jeux pour rameur d'intérieur (testée pour le Woodrower, compatible avec tout rameur Bluetooth FTMS).
Aucune installation ni dépendance : HTML + JavaScript.

## Lancer
- **PC :** `python3 -m http.server 8000` dans ce dossier, puis ouvrir http://localhost:8000 dans Chrome ou Edge.
- **Téléphone / tablette :** l'héberger en HTTPS (Vercel, Netlify, GitHub Pages). Web Bluetooth et les capteurs exigent HTTPS.

## Sources de coups de rame
| Mode | Comment | Où ça marche |
|---|---|---|
| Bluetooth FTMS | Service 0x1826, caractéristique Rower Data 0x2AD1 (cadence, coups, distance, allure, puissance) | Chrome/Edge sur PC et Android. Pas sur iPhone (sauf avec le navigateur Bluefy) |
| Téléphone sur le siège | L'accéléromètre détecte chaque aller-retour du chariot | Tout téléphone (iPhone : il faut autoriser l'accès aux capteurs de mouvement) |
| Manuel | Espace ou tap à chaque coup | Partout |
| Simulation | Un rameur virtuel | Partout |

## Jeux
- **Régate** : course contre 3 bateaux fantômes et ton record.
- **Envol** : ta vitesse règle l'altitude de l'oiseau, qui doit attraper des anneaux. C'est du fractionné déguisé.
- **Cadence** : jeu de rythme, chaque attaque doit tomber sur le temps.
- **Tir à la corde** : ta vitesse contre un adversaire qui monte de niveau.
- **Fuite du kraken** : jeu de survie, le monstre accélère sans cesse.

## Comptes et synchronisation
À la première ouverture, chaque joueur crée un compte (pseudo, e-mail, mot de passe).
Les records, les fantômes de la Régate, les réglages et l'historique sont enregistrés dans Supabase
(table `rj_user_state`, une ligne par compte, protégée par RLS) et suivent le joueur sur tous ses appareils.
Une copie locale permet de jouer hors ligne : la synchro reprend au retour du réseau.
Le bouton « Changer de compte » permet à plusieurs personnes d'utiliser le même appareil.
Pour ajouter un jeu, créer `js/games/xxx.js` avec `Games.push({...})`. Prendre les jeux existants comme modèle.

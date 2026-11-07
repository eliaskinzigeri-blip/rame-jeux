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
| Micro (le plus réactif) | Détecte la montée du bruit de la roue ou de la sangle au début de la poussée (≈ 30-80 ms). Se combine avec le Bluetooth, qui garde les mesures | Tout appareil avec micro |
| Manuel | Espace ou tap à chaque coup | Partout |
| Simulation | Un rameur virtuel | Partout |

## Modes de jeu (monde 3D)
L'app reprend ce que proposent les apps de rameur connecté comme EXR (balade, séances, courses, mini-jeux) dans un lac 3D original
(Three.js : eau à reflets, ciel physique, berges boisées, montagnes, bassin balisé). Trois caméras au choix (touche C).
- **Course** (500 m / 1 km / 2 km) : 3 bateaux calés sur ton record, plus ton fantôme, avec le classement en direct.
- **Balade sur le lac** (5 à 30 min) : rame librement avec ton meilleur parcours en fantôme et un temps intermédiaire tous les 500 m.
- **Séances** : fractionné guidé (Pyramide, 8 × 250 m, Tempo 3 × 5 min, Express 12 min). Le score est le temps passé dans la zone de cadence.
- **Chasse aux bouées** : passe chaque bouée dorée au-dessus de l'allure cible pour la faire éclater.
- **Fuite du kraken** : jeu de survie, le monstre accélère sans cesse.
- **Cadence** : jeu de rythme, chaque attaque doit tomber sur le temps.

## Latence
Une console Bluetooth signale chaque coup 0,5 à 1 s après l'attaque réelle (≈ 1 trame/s, compteur incrémenté en fin de poussée).
L'app corrige ce retard de trois façons :
1. **Compensation calibrée** : bouton « Calibrer (30 s) ». Tu attaques sur 12 bips et l'app mesure le retard de ta source, enregistré par source et par compte.
   L'instant du coup est reculé d'autant, ce qui sert à l'animation et au jugement du jeu Cadence.
2. **Prédiction** : quand tu rames régulièrement, le coup suivant est joué à l'instant prévu (poussée du bateau et animation), sans attendre le capteur.
   Le vrai coup recale seulement la phase. Si tu t'arrêtes, un seul coup anticipé est joué.
3. **Modèle physique** : la vitesse réagit au coup, et les mesures de la console ne font que recalibrer ce modèle.
Côté graphismes, trois niveaux de qualité (haute, moyenne, éco). La qualité baisse automatiquement si l'image tombe sous 45 images/s, pour éviter le retard d'affichage.

## Comptes et synchronisation
À la première ouverture, chaque joueur crée un compte (pseudo, e-mail, mot de passe).
Les records, les fantômes de la Régate, les réglages et l'historique sont enregistrés dans Supabase
(table `rj_user_state`, une ligne par compte, protégée par RLS) et suivent le joueur sur tous ses appareils.
Une copie locale permet de jouer hors ligne : la synchro reprend au retour du réseau.
Le bouton « Changer de compte » permet à plusieurs personnes d'utiliser le même appareil.
Pour ajouter un jeu, créer `js/games/xxx.js` avec `Games.push({...})`, qui expose `update`, `state` (pour la 3D) et `hud`. Prendre les jeux existants comme modèle.

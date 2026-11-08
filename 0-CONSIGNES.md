# Consignes : ajouter un onglet « Jeux » à l'application rameur

Ces consignes viennent d'Elias. Le reste du zip sert de référence, à adapter à l'application existante (prepa-basket, partie /rameur).

## Ce qu'il faut faire
1. **Ajouter un onglet « Jeux »** à l'application rameur, séparé des séances.
2. Les jeux à reprendre (voir `captures/` et `code/games/`) :
   - **Course** (500 m / 1 km / 2 km contre des bateaux et son fantôme) ;
   - **Balade sur le lac** ;
   - **Chasse aux bouées** ;
   - **Fuite du kraken** ;
   - **Cadence** (jeu de rythme).
3. **Ne pas mettre de jeux dans les séances.** Les séances restent des entraînements, sans éléments de jeu. Le mode « Séances » du prototype (`code/games/seance.js`) ne doit donc pas être repris dans l'onglet Jeux.

## La détection au micro : uniquement pour les jeux
- Le micro sert **seulement à supprimer la latence dans les jeux**. En jeu, le retard de la console Bluetooth (0,5 à 1 s entre le coup réel et le coup à l'écran) **se ressent fort**.
- **Pendant les séances, le micro ne sert à rien** : ce retard ne se ressent presque pas. Les séances utilisent seulement les données Bluetooth de la console, sans micro.
- Fonctionnement détaillé du micro : `3-detection-au-micro.md`.

## L'intensité pilotée par les jeux
- Voir `2-intensite-dans-les-jeux.md` : réglage de la vraie résistance via le Bluetooth (FTMS, opcode 0x04), ou résistance simulée si la console refuse.
- Exemples : le kraken qui agrippe le bateau, un coach qui durcit la course quand c'est trop facile, du vent de face en balade.
- Les règles d'intensité propres au mode « Séances » du prototype ne concernent pas l'onglet Jeux.

## Prototype de référence
- Dépôt GitHub `eliaskinzigeri-blip/rame-jeux` (branche `main`), en ligne sur https://rame-jeux.vercel.app.
- Monde 3D en Three.js : `js/world3d.js` dans le dépôt.
- Rien n'a encore été testé sur le vrai rameur (Domyos Woodrower).

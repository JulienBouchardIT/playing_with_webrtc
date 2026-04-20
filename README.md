# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

## Ce que fait le projet

- Front statique compatible GitHub Pages.
- Signalisation automatique par room WebSocket (A et B peuvent etre sur des navigateurs, machines ou reseaux differents).
- Fallback manuel par copier-coller si le serveur de signalisation est indisponible.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Lancer le serveur de signalisation

Le front GitHub Pages a besoin d'un petit serveur WebSocket pour la signalisation automatique.

1. Va dans `signaling-server`.
2. Installe les dependances: `npm install`.
3. Lance le serveur: `npm start`.
4. Configure l'URL WebSocket dans la page (exemple local: `ws://localhost:8787`).

Pour un usage internet, deploie ce dossier sur un hebergement Node.js et utilise son URL `wss://...`.

## Utilisation

1. Sur A et B, renseigne la meme URL WebSocket et la meme room.
2. Clique sur `Connecter la room` sur les deux pages.
3. Sur B, clique sur `Accepter une offre`.
4. Sur A, clique sur `Creer une offre`.
5. L'offre et la reponse sont echangees automatiquement via la room.
6. Quand le canal est ouvert, envoie des messages.

### Fallback manuel

Si la signalisation est hors ligne, tu peux toujours copier-coller les blocs offre/reponse entre A et B.

## Limites

- Sans serveur de signalisation disponible, il faut utiliser le fallback manuel.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
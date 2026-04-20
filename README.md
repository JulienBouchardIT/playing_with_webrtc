# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

## Ce que fait le projet

- Aucune dependance npm.
- Aucune API serveur.
- Signalisation manuelle par copier-coller de l'offre et de la reponse SDP.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Utilisation

1. Sur la premiere page, clique sur `Creer une offre`.
2. Copie le bloc local et envoie-le a la seconde page.
3. Sur la seconde page, colle ce bloc dans `Signal distant`.
4. Clique sur `Generer une reponse`.
5. Copie la reponse generee et renvoie-la a la premiere page.
6. Sur la premiere page, colle cette reponse dans `Signal distant` puis clique sur `Appliquer la reponse`.
7. Quand le canal est ouvert, envoie des messages.

## Limites

- Sans serveur de signalisation, l'echange initial se fait manuellement.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
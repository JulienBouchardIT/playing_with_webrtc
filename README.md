# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

## Ce que fait le projet

- Front statique compatible GitHub Pages.
- Signalisation manuelle par copier-coller de l'offre et de la reponse SDP.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Utilisation

1. Sur la premiere page (A), clique sur `Creer une offre`.
2. Copie le bloc local et envoie-le a la seconde page (B).
3. Sur B, colle ce bloc dans `Bloc recu`.
4. Sur B, clique sur `Generer une reponse`.
5. Copie la reponse generee sur B et envoie-la a A.
6. Sur A, colle cette reponse dans `Bloc recu`, puis clique sur `Appliquer la reponse`.
7. Quand le canal est ouvert, envoie des messages.

## Limites

- Sans canal de signalisation automatique, l'echange initial se fait manuellement.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
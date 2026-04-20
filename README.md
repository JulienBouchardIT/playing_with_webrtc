# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

## Ce que fait le projet

- Front statique compatible GitHub Pages.
- Deux pages separees: `index.html` (host) et `join.html` (invite).
- La page host cree automatiquement une offre au chargement.
- Le lien d'invitation contient l'offre en base64 (`offer`).
- La page invite accepte automatiquement l'offre depuis l'URL et genere une reponse base64.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Utilisation

1. Ouvre `index.html` (host): l'offre est creee immediatement.
2. Copie le lien d'invitation et envoie-le a l'invite.
3. L'invite ouvre `join.html?offer=...`: la reponse est creee automatiquement.
4. L'invite copie la reponse base64 et l'envoie au host.
5. Le host colle cette reponse et clique `Appliquer la reponse`.
6. Quand le canal est ouvert, envoie des messages.

## Format recommande pour la reponse

- Base64 du JSON SDP (celui affiche sur `join.html`).

## Limites

- L'etape initiale reste semi-manuelle: l'invite renvoie son bloc base64 au host.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
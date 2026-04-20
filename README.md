# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

Page en ligne: https://julienbouchardit.github.io/playing_with_webrtc/

## Ce que fait le projet

- Front statique compatible GitHub Pages.
- Trois pages separees: `index.html` (host), `join.html` (invite) et `chat.html` (chat).
- La page host cree automatiquement une session au chargement.
- Le lien d'invitation contient la session en base64 (`session`).
- La page invite accepte automatiquement la session depuis l'URL et genere une reponse base64.
- Quand la session WebRTC passe en connectee, `chat.html` s'ouvre automatiquement.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Utilisation

1. Ouvre `index.html` (host): la session est creee immediatement.
2. Copie le lien d'invitation et envoie-le a l'invite.
3. L'invite ouvre `join.html?session=...`: la reponse est creee automatiquement.
4. L'invite copie la reponse base64 et l'envoie au host.
5. Le host colle cette reponse et clique `Appliquer la reponse`.
6. Quand la session devient connectee, la page `chat.html` s'ouvre automatiquement de chaque cote.
7. Echange les messages depuis `chat.html`.

## Format recommande pour la reponse

- Base64 du JSON SDP (celui affiche sur `join.html`).

## Limites

- L'etape initiale reste semi-manuelle: l'invite renvoie son bloc base64 au host.
- La page de connexion doit rester ouverte en arriere-plan pendant l'usage de `chat.html`.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
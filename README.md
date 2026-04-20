# WebRTC Duo Chat

Petite page statique compatible GitHub Pages pour discuter entre deux pages web avec WebRTC.

## Ce que fait le projet

- Front statique compatible GitHub Pages.
- Le host genere un lien d'invitation contenant l'offre en base64 dans l'URL.
- L'invite ouvre ce lien: l'offre est acceptee automatiquement et la reponse est generee.
- Reponse partageable en base64 (copier-coller) pour finaliser cote host.
- Chat texte via `RTCDataChannel`.

## Mise en ligne sur GitHub Pages

1. Cree un depot GitHub et pousse ces fichiers.
2. Dans les reglages du depot, active GitHub Pages sur la branche voulue.
3. Ouvre l'URL publiee sur deux navigateurs ou deux machines.

## Utilisation

1. Le host ouvre la page normalement (sans parametre `offer`).
2. Le host clique sur `Creer une offre`.
3. Le host copie le `Lien d'invitation` et l'envoie a l'invite.
4. L'invite ouvre ce lien: la page detecte l'offre et genere automatiquement une reponse.
5. L'invite copie le `Bloc base64 pret a partager` et l'envoie au host.
6. Le host colle ce bloc dans `Bloc recu` puis clique sur `Appliquer la reponse`.
7. Quand le canal est ouvert, envoie des messages.

## Formats acceptes dans Bloc recu

- JSON SDP (ancien format)
- Base64 du JSON SDP
- Lien contenant `?offer=...` ou `?answer=...`

## Limites

- L'etape initiale reste semi-manuelle: l'invite renvoie son bloc base64 au host.
- La connexion depend de WebRTC et des reseaux en face. Certains environnements tres restrictifs peuvent bloquer la liaison pair-a-pair.
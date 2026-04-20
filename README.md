# WebRTC Duo Chat

Simple static page compatible with GitHub Pages to chat between two web pages using WebRTC.

Live page: https://julienbouchardit.github.io/playing_with_webrtc/

## How it works

- Static frontend compatible with GitHub Pages.
- Three separate pages: `index.html` (host), `join.html` (invite), and `chat.html` (chat).
- The host page automatically creates a session on load.
- The invite link contains the session encoded in base64 (the `session` URL parameter).
- The invite page automatically accepts the session from the URL and generates a base64 answer.
- When the WebRTC session connects, `chat.html` automatically opens in a new tab.
- Text chat via `RTCDataChannel`.

## Deploying to GitHub Pages

1. Create a GitHub repository and push these files.
2. In your repository settings, enable GitHub Pages on the desired branch.
3. Open the published URL on two browsers or two different machines.

## Usage

1. Open `index.html` (host): the session is created immediately.
2. Copy the invite link and send it to your peer.
3. The invite opens `join.html?session=...`: the answer is generated automatically.
4. The invite copies the invite token and sends it to the host.
5. The host pastes the token and clicks `Apply answer`.
6. When the session connects, `chat.html` opens automatically in a new tab on both sides.
7. Exchange messages from the `chat.html` page.

## Token format

- Base64-encoded JSON containing the SDP answer (what is shown in the `Invite Token` field on `join.html`).

## Known limitations

- The initial step is semi-manual: the invite must copy and send their token to the host.
- The host/invite pages must remain open in the background while using the chat page.
- The connection depends on WebRTC and network configuration. Highly restrictive network environments may block peer-to-peer connections.
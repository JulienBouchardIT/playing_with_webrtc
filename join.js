const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const connectionBadge = document.querySelector("#connectionBadge");
const roleBadge = document.querySelector("#roleBadge");
const channelState = document.querySelector("#channelState");
const answerBase64 = document.querySelector("#answerBase64");
const localSignal = document.querySelector("#localSignal");
const copyAnswerButton = document.querySelector("#copyAnswerButton");
const regenerateAnswerButton = document.querySelector("#regenerateAnswerButton");

let peerConnection = null;
let dataChannel = null;
let bridgeChannel = null;
let sessionToken = null;
let sessionId = null;
let chatOpened = false;

function setConnectionState(label, isReady = false) {
  connectionBadge.textContent = label;
  connectionBadge.classList.toggle("badge-ready", isReady);
  connectionBadge.classList.toggle("badge-idle", !isReady);
}

function setChannelState(label) {
  channelState.textContent = label;
}

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseSessionToken(token) {
  const decoded = fromBase64(token);
  const payload = JSON.parse(decoded);

  if (payload.type !== "offer" || !payload.sdp) {
    throw new Error("Le parametre session n'est pas valide.");
  }

  return payload;
}

function setBridgeChannel(id) {
  if (bridgeChannel) {
    bridgeChannel.close();
  }

  bridgeChannel = new BroadcastChannel(`webrtc-chat-${id}`);
  bridgeChannel.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.kind === "sync-request") {
      const isConnected = !!dataChannel && dataChannel.readyState === "open";
      bridgeState(isConnected ? "Session connectee" : "En attente de connexion", isConnected);
      return;
    }

    if (payload.kind !== "outbound") {
      return;
    }

    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }

    dataChannel.send(payload.text);
    bridgeChannel.postMessage({ kind: "self", text: payload.text });
  });
}

function openChatPage() {
  const url = new URL("chat.html", window.location.href);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("role", "invite");
  const tab = window.open(url.toString(), "_blank");
  if (tab) {
    chatOpened = true;
    tab.focus();
  }
}

function bridgeState(text, connected = false) {
  if (!bridgeChannel) {
    return;
  }

  bridgeChannel.postMessage({ kind: "state", text, connected });
}

function wireDataChannel(channel) {
  dataChannel = channel;

  dataChannel.addEventListener("open", () => {
    setConnectionState("Connecte", true);
    setChannelState("Canal ouvert");
    bridgeState("Session connectee", true);
    if (!chatOpened) {
      openChatPage();
    }
  });

  dataChannel.addEventListener("close", () => {
    setConnectionState("Deconnecte", false);
    setChannelState("Canal ferme");
    bridgeState("Session fermee", false);
  });

  dataChannel.addEventListener("message", (event) => {
    if (!bridgeChannel) {
      return;
    }

    bridgeChannel.postMessage({ kind: "incoming", text: event.data });
  });
}

function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(configuration);
  setConnectionState("Session prete");

  peerConnection.addEventListener("connectionstatechange", () => {
    const state = peerConnection.connectionState;

    if (state === "connected") {
      setConnectionState("Connecte", true);
      return;
    }

    if (state === "connecting") {
      setConnectionState("Connexion en cours");
      setChannelState("Canal en cours");
      bridgeState("Connexion en cours", false);
      return;
    }

    if (state === "failed") {
      setConnectionState("Echec de connexion");
      setChannelState("Canal ferme");
      bridgeState("Echec de connexion", false);
      return;
    }

    if (state === "disconnected" || state === "closed") {
      setConnectionState("Deconnecte");
      setChannelState("Canal ferme");
      bridgeState("Session deconnectee", false);
    }
  });

  peerConnection.addEventListener("datachannel", (event) => {
    wireDataChannel(event.channel);
  });

  return peerConnection;
}

function waitForIceGatheringComplete(connection) {
  if (connection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    function handleChange() {
      if (connection.iceGatheringState === "complete") {
        connection.removeEventListener("icegatheringstatechange", handleChange);
        resolve();
      }
    }

    connection.addEventListener("icegatheringstatechange", handleChange);
  });
}

function resetSession() {
  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.close();
  }

  if (bridgeChannel) {
    bridgeChannel.close();
  }

  peerConnection = null;
  dataChannel = null;
  bridgeChannel = null;
  chatOpened = false;
  answerBase64.value = "";
  localSignal.value = "";
  setConnectionState("Hors ligne");
  setChannelState("Canal ferme");
}

async function acceptSessionFromUrl() {
  if (!sessionToken) {
    throw new Error("Cette page doit etre ouverte avec un parametre session dans l'URL.");
  }

  resetSession();
  roleBadge.textContent = "Role: Invite";

  const offer = parseSessionToken(sessionToken);
  sessionId = offer.sessionId || `session-${Date.now()}`;
  setBridgeChannel(sessionId);

  const connection = createPeerConnection();
  await connection.setRemoteDescription({ type: offer.type, sdp: offer.sdp });

  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceGatheringComplete(connection);

  const answerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId,
  };

  localSignal.value = JSON.stringify(answerPayload, null, 2);
  answerBase64.value = toBase64(JSON.stringify(answerPayload));
  setConnectionState("Reponse generee");
  setChannelState("Canal ferme");
  bridgeState("Reponse generee", false);
}

async function copyAnswer() {
  if (!answerBase64.value.trim()) {
    throw new Error("Aucune reponse a copier.");
  }

  await navigator.clipboard.writeText(answerBase64.value);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setChannelState(error.message || "Erreur");
  }
}

copyAnswerButton.addEventListener("click", () => runAction(copyAnswer));
regenerateAnswerButton.addEventListener("click", () => runAction(acceptSessionFromUrl));

const url = new URL(window.location.href);
sessionToken = url.searchParams.get("session") || url.searchParams.get("offer");

setConnectionState("Hors ligne");
setChannelState("Canal ferme");
runAction(acceptSessionFromUrl);

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const connectionBadge = document.querySelector("#connectionBadge");
const roleBadge = document.querySelector("#roleBadge");
const channelState = document.querySelector("#channelState");
const inviteLink = document.querySelector("#inviteLink");
const remoteSignal = document.querySelector("#remoteSignal");
const applyAnswerButton = document.querySelector("#applyAnswerButton");
const copyInviteLinkButton = document.querySelector("#copyInviteLinkButton");
const regenerateOfferButton = document.querySelector("#regenerateOfferButton");

let peerConnection = null;
let dataChannel = null;
let currentSessionId = null;
let bridgeChannel = null;
let chatOpened = false;

function setConnectionState(label, isReady = false) {
  connectionBadge.textContent = label;
  connectionBadge.classList.toggle("badge-ready", isReady);
  connectionBadge.classList.toggle("badge-idle", !isReady);
}

function setChannelState(label) {
  channelState.textContent = label;
}

function setRole(role) {
  roleBadge.textContent = `Role: ${role}`;
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function parseSignal(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Le signal colle est vide.");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    const answerToken = url.searchParams.get("answer");
    if (answerToken) {
      return parseSignal(answerToken);
    }
  }

  try {
    const parsedJson = JSON.parse(trimmed);
    if (parsedJson?.type && parsedJson?.sdp) {
      return parsedJson;
    }
  } catch (error) {
    // Continue with base64 parsing.
  }

  try {
    const decoded = fromBase64(trimmed);
    const parsedBase64 = JSON.parse(decoded);
    if (parsedBase64?.type && parsedBase64?.sdp) {
      return parsedBase64;
    }
  } catch (error) {
    // Fall through.
  }

  throw new Error("Le signal colle n'est ni un JSON valide ni un base64 valide.");
}

function setBridgeChannel(sessionId) {
  if (bridgeChannel) {
    bridgeChannel.close();
  }

  bridgeChannel = new BroadcastChannel(`webrtc-chat-${sessionId}`);
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

function openChatPage(role) {
  const url = new URL("chat.html", window.location.href);
  url.searchParams.set("session", currentSessionId);
  url.searchParams.set("role", role);
  chatOpened = true;
  window.location.assign(url.toString());
}

function bridgeState(stateLabel, connected = false) {
  if (!bridgeChannel) {
    return;
  }

  bridgeChannel.postMessage({
    kind: "state",
    text: stateLabel,
    connected,
  });
}

function wireDataChannel(channel) {
  dataChannel = channel;

  dataChannel.addEventListener("open", () => {
    setConnectionState("Connecte", true);
    setChannelState("Canal ouvert");
    bridgeState("Session connectee", true);
    if (!chatOpened) {
      openChatPage("host");
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

function attachPeerConnectionEvents() {
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
      bridgeState("Echec de connexion", false);
      return;
    }

    if (state === "disconnected" || state === "closed") {
      setConnectionState("Deconnecte");
      setChannelState("Canal ferme");
      bridgeState("Session deconnectee", false);
    }
  });
}

function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(configuration);
  attachPeerConnectionEvents();
  setConnectionState("Session prete");
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
  currentSessionId = null;
  chatOpened = false;
  inviteLink.value = "";
  remoteSignal.value = "";
  setConnectionState("Hors ligne");
  setChannelState("Canal ferme");
}

async function createSessionNow() {
  resetSession();
  setRole("Host");

  currentSessionId = generateSessionId();
  setBridgeChannel(currentSessionId);

  const connection = createPeerConnection();
  const channel = connection.createDataChannel("chat");
  wireDataChannel(channel);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceGatheringComplete(connection);

  const payload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: currentSessionId,
  };

  const token = toBase64(JSON.stringify(payload));
  const joinUrl = new URL("join.html", window.location.href);
  joinUrl.searchParams.set("session", token);
  inviteLink.value = joinUrl.toString();

  setConnectionState("Session generee");
  setChannelState("Canal ferme");
  bridgeState("Session generee", false);
}

async function applyAnswer() {
  const answer = parseSignal(remoteSignal.value.trim());

  if (!peerConnection || !peerConnection.localDescription || peerConnection.localDescription.type !== "offer") {
    throw new Error("Aucune session active. Regenerer d'abord la session.");
  }

  if (answer.type !== "answer") {
    throw new Error("Le bloc recu doit etre une reponse.");
  }

  if (peerConnection.remoteDescription) {
    return;
  }

  await peerConnection.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
  setConnectionState("Connexion en cours");
  setChannelState("Canal en cours");
  bridgeState("Reponse appliquee, connexion en cours", false);
}

async function copyInviteLink() {
  if (!inviteLink.value.trim()) {
    throw new Error("Aucun lien d'invitation a copier.");
  }

  await navigator.clipboard.writeText(inviteLink.value);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    setChannelState(error.message || "Erreur");
  }
}

applyAnswerButton.addEventListener("click", () => runAction(applyAnswer));
copyInviteLinkButton.addEventListener("click", () => runAction(copyInviteLink));
regenerateOfferButton.addEventListener("click", () => runAction(createSessionNow));

setConnectionState("Hors ligne");
setChannelState("Canal ferme");
runAction(createSessionNow);

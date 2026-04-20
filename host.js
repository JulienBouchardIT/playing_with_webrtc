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
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const applyAnswerButton = document.querySelector("#applyAnswerButton");
const copyInviteLinkButton = document.querySelector("#copyInviteLinkButton");
const regenerateOfferButton = document.querySelector("#regenerateOfferButton");
const chatForm = document.querySelector("#chatForm");
const messageTemplate = document.querySelector("#messageTemplate");

let peerConnection = null;
let dataChannel = null;
let currentSessionId = null;

function setConnectionState(label, isReady = false) {
  connectionBadge.textContent = label;
  connectionBadge.classList.toggle("badge-ready", isReady);
  connectionBadge.classList.toggle("badge-idle", !isReady);
}

function setChannelState(label, isOpen = false) {
  channelState.textContent = label;
  messageInput.disabled = !isOpen;
  sendButton.disabled = !isOpen;
}

function addMessage(author, body) {
  const fragment = messageTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".message");
  root.dataset.author = author;
  fragment.querySelector(".message-author").textContent = author;
  fragment.querySelector(".message-time").textContent = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  fragment.querySelector(".message-body").textContent = body;
  messages.append(fragment);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(body) {
  addMessage("Systeme", body);
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

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    // Continue with base64.
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

function wireDataChannel(channel) {
  dataChannel = channel;

  dataChannel.addEventListener("open", () => {
    setConnectionState("Connecte", true);
    setChannelState("Canal ouvert", true);
    addSystemMessage("Le canal WebRTC est pret.");
    messageInput.focus();
  });

  dataChannel.addEventListener("close", () => {
    setConnectionState("Deconnecte", false);
    setChannelState("Canal ferme", false);
    addSystemMessage("Le canal a ete ferme.");
  });

  dataChannel.addEventListener("message", (event) => {
    addMessage("Pair", event.data);
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
      return;
    }

    if (state === "failed") {
      setConnectionState("Echec de connexion");
      addSystemMessage("La connexion a echoue. Regenerer une nouvelle offre.");
      return;
    }

    if (state === "disconnected" || state === "closed") {
      setConnectionState("Deconnecte");
    }
  });

  peerConnection.addEventListener("datachannel", (event) => {
    wireDataChannel(event.channel);
  });
}

function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(configuration);
  attachPeerConnectionEvents();
  setConnectionState("Pret a negocier");
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

function resetOfferState() {
  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = null;
  dataChannel = null;
  currentSessionId = null;
  remoteSignal.value = "";
  inviteLink.value = "";
  messages.replaceChildren();
  messageInput.value = "";
  setConnectionState("Hors ligne");
  setChannelState("Canal ferme", false);
}

async function createOfferNow() {
  resetOfferState();
  roleBadge.textContent = "Role: Host";
  currentSessionId = generateSessionId();

  const connection = createPeerConnection();
  const channel = connection.createDataChannel("chat");
  wireDataChannel(channel);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceGatheringComplete(connection);

  const offerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: currentSessionId,
  };

  const offerBase64 = toBase64(JSON.stringify(offerPayload));

  const inviteUrl = new URL("join.html", window.location.href);
  inviteUrl.searchParams.set("session", offerBase64);
  inviteLink.value = inviteUrl.toString();

  setConnectionState("Session generee");
  addSystemMessage("Session creee automatiquement. Partage le lien d'invitation.");
}

async function applyAnswer() {
  const answer = parseSignal(remoteSignal.value.trim());

  if (!peerConnection || !peerConnection.localDescription || peerConnection.localDescription.type !== "offer") {
    throw new Error("Aucune session active. Regenerer d'abord la session.");
  }

  if (answer.type !== "answer") {
    throw new Error("Le signal distant doit etre une reponse.");
  }

  if (peerConnection.remoteDescription) {
    return;
  }

  await peerConnection.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
  setConnectionState("Connexion en cours");
  addSystemMessage("Reponse appliquee. Attente de l'ouverture du canal.");
}

async function copyText(value, emptyMessage) {
  if (!value.trim()) {
    throw new Error(emptyMessage);
  }

  await navigator.clipboard.writeText(value);
}

async function copyInviteLink() {
  await copyText(inviteLink.value, "Aucun lien d'invitation a copier.");
  addSystemMessage("Lien d'invitation copie.");
}

function sendMessage(event) {
  event.preventDefault();
  const value = messageInput.value.trim();

  if (!value || !dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  dataChannel.send(value);
  addMessage("Moi", value);
  messageInput.value = "";
  messageInput.focus();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    addSystemMessage(error.message || "Une erreur est survenue.");
  }
}

applyAnswerButton.addEventListener("click", () => runAction(applyAnswer));
copyInviteLinkButton.addEventListener("click", () => runAction(copyInviteLink));
regenerateOfferButton.addEventListener("click", () => runAction(createOfferNow));
chatForm.addEventListener("submit", sendMessage);

setConnectionState("Hors ligne");
setChannelState("Canal ferme", false);
runAction(createOfferNow);
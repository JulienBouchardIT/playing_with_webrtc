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
const localSignal = document.querySelector("#localSignal");
const localSignalBase64 = document.querySelector("#localSignalBase64");
const remoteSignal = document.querySelector("#remoteSignal");
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const createOfferButton = document.querySelector("#createOfferButton");
const acceptOfferButton = document.querySelector("#acceptOfferButton");
const createAnswerButton = document.querySelector("#createAnswerButton");
const applyAnswerButton = document.querySelector("#applyAnswerButton");
const copyInviteLinkButton = document.querySelector("#copyInviteLinkButton");
const copyLocalSignalButton = document.querySelector("#copyLocalSignalButton");
const copyLocalSignalBase64Button = document.querySelector("#copyLocalSignalBase64Button");
const resetButton = document.querySelector("#resetButton");
const chatForm = document.querySelector("#chatForm");
const messageTemplate = document.querySelector("#messageTemplate");

let peerConnection = null;
let dataChannel = null;
let currentRole = null;
let currentSessionId = null;

function setRole(role) {
  currentRole = role;
  roleBadge.textContent = role ? `Role: ${role}` : "Aucun role";
}

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

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasOfferReadyForAnswer() {
  return !!peerConnection && !!peerConnection.localDescription && peerConnection.localDescription.type === "offer";
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

function serializeDescription(description, extras = {}) {
  return JSON.stringify(
    {
      type: description.type,
      sdp: description.sdp,
      ...extras,
    },
    null,
    2,
  );
}

function encodeSignalBase64(payload) {
  return toBase64(JSON.stringify(payload));
}

function extractSignalToken(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Le signal colle est vide.");
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch (error) {
    return trimmed;
  }

  const offerToken = url.searchParams.get("offer");
  if (offerToken) {
    return offerToken;
  }

  const answerToken = url.searchParams.get("answer");
  if (answerToken) {
    return answerToken;
  }

  return trimmed;
}

function parseSignal(value) {
  const token = extractSignalToken(value);

  try {
    const parsedJson = JSON.parse(token);
    if (parsedJson?.type && parsedJson?.sdp) {
      return parsedJson;
    }
  } catch (error) {
    // Continue with base64 parsing.
  }

  try {
    const decoded = fromBase64(token);
    const parsedBase64 = JSON.parse(decoded);
    if (parsedBase64?.type && parsedBase64?.sdp) {
      return parsedBase64;
    }
  } catch (error) {
    // Fall through to unified error.
  }

  throw new Error("Le signal colle n'est ni un JSON valide ni un base64 valide.");
}

function buildInviteLink(offerBase64) {
  const url = new URL(window.location.href);
  url.searchParams.set("offer", offerBase64);
  return url.toString();
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
      addSystemMessage("La connexion a echoue. Reinitialise puis recommence l'echange.");
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

function resetChat() {
  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = null;
  dataChannel = null;
  currentRole = null;
  currentSessionId = null;
  inviteLink.value = "";
  localSignal.value = "";
  localSignalBase64.value = "";
  remoteSignal.value = "";
  messages.replaceChildren();
  messageInput.value = "";
  setRole(null);
  setConnectionState("Hors ligne");
  setChannelState("Canal ferme", false);
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

async function createOffer() {
  resetChat();
  setRole("Host");
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

  const offerJson = serializeDescription(connection.localDescription, { sessionId: currentSessionId });
  const offerBase64 = encodeSignalBase64(offerPayload);

  localSignal.value = offerJson;
  localSignalBase64.value = offerBase64;
  inviteLink.value = buildInviteLink(offerBase64);
  setConnectionState("Offre generee");
  addSystemMessage("Lien d'invitation genere. Partage ce lien avec l'invite.");
}

async function createAnswerFromOffer(offerPayload, source = "manual") {
  if (offerPayload.type !== "offer") {
    throw new Error("Le signal distant doit etre une offre.");
  }

  resetChat();
  setRole("Invite");
  currentSessionId = offerPayload.sessionId || null;

  const connection = createPeerConnection();
  await connection.setRemoteDescription({ type: offerPayload.type, sdp: offerPayload.sdp });

  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceGatheringComplete(connection);

  const answerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: currentSessionId,
  };

  localSignal.value = serializeDescription(connection.localDescription, { sessionId: currentSessionId });
  localSignalBase64.value = encodeSignalBase64(answerPayload);
  setConnectionState("Reponse generee");

  if (source === "invite-link") {
    addSystemMessage("Offre detectee dans le lien. Reponse base64 prete a copier pour le host.");
    return;
  }

  addSystemMessage("Reponse base64 prete. Envoie-la au host pour finaliser la connexion.");
}

async function createAnswer() {
  const offer = parseSignal(remoteSignal.value.trim());
  await createAnswerFromOffer(offer, "manual");
}

async function applyAnswerPayload(answer) {
  if (!hasOfferReadyForAnswer()) {
    throw new Error("Cree d'abord une offre avant d'appliquer une reponse.");
  }

  if (answer.type !== "answer") {
    throw new Error("Le signal distant doit etre une reponse.");
  }

  if (peerConnection.remoteDescription) {
    return;
  }

  await peerConnection.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
  setConnectionState("Connexion en cours");
  addSystemMessage("La reponse a ete appliquee. Attente de l'ouverture du canal.");
}

async function applyAnswer() {
  const answer = parseSignal(remoteSignal.value.trim());
  await applyAnswerPayload(answer);
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

async function copyLocalSignal() {
  await copyText(localSignal.value, "Aucun signal local JSON a copier.");
  addSystemMessage("Signal JSON copie dans le presse-papiers.");
}

async function copyLocalSignalBase64() {
  await copyText(localSignalBase64.value, "Aucun signal local base64 a copier.");
  addSystemMessage("Signal base64 copie dans le presse-papiers.");
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

function applyOfferFromUrlIfPresent() {
  const url = new URL(window.location.href);
  const offerToken = url.searchParams.get("offer");

  if (!offerToken) {
    setRole("Host");
    addSystemMessage("Mode host actif. Cree une offre pour generer un lien d'invitation.");
    return;
  }

  remoteSignal.value = offerToken;
  runAction(async () => {
    const offer = parseSignal(offerToken);
    await createAnswerFromOffer(offer, "invite-link");
  });
}

createOfferButton.addEventListener("click", () => runAction(createOffer));
acceptOfferButton.addEventListener("click", () => {
  remoteSignal.focus();
  addSystemMessage("Colle une offre (JSON/base64/lien) puis clique sur Generer une reponse.");
});
createAnswerButton.addEventListener("click", () => runAction(createAnswer));
applyAnswerButton.addEventListener("click", () => runAction(applyAnswer));
copyInviteLinkButton.addEventListener("click", () => runAction(copyInviteLink));
copyLocalSignalButton.addEventListener("click", () => runAction(copyLocalSignal));
copyLocalSignalBase64Button.addEventListener("click", () => runAction(copyLocalSignalBase64));
resetButton.addEventListener("click", () => {
  resetChat();
  addSystemMessage("Session chat reinitialisee.");
  applyOfferFromUrlIfPresent();
});
chatForm.addEventListener("submit", sendMessage);

setConnectionState("Hors ligne");
setChannelState("Canal ferme", false);
applyOfferFromUrlIfPresent();

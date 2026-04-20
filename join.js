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
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const copyAnswerButton = document.querySelector("#copyAnswerButton");
const regenerateAnswerButton = document.querySelector("#regenerateAnswerButton");
const chatForm = document.querySelector("#chatForm");
const messageTemplate = document.querySelector("#messageTemplate");

let peerConnection = null;
let dataChannel = null;
let sessionToken = null;

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

function fromBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function parseSessionFromToken(token) {
  const decoded = fromBase64(token);
  const payload = JSON.parse(decoded);

  if (payload.type !== "offer" || !payload.sdp) {
    throw new Error("Le parametre session n'est pas valide.");
  }

  return payload;
}

function wireDataChannel(channel) {
  dataChannel = channel;

  dataChannel.addEventListener("open", () => {
    setConnectionState("Connecte", true);
    setChannelState("Canal ouvert", true);
    addSystemMessage("Canal WebRTC ouvert. Tu peux discuter.");
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

function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(configuration);
  setConnectionState("Pret a negocier");

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
      addSystemMessage("Echec de connexion. Demande un nouveau lien d'invitation.");
      return;
    }

    if (state === "disconnected" || state === "closed") {
      setConnectionState("Deconnecte");
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

function resetInviteState() {
  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = null;
  dataChannel = null;
  answerBase64.value = "";
  localSignal.value = "";
  messages.replaceChildren();
  messageInput.value = "";
  setConnectionState("Hors ligne");
  setChannelState("Canal ferme", false);
}

async function acceptSessionFromUrl() {
  if (!sessionToken) {
    throw new Error("Cette page doit etre ouverte avec un parametre session dans l'URL.");
  }

  resetInviteState();
  roleBadge.textContent = "Role: Invite";

  const offer = parseSessionFromToken(sessionToken);
  const connection = createPeerConnection();
  await connection.setRemoteDescription({ type: offer.type, sdp: offer.sdp });

  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceGatheringComplete(connection);

  const answerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: offer.sessionId || null,
  };

  localSignal.value = JSON.stringify(answerPayload, null, 2);
  answerBase64.value = toBase64(JSON.stringify(answerPayload));
  setConnectionState("Reponse generee");
  addSystemMessage("Reponse prete. Copie-la et envoie-la au host.");
}

async function copyAnswer() {
  if (!answerBase64.value.trim()) {
    throw new Error("Aucune reponse a copier.");
  }

  await navigator.clipboard.writeText(answerBase64.value);
  addSystemMessage("Reponse copiee.");
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

copyAnswerButton.addEventListener("click", () => runAction(copyAnswer));
regenerateAnswerButton.addEventListener("click", () => runAction(acceptSessionFromUrl));
chatForm.addEventListener("submit", sendMessage);

const url = new URL(window.location.href);
sessionToken = url.searchParams.get("session") || url.searchParams.get("offer");

setConnectionState("Hors ligne");
setChannelState("Canal ferme", false);
runAction(acceptSessionFromUrl);
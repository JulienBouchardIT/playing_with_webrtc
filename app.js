const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const connectionBadge = document.querySelector("#connectionBadge");
const roleBadge = document.querySelector("#roleBadge");
const channelState = document.querySelector("#channelState");
const signalingState = document.querySelector("#signalingState");
const signalingUrlInput = document.querySelector("#signalingUrl");
const roomIdInput = document.querySelector("#roomId");
const localSignal = document.querySelector("#localSignal");
const remoteSignal = document.querySelector("#remoteSignal");
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const connectSignalingButton = document.querySelector("#connectSignalingButton");
const disconnectSignalingButton = document.querySelector("#disconnectSignalingButton");
const createOfferButton = document.querySelector("#createOfferButton");
const acceptOfferButton = document.querySelector("#acceptOfferButton");
const createAnswerButton = document.querySelector("#createAnswerButton");
const applyAnswerButton = document.querySelector("#applyAnswerButton");
const copyLocalSignalButton = document.querySelector("#copyLocalSignalButton");
const resetButton = document.querySelector("#resetButton");
const chatForm = document.querySelector("#chatForm");
const messageTemplate = document.querySelector("#messageTemplate");

let peerConnection = null;
let dataChannel = null;
let currentRole = null;
let currentSessionId = null;
let signalingSocket = null;
let joinedRoomId = null;

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

function setSignalingState(label) {
  signalingState.textContent = `Signalisation: ${label}`;
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

function hasSignalingConnection() {
  return !!signalingSocket && signalingSocket.readyState === WebSocket.OPEN && !!joinedRoomId;
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

function parseSignal(value) {
  try {
    const parsed = JSON.parse(value);

    if (!parsed?.type || !parsed?.sdp) {
      throw new Error("Format incomplet.");
    }

    return parsed;
  } catch (error) {
    throw new Error("Le signal colle n'est pas valide.");
  }
}

function sendSignalingMessage(payload) {
  if (!hasSignalingConnection()) {
    return false;
  }

  signalingSocket.send(JSON.stringify(payload));
  return true;
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
  localSignal.value = "";
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

async function createAnswerFromOffer(offerPayload, source = "manuel") {
  if (offerPayload.type !== "offer") {
    throw new Error("Le signal distant doit etre une offre.");
  }

  resetChat();
  setRole("Repondeur");
  currentSessionId = offerPayload.sessionId || currentSessionId || null;

  const connection = createPeerConnection();
  await connection.setRemoteDescription({ type: offerPayload.type, sdp: offerPayload.sdp });

  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceGatheringComplete(connection);

  localSignal.value = serializeDescription(connection.localDescription, { sessionId: currentSessionId });
  setConnectionState("Reponse generee");

  const answerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: currentSessionId,
  };

  if (sendSignalingMessage({ type: "answer", roomId: joinedRoomId, sessionId: currentSessionId, answer: answerPayload })) {
    if (source === "reseau") {
      addSystemMessage("Reponse envoyee automatiquement a A via la room.");
    } else {
      addSystemMessage("Reponse envoyee via la room.");
    }
    return;
  }

  addSystemMessage("Renvoie ce bloc a l'initiateur pour terminer la connexion.");
}

async function createOffer() {
  resetChat();
  setRole("Initiateur");
  currentSessionId = generateSessionId();

  const connection = createPeerConnection();
  const channel = connection.createDataChannel("chat");
  wireDataChannel(channel);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceGatheringComplete(connection);

  localSignal.value = serializeDescription(connection.localDescription, { sessionId: currentSessionId });
  setConnectionState("Offre generee");

  const offerPayload = {
    type: connection.localDescription.type,
    sdp: connection.localDescription.sdp,
    sessionId: currentSessionId,
  };

  if (sendSignalingMessage({ type: "offer", roomId: joinedRoomId, sessionId: currentSessionId, offer: offerPayload })) {
    addSystemMessage("Offre envoyee automatiquement via la room. Attente de la reponse.");
    return;
  }

  addSystemMessage("Signalisation indisponible. Envoie manuellement ce bloc a la seconde page.");
}

async function createAnswer() {
  const offer = parseSignal(remoteSignal.value.trim());
  await createAnswerFromOffer(offer, "manuel");
}

async function applyAnswerPayload(answer, source = "manuel") {
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

  if (source === "auto-reseau") {
    addSystemMessage("Reponse recue automatiquement depuis la room.");
  } else {
    addSystemMessage("La reponse a ete appliquee. Attente de l'ouverture du canal.");
  }
}

async function applyAnswer() {
  const answer = parseSignal(remoteSignal.value.trim());
  await applyAnswerPayload(answer, "manuel");
}

async function copyLocalSignal() {
  if (!localSignal.value.trim()) {
    throw new Error("Aucun signal local a copier.");
  }

  await navigator.clipboard.writeText(localSignal.value);
  addSystemMessage("Signal local copie dans le presse-papiers.");
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

function closeSignalingSocket(silent = false) {
  if (signalingSocket) {
    signalingSocket.close();
  }

  signalingSocket = null;
  joinedRoomId = null;

  if (!silent) {
    setSignalingState("hors ligne");
  }
}

function handleSignalingMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (payload.type === "joined") {
    setSignalingState(`connecte a ${payload.roomId}`);
    addSystemMessage(`Connecte a la room ${payload.roomId}.`);
    return;
  }

  if (payload.type === "peer-left") {
    addSystemMessage("Un pair a quitte la room.");
    return;
  }

  if (payload.type === "offer") {
    const offer = payload.offer;

    if (!offer || offer.type !== "offer") {
      return;
    }

    currentSessionId = payload.sessionId || offer.sessionId || null;
    remoteSignal.value = serializeDescription(offer, { sessionId: currentSessionId });

    if (currentRole === "Repondeur") {
      runAction(async () => {
        await createAnswerFromOffer({ ...offer, sessionId: currentSessionId }, "reseau");
      });
      return;
    }

    addSystemMessage("Offre recue via la room. Clique sur Accepter une offre pour repondre.");
    return;
  }

  if (payload.type === "answer") {
    const answer = payload.answer;

    if (!answer || answer.type !== "answer") {
      return;
    }

    if (currentRole !== "Initiateur") {
      return;
    }

    if (!currentSessionId || !payload.sessionId || payload.sessionId !== currentSessionId) {
      return;
    }

    remoteSignal.value = serializeDescription(answer, { sessionId: payload.sessionId });
    runAction(async () => {
      await applyAnswerPayload(answer, "auto-reseau");
    });
  }
}

function connectToSignaling() {
  const url = signalingUrlInput.value.trim();
  const roomId = roomIdInput.value.trim();

  if (!url) {
    throw new Error("Renseigne une URL WebSocket de signalisation.");
  }

  if (!roomId) {
    throw new Error("Renseigne un nom de room.");
  }

  if (hasSignalingConnection()) {
    throw new Error("Signalisation deja connectee.");
  }

  closeSignalingSocket(true);
  setSignalingState("connexion...");

  signalingSocket = new WebSocket(url);
  joinedRoomId = roomId;

  signalingSocket.addEventListener("open", () => {
    signalingSocket.send(JSON.stringify({ type: "join", roomId }));
    setSignalingState(`connecte a ${roomId}`);
  });

  signalingSocket.addEventListener("message", (event) => {
    try {
      handleSignalingMessage(JSON.parse(event.data));
    } catch (error) {
      addSystemMessage("Message de signalisation invalide recu.");
    }
  });

  signalingSocket.addEventListener("close", () => {
    signalingSocket = null;
    joinedRoomId = null;
    setSignalingState("hors ligne");
    addSystemMessage("Signalisation deconnectee.");
  });

  signalingSocket.addEventListener("error", () => {
    setSignalingState("erreur reseau");
    addSystemMessage("Impossible de joindre le serveur de signalisation.");
  });
}

function disconnectSignaling() {
  closeSignalingSocket();
  addSystemMessage("Signalisation deconnectee manuellement.");
}

createOfferButton.addEventListener("click", () => runAction(createOffer));
acceptOfferButton.addEventListener("click", () => {
  setRole("Repondeur");

  const existing = remoteSignal.value.trim();
  if (existing) {
    runAction(async () => {
      const offer = parseSignal(existing);
      await createAnswerFromOffer(offer, "manuel");
    });
    return;
  }

  addSystemMessage("Mode repondeur actif. Attente d'une offre via la room ou manuellement.");
});
createAnswerButton.addEventListener("click", () => runAction(createAnswer));
applyAnswerButton.addEventListener("click", () => runAction(applyAnswer));
copyLocalSignalButton.addEventListener("click", () => runAction(copyLocalSignal));
connectSignalingButton.addEventListener("click", () => runAction(connectToSignaling));
disconnectSignalingButton.addEventListener("click", disconnectSignaling);
resetButton.addEventListener("click", () => {
  resetChat();
  addSystemMessage("Session chat reinitialisee.");
});
chatForm.addEventListener("submit", sendMessage);

window.addEventListener("beforeunload", () => {
  closeSignalingSocket(true);
});

setSignalingState("hors ligne");
setConnectionState("Hors ligne");
setChannelState("Canal ferme", false);

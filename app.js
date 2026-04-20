const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const connectionBadge = document.querySelector("#connectionBadge");
const roleBadge = document.querySelector("#roleBadge");
const channelState = document.querySelector("#channelState");
const localSignal = document.querySelector("#localSignal");
const remoteSignal = document.querySelector("#remoteSignal");
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
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

function serializeDescription(description) {
  return JSON.stringify(
    {
      type: description.type,
      sdp: description.sdp,
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

async function createOffer() {
  resetChat();
  setRole("Initiateur");

  const connection = createPeerConnection();
  const channel = connection.createDataChannel("chat");
  wireDataChannel(channel);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceGatheringComplete(connection);

  localSignal.value = serializeDescription(connection.localDescription);
  setConnectionState("Offre generee");
  addSystemMessage("Envoie ce bloc a la seconde page, puis colle sa reponse dans le champ distant.");
}

async function createAnswer() {
  const offer = parseSignal(remoteSignal.value.trim());

  if (offer.type !== "offer") {
    throw new Error("Le signal distant doit etre une offre.");
  }

  resetChat();
  setRole("Repondeur");

  const connection = createPeerConnection();
  await connection.setRemoteDescription(offer);

  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceGatheringComplete(connection);

  localSignal.value = serializeDescription(connection.localDescription);
  setConnectionState("Reponse generee");
  addSystemMessage("Renvoie ce bloc a l'initiateur pour terminer la connexion.");
}

async function applyAnswer() {
  const answer = parseSignal(remoteSignal.value.trim());

  if (!peerConnection || !peerConnection.localDescription || peerConnection.localDescription.type !== "offer") {
    throw new Error("Cree d'abord une offre avant d'appliquer une reponse.");
  }

  if (answer.type !== "answer") {
    throw new Error("Le signal distant doit etre une reponse.");
  }

  await peerConnection.setRemoteDescription(answer);
  setConnectionState("Connexion en cours");
  addSystemMessage("La reponse a ete appliquee. Attente de l'ouverture du canal.");
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

createOfferButton.addEventListener("click", () => runAction(createOffer));
acceptOfferButton.addEventListener("click", () => {
  remoteSignal.focus();
  addSystemMessage("Colle une offre distante, puis clique sur Generer une reponse.");
});
createAnswerButton.addEventListener("click", () => runAction(createAnswer));
applyAnswerButton.addEventListener("click", () => runAction(applyAnswer));
copyLocalSignalButton.addEventListener("click", () => runAction(copyLocalSignal));
resetButton.addEventListener("click", resetChat);
chatForm.addEventListener("submit", sendMessage);

setConnectionState("Hors ligne");
setChannelState("Canal ferme", false);
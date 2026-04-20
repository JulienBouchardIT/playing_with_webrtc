const connectionBadge = document.querySelector("#connectionBadge");
const channelState = document.querySelector("#channelState");
const chatMeta = document.querySelector("#chatMeta");
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const chatForm = document.querySelector("#chatForm");
const messageTemplate = document.querySelector("#messageTemplate");

const url = new URL(window.location.href);
const sessionId = url.searchParams.get("session");
const role = url.searchParams.get("role") || "user";

let bridgeChannel = null;
let isConnected = false;
let syncTimer = null;

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

function handleBridgeMessage(event) {
  const payload = event.data;
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (payload.kind === "state") {
    isConnected = !!payload.connected;
    setConnectionState(payload.text || "Etat inconnu", !!payload.connected);
    setChannelState(payload.connected ? "Canal ouvert" : "Canal ferme", !!payload.connected);

    if (isConnected && syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    return;
  }

  if (payload.kind === "incoming") {
    addMessage("Pair", payload.text || "");
    return;
  }

  if (payload.kind === "self") {
    addMessage("Moi", payload.text || "");
  }
}

function sendMessage(event) {
  event.preventDefault();
  const value = messageInput.value.trim();

  if (!value || !bridgeChannel) {
    return;
  }

  bridgeChannel.postMessage({ kind: "outbound", text: value });
  messageInput.value = "";
  messageInput.focus();
}

function init() {
  if (!sessionId) {
    chatMeta.textContent = "Session manquante dans l'URL.";
    setConnectionState("Session manquante");
    setChannelState("Canal ferme", false);
    return;
  }

  chatMeta.textContent = `Role: ${role} | Session: ${sessionId}`;
  bridgeChannel = new BroadcastChannel(`webrtc-chat-${sessionId}`);
  bridgeChannel.addEventListener("message", handleBridgeMessage);

  setConnectionState("En attente de connexion");
  setChannelState("Canal ferme", false);
  addSystemMessage("Page chat prete. En attente d'une session connectee.");

  // Ask the host/invite page for current state in case initial events were missed.
  bridgeChannel.postMessage({ kind: "sync-request" });

  // Retry sync while disconnected in case the first request was sent too early.
  syncTimer = setInterval(() => {
    if (!bridgeChannel || isConnected) {
      return;
    }

    bridgeChannel.postMessage({ kind: "sync-request" });
  }, 1500);
}

chatForm.addEventListener("submit", sendMessage);
window.addEventListener("beforeunload", () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (bridgeChannel) {
    bridgeChannel.close();
  }
});

init();
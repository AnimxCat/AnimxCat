/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const twitchChannel = "catsaac_";

/* =========================================================
   STREAMER / VIEWER
   ========================================================= */

const params = new URLSearchParams(window.location.search);
const isStreamer = params.get("streamer") === "1";
const isViewer = !isStreamer;

/* =========================================================
   ELEMENTOS
   ========================================================= */

const video = document.getElementById("videoPlayer");
const emptyMessage = document.getElementById("emptyMessage");
const streamerControls = document.getElementById("streamerControls");
const urlInput = document.getElementById("urlInput");
const loadBtn = document.getElementById("loadBtn");
const chapterSelect = document.getElementById("chapterSelect");
const viewerVolumeControl = document.getElementById("viewerVolumeControl");
const viewerVolume = document.getElementById("viewerVolume");
const twitchStreamFrame = document.getElementById("twitchStreamFrame");
const twitchChatFrame = document.getElementById("twitchChatFrame");

/* =========================================================
   TWITCH
   ========================================================= */

const currentHost = window.location.hostname || "localhost";

if (twitchStreamFrame) {
    twitchStreamFrame.src = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${currentHost}&theme=dark`;
}

if (twitchChatFrame) {
    twitchChatFrame.src = `https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${currentHost}&theme=dark`;
}

/* =========================================================
   PEERJS (Sincronización WebRTC por Internet)
   ========================================================= */

// Cargar la librería PeerJS dinámicamente
const peerScript = document.createElement('script');
peerScript.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
document.head.appendChild(peerScript);

const STREAMER_PEER_ID = "animxcat-stream-room-v1";
let peer = null;
let connections = []; // Conexiones de espectadores (si es Streamer)
let streamerConn = null; // Conexión con el Streamer (si es Viewer)

peerScript.onload = () => {
    if (isStreamer) {
        // Inicializar el Streamer con una ID fija
        peer = new Peer(STREAMER_PEER_ID);

        peer.on('open', (id) => {
            console.log("Streamer listo con ID:", id);
        });

        // Aceptar espectadores que se conectan
        peer.on('connection', (conn) => {
            connections.push(conn);
            
            // Enviar estado actual del video al nuevo espectador
            if (video && video.src) {
                conn.send({
                    type: "LOAD",
                    path: video.src,
                    time: video.currentTime
                });
            }

            conn.on('close', () => {
                connections = connections.filter(c => c !== conn);
            });
        });

    } else {
        // Inicializar el Espectador con ID aleatoria y conectarse al Streamer
        peer = new Peer();

        peer.on('open', () => {
            streamerConn = peer.connect(STREAMER_PEER_ID);

            streamerConn.on('data', (data) => {
                handleViewerSync(data);
            });
        });
    }
};

// Función para enviar mensajes del Streamer a TODOS los espectadores
function broadcast(data) {
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

/* =========================================================
   CONFIGURAR INTERFAZ Y CONTROLES
   ========================================================= */

if (isViewer) {
    if (streamerControls) streamerControls.style.display = "none";
    video.controls = false;
    if (viewerVolumeControl) viewerVolumeControl.style.display = "flex";
} else {
    if (streamerControls) streamerControls.style.display = "flex";
    video.controls = true;
    if (viewerVolumeControl) viewerVolumeControl.style.display = "none";
}

function showVideo() {
    if (emptyMessage) emptyMessage.style.display = "none";
    if (video) video.style.display = "block";
}

function setVideoSource(filePath, notifyViewer = false) {
    if (!filePath || !video) return;

    showVideo();
    video.src = filePath;
    video.load();

    if (notifyViewer) {
        broadcast({
            type: "LOAD",
            path: filePath,
            time: 0
        });
    }
}

/* =========================================================
   EVENTOS DEL STREAMER
   ========================================================= */

if (isStreamer) {
    if (chapterSelect) {
        chapterSelect.addEventListener("change", (e) => {
            const path = e.target.value;
            if (path) setVideoSource(path, true);
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener("click", () => {
            let path = urlInput.value.trim();
            if (!path) return;
            setVideoSource(path, true);
            urlInput.value = "";
        });
    }

    if (urlInput) {
        urlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && loadBtn) loadBtn.click();
        });
    }

    video.addEventListener("play", () => {
        broadcast({ type: "PLAY", time: video.currentTime });
    });

    video.addEventListener("pause", () => {
        broadcast({ type: "PAUSE", time: video.currentTime });
    });

    video.addEventListener("seeked", () => {
        broadcast({ type: "SEEK", time: video.currentTime });
    });

    // Envío constante de posición cada 1 segundo para corregir desfases
    setInterval(() => {
        if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

        broadcast({
            type: "HEARTBEAT",
            time: video.currentTime,
            playing: !video.paused
        });
    }, 1000);
}

/* =========================================================
   LÓGICA DE SINCRONIZACIÓN PARA EL VIEWER
   ========================================================= */

async function handleViewerSync(data) {
    if (!data || !video) return;

    if (data.type === "LOAD") {
        video.src = data.path;
        video.load();
        showVideo();
        return;
    }

    if (data.type === "PLAY") {
        if (typeof data.time === "number") video.currentTime = data.time;
        try {
            await video.play();
        } catch (e) {
            video.muted = true;
            await video.play().catch(() => {});
        }
        return;
    }

    if (data.type === "PAUSE") {
        if (typeof data.time === "number") video.currentTime = data.time;
        video.pause();
        return;
    }

    if (data.type === "SEEK") {
        if (typeof data.time === "number") video.currentTime = data.time;
        return;
    }

    if (data.type === "HEARTBEAT") {
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;

        const diff = data.time - video.currentTime;
        const absDiff = Math.abs(diff);

        if (absDiff > 1.5) {
            video.currentTime = data.time;
        } else if (absDiff > 0.35) {
            video.playbackRate = diff > 0 ? 1.05 : 0.95;
        } else {
            video.playbackRate = 1.0;
        }

        if (data.playing && video.paused) {
            video.play().catch(() => {});
        } else if (!data.playing && !video.paused) {
            video.pause();
        }
    }
}

/* =========================================================
   CONTROL DE VOLUMEN VIEWER
   ========================================================= */

if (isViewer && viewerVolume) {
    viewerVolume.addEventListener("input", () => {
        video.volume = Number(viewerVolume.value);
        if (video.volume > 0) video.muted = false;
    });
}

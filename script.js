/* =========================================================
   CONFIGURACIÓN Y DETECCIÓN
   ========================================================= */

const twitchChannel = "catsaac_";
const params = new URLSearchParams(window.location.search);
const isStreamer = params.get("streamer") === "1";
const isViewer = !isStreamer;

/* =========================================================
   ELEMENTOS HTML
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
   CONFIGURACIÓN DE VISTA
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

/* =========================================================
   PEERJS (CONEXIÓN REMOTA EN TIEMPO REAL)
   ========================================================= */

// ID de la sala única de transmisión
const ROOM_ID = "animxcat-stream-room-v2";
let peer = null;
let connections = [];
let streamerConn = null;

function broadcast(data) {
    connections.forEach(conn => {
        if (conn && conn.open) {
            conn.send(data);
        }
    });
}

if (isStreamer) {
    // STREAMER: Inicia como Host de la sala
    peer = new Peer(ROOM_ID);

    peer.on('open', (id) => {
        console.log("✅ Servidor Streamer activo. ID de Sala:", id);
    });

    peer.on('connection', (conn) => {
        console.log("🔗 Viewer conectado.");
        connections.push(conn);

        // Si ya hay un video en curso, enviárselo inmediatamente al nuevo Viewer
        if (video && video.src) {
            conn.on('open', () => {
                conn.send({
                    type: "LOAD",
                    path: video.src,
                    time: video.currentTime,
                    playing: !video.paused
                });
            });
        }

        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
        });
    });

    peer.on('error', (err) => {
        console.error("❌ Error de conexión en Streamer:", err);
        if (err.type === 'unavailable-id') {
            console.warn("⚠️ La sala ya está ocupada por otra pestaña. Cierra las pestañas antiguas e intenta de nuevo.");
        }
    });

} else {
    // VIEWER: Se conecta automáticamente al Streamer
    peer = new Peer();

    peer.on('open', () => {
        console.log("📡 Conectando con la sala del Streamer...");
        connectToStreamer();
    });

    function connectToStreamer() {
        streamerConn = peer.connect(ROOM_ID);

        streamerConn.on('open', () => {
            console.log("✅ Conectado exitosamente al Streamer.");
        });

        streamerConn.on('data', (data) => {
            handleViewerSync(data);
        });

        streamerConn.on('close', () => {
            console.warn("⚠️ Se perdió la conexión con el Streamer. Intentando reconectar...");
            setTimeout(connectToStreamer, 3000);
        });
    }

    peer.on('error', (err) => {
        console.error("❌ Error en Viewer:", err);
    });
}

/* =========================================================
   ACCIONES DEL STREAMER
   ========================================================= */

function setVideoSource(filePath, notifyViewer = false) {
    if (!filePath || !video) return;

    showVideo();
    video.src = filePath;
    video.load();
    video.play().catch(() => {});

    if (notifyViewer) {
        broadcast({
            type: "LOAD",
            path: filePath,
            time: 0,
            playing: true
        });
    }
}

if (isStreamer) {
    if (chapterSelect) {
        chapterSelect.addEventListener("change", (e) => {
            if (e.target.value) setVideoSource(e.target.value, true);
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener("click", () => {
            const path = urlInput.value.trim();
            if (path) {
                setVideoSource(path, true);
                urlInput.value = "";
            }
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

    // Envío periódico de la posición para mantener a todos alineados
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
   SINCRONIZACIÓN EN EL VIEWER
   ========================================================= */

async function handleViewerSync(data) {
    if (!data || !video) return;

    if (data.type === "LOAD") {
        video.src = data.path;
        video.load();
        showVideo();
        if (data.playing) {
            playVideoSafely();
        }
        return;
    }

    if (data.type === "PLAY") {
        if (typeof data.time === "number") video.currentTime = data.time;
        playVideoSafely();
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
        if (Math.abs(diff) > 1.5) {
            video.currentTime = data.time;
        }

        if (data.playing && video.paused) {
            playVideoSafely();
        } else if (!data.playing && !video.paused) {
            video.pause();
        }
    }
}

async function playVideoSafely() {
    try {
        await video.play();
    } catch (e) {
        // Si el navegador bloquea la reproducción por políticas de Autoplay con audio
        video.muted = true;
        await video.play().catch(() => {});
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

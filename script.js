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
    twitchStreamFrame.src =
        `https://player.twitch.tv/?channel=${twitchChannel}&parent=${currentHost}&theme=dark`;
}

if (twitchChatFrame) {
    twitchChatFrame.src =
        `https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${currentHost}&theme=dark`;
}

/* =========================================================
   PEERJS (Sincronización por Internet)
   ========================================================= */

const peerScript = document.createElement("script");
peerScript.src = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";
document.head.appendChild(peerScript);

const STREAMER_PEER_ID = "animxcat-stream-room-v1";

let peer = null;
let connections = [];
let streamerConn = null;

/* =========================================================
   PEERJS
   ========================================================= */

peerScript.onload = () => {

    /* =====================================================
       STREAMER
       ===================================================== */

    if (isStreamer) {

        peer = new Peer(STREAMER_PEER_ID);

        peer.on("open", (id) => {
            console.log("Streamer listo con ID:", id);
        });

        peer.on("error", (err) => {
            console.error("Error de PeerJS:", err);
        });

        peer.on("connection", (conn) => {

            console.log("Viewer conectado.");

            connections.push(conn);

            /*
             * IMPORTANTE:
             * Esperamos a que la conexión esté realmente abierta
             * antes de enviar el video.
             */

            const sendCurrentVideo = () => {

                if (!video || !video.src) return;

                console.log("Enviando video actual al Viewer:", video.src);

                conn.send({
                    type: "LOAD",
                    path: video.src,
                    time: video.currentTime
                });

                /*
                 * Si el Streamer ya estaba reproduciendo cuando
                 * el Viewer se conectó, también le mandamos PLAY.
                 */

                if (!video.paused) {

                    conn.send({
                        type: "PLAY",
                        time: video.currentTime
                    });
                }
            };

            if (conn.open) {
                sendCurrentVideo();
            } else {
                conn.on("open", () => {
                    sendCurrentVideo();
                });
            }

            conn.on("close", () => {

                connections = connections.filter(
                    c => c !== conn
                );

                console.log("Viewer desconectado.");
            });

            conn.on("error", (err) => {
                console.error("Error de conexión con Viewer:", err);
            });
        });

    }

    /* =====================================================
       VIEWER
       ===================================================== */

    else {

        peer = new Peer();

        peer.on("open", (id) => {

            console.log("Viewer Peer listo:", id);

            streamerConn = peer.connect(STREAMER_PEER_ID);

            /*
             * Esperamos a que la conexión esté realmente abierta.
             */

            streamerConn.on("open", () => {

                console.log("Conectado al Streamer.");

            });

            streamerConn.on("data", (data) => {

                console.log("Comando recibido:", data);

                handleViewerSync(data);
            });

            streamerConn.on("close", () => {

                console.log("Conexión con Streamer cerrada.");

            });

            streamerConn.on("error", (err) => {

                console.error(
                    "Error de conexión con Streamer:",
                    err
                );

            });
        });

        peer.on("error", (err) => {

            console.error(
                "Error de PeerJS en Viewer:",
                err
            );

        });
    }
};

/* =========================================================
   BROADCAST
   ========================================================= */

function broadcast(data) {

    connections.forEach((conn) => {

        if (conn && conn.open) {

            try {
                conn.send(data);
            } catch (err) {

                console.error(
                    "Error enviando datos:",
                    err
                );

            }
        }
    });
}

/* =========================================================
   CONFIGURAR INTERFAZ Y CONTROLES
   ========================================================= */

if (isViewer) {

    if (streamerControls) {
        streamerControls.style.display = "none";
    }

    video.controls = false;

    if (viewerVolumeControl) {
        viewerVolumeControl.style.display = "flex";
    }

} else {

    if (streamerControls) {
        streamerControls.style.display = "flex";
    }

    video.controls = true;

    if (viewerVolumeControl) {
        viewerVolumeControl.style.display = "none";
    }
}

/* =========================================================
   MOSTRAR VIDEO
   ========================================================= */

function showVideo() {

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }

    if (video) {
        video.style.display = "block";
    }
}

/* =========================================================
   CARGAR VIDEO
   ========================================================= */

function setVideoSource(filePath, notifyViewer = false) {

    if (!filePath || !video) return;

    showVideo();

    /*
     * Detener el video anterior antes de cambiarlo.
     */

    video.pause();

    video.src = filePath;
    video.load();

    /*
     * Primero avisamos al Viewer que debe cargar
     * el nuevo video.
     */

    if (notifyViewer) {

        broadcast({
            type: "LOAD",
            path: filePath,
            time: 0
        });
    }

    /*
     * Después intentamos reproducir el video del Streamer.
     */

    const playPromise = video.play();

    if (playPromise !== undefined) {

        playPromise.catch((err) => {

            console.log(
                "Esperando reproducción del usuario...",
                err
            );

        });
    }
}

/* =========================================================
   EVENTOS DEL STREAMER
   ========================================================= */

if (isStreamer) {

    /* =====================================================
       CAMBIO DE CAPÍTULO
       ===================================================== */

    if (chapterSelect) {

        chapterSelect.addEventListener("change", (e) => {

            const path = e.target.value;

            if (path) {
                setVideoSource(path, true);
            }

        });
    }

    /* =====================================================
       CARGAR URL
       ===================================================== */

    if (loadBtn) {

        loadBtn.addEventListener("click", () => {

            const path = urlInput.value.trim();

            if (!path) return;

            setVideoSource(path, true);

            urlInput.value = "";

        });
    }

    /* =====================================================
       ENTER EN URL
       ===================================================== */

    if (urlInput) {

        urlInput.addEventListener("keydown", (e) => {

            if (
                e.key === "Enter" &&
                loadBtn
            ) {

                loadBtn.click();

            }

        });
    }

    /* =====================================================
       PLAY
       ===================================================== */

    video.addEventListener("play", () => {

        broadcast({
            type: "PLAY",
            time: video.currentTime
        });

    });

    /* =====================================================
       PAUSE
       ===================================================== */

    video.addEventListener("pause", () => {

        broadcast({
            type: "PAUSE",
            time: video.currentTime
        });

    });

    /* =====================================================
       SEEK
       ===================================================== */

    video.addEventListener("seeked", () => {

        broadcast({
            type: "SEEK",
            time: video.currentTime
        });

    });

    /* =====================================================
       HEARTBEAT
       ===================================================== */

    setInterval(() => {

        if (
            !video ||
            video.readyState < HTMLMediaElement.HAVE_METADATA
        ) {
            return;
        }

        broadcast({
            type: "HEARTBEAT",
            time: video.currentTime,
            playing: !video.paused
        });

    }, 1000);
}

/* =========================================================
   ESPERAR A QUE EL VIDEO DEL VIEWER ESTÉ LISTO
   ========================================================= */

function waitForVideoReady(callback) {

    if (!video) return;

    if (
        video.readyState >=
        HTMLMediaElement.HAVE_METADATA
    ) {

        callback();
        return;
    }

    const onLoadedMetadata = () => {

        video.removeEventListener(
            "loadedmetadata",
            onLoadedMetadata
        );

        callback();
    };

    video.addEventListener(
        "loadedmetadata",
        onLoadedMetadata
    );
}

/* =========================================================
   LÓGICA DE SINCRONIZACIÓN PARA EL VIEWER
   ========================================================= */

async function handleViewerSync(data) {

    if (!data || !video) return;

    /* =====================================================
       LOAD
       ===================================================== */

    if (data.type === "LOAD") {

        console.log(
            "Cargando video recibido:",
            data.path
        );

        showVideo();

        video.pause();

        video.src = data.path;

        video.load();

        waitForVideoReady(() => {

            if (typeof data.time === "number") {

                try {
                    video.currentTime = data.time;
                } catch (err) {

                    console.error(
                        "No se pudo establecer la posición:",
                        err
                    );

                }
            }

            console.log(
                "Video cargado correctamente en Viewer."
            );

        });

        return;
    }

    /* =====================================================
       PLAY
       ===================================================== */

    if (data.type === "PLAY") {

        waitForVideoReady(async () => {

            if (typeof data.time === "number") {

                try {
                    video.currentTime = data.time;
                } catch (err) {

                    console.error(
                        "Error estableciendo posición:",
                        err
                    );

                }
            }

            try {

                await video.play();

            } catch (e) {

                /*
                 * Los navegadores pueden bloquear
                 * autoplay con sonido.
                 *
                 * Intentamos reproducir silenciado.
                 */

                console.log(
                    "Autoplay bloqueado. Intentando silenciado..."
                );

                try {

                    video.muted = true;

                    await video.play();

                } catch (err) {

                    console.error(
                        "No se pudo reproducir el Viewer:",
                        err
                    );

                }
            }

        });

        return;
    }

    /* =====================================================
       PAUSE
       ===================================================== */

    if (data.type === "PAUSE") {

        waitForVideoReady(() => {

            if (typeof data.time === "number") {

                try {
                    video.currentTime = data.time;
                } catch (err) {

                    console.error(
                        "Error estableciendo posición:",
                        err
                    );

                }
            }

            video.pause();

        });

        return;
    }

    /* =====================================================
       SEEK
       ===================================================== */

    if (data.type === "SEEK") {

        waitForVideoReady(() => {

            if (typeof data.time === "number") {

                try {
                    video.currentTime = data.time;
                } catch (err) {

                    console.error(
                        "Error realizando SEEK:",
                        err
                    );

                }
            }

        });

        return;
    }

    /* =====================================================
       HEARTBEAT
       ===================================================== */

    if (data.type === "HEARTBEAT") {

        if (
            video.readyState <
            HTMLMediaElement.HAVE_METADATA
        ) {
            return;
        }

        const diff =
            data.time - video.currentTime;

        const absDiff =
            Math.abs(diff);

        /*
         * Diferencia grande:
         * corregimos directamente.
         */

        if (absDiff > 1.5) {

            try {
                video.currentTime = data.time;
            } catch (err) {

                console.error(
                    "Error sincronizando tiempo:",
                    err
                );

            }

        }

        /*
         * Diferencia pequeña:
         * ajustamos ligeramente la velocidad.
         */

        else if (absDiff > 0.35) {

            video.playbackRate =
                diff > 0 ? 1.05 : 0.95;

        }

        else {

            video.playbackRate = 1.0;

        }

        /* =================================================
           ESTADO PLAY / PAUSE
           ================================================= */

        if (
            data.playing &&
            video.paused
        ) {

            try {

                await video.play();

            } catch (err) {

                try {

                    video.muted = true;

                    await video.play();

                } catch (e) {

                    console.log(
                        "No se pudo iniciar Viewer automáticamente."
                    );

                }

            }

        }

        else if (
            !data.playing &&
            !video.paused
        ) {

            video.pause();

        }
    }
}

/* =========================================================
   CONTROL DE VOLUMEN VIEWER
   ========================================================= */

if (
    isViewer &&
    viewerVolume
) {

    viewerVolume.addEventListener(
        "input",
        () => {

            video.volume =
                Number(viewerVolume.value);

            if (video.volume > 0) {

                video.muted = false;

            }

        }
    );
}

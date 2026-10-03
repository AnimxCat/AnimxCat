const twitchChannel = "catsaac_";

const params = new URLSearchParams(window.location.search);

const isStreamer = params.get("streamer") === "1";
const isViewer = !isStreamer;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const video = document.getElementById("videoPlayer");
const emptyMessage = document.getElementById("emptyMessage");

const streamerControls =
    document.getElementById("streamerControls");

const urlInput =
    document.getElementById("urlInput");

const loadBtn =
    document.getElementById("loadBtn");

const chapterSelect =
    document.getElementById("chapterSelect");

const viewerVolumeControl =
    document.getElementById("viewerVolumeControl");

const viewerVolume =
    document.getElementById("viewerVolume");

const twitchStreamFrame =
    document.getElementById("twitchStreamFrame");

const twitchChatFrame =
    document.getElementById("twitchChatFrame");


/* =========================================================
   TWITCH
   ========================================================= */

const currentHost =
    window.location.hostname || "localhost";

if (twitchStreamFrame) {

    twitchStreamFrame.src =
        `https://player.twitch.tv/?channel=${twitchChannel}&parent=${currentHost}&theme=dark`;

}

if (twitchChatFrame) {

    twitchChatFrame.src =
        `https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${currentHost}&theme=dark`;

}


/* =========================================================
   VISTA STREAMER / VIEWER
   ========================================================= */

if (isViewer) {

    streamerControls.style.display = "none";

    video.controls = false;

    viewerVolumeControl.style.display = "flex";

} else {

    streamerControls.style.display = "flex";

    video.controls = true;

    viewerVolumeControl.style.display = "none";

}


/* =========================================================
   MOSTRAR VIDEO
   ========================================================= */

function showVideo() {

    emptyMessage.style.display = "none";

    video.style.display = "block";

}


/* =========================================================
   CARGAR PEERJS
   ========================================================= */

const peerScript =
    document.createElement("script");

peerScript.src =
    "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";

peerScript.onload = () => {

    console.log("PeerJS cargado correctamente.");

    startPeerConnection();

};

peerScript.onerror = () => {

    console.error(
        "No se pudo cargar PeerJS."
    );

};

document.head.appendChild(peerScript);


/* =========================================================
   PEERJS
   ========================================================= */

const ROOM_ID =
    "animxcat-stream-room-v3";

let peer = null;

let connections = [];

let streamerConnection = null;


/* =========================================================
   INICIAR PEER
   ========================================================= */

function startPeerConnection() {


    /* =====================================================
       STREAMER
       ===================================================== */

    if (isStreamer) {

        peer = new Peer(ROOM_ID);


        peer.on("open", (id) => {

            console.log(
                "Streamer conectado:",
                id
            );

        });


        peer.on("connection", (conn) => {

            console.log(
                "Viewer conectándose..."
            );


            connections.push(conn);


            conn.on("open", () => {

                console.log(
                    "Viewer conectado."
                );


                /*
                 * Si ya hay un video cargado,
                 * se lo enviamos al nuevo viewer.
                 */

                if (video.src) {

                    conn.send({

                        type: "LOAD",

                        path: video.src,

                        time: video.currentTime,

                        playing: !video.paused

                    });

                }

            });


            conn.on("close", () => {

                connections =
                    connections.filter(
                        c => c !== conn
                    );

            });


            conn.on("error", (error) => {

                console.error(
                    "Error con viewer:",
                    error
                );

            });

        });


        peer.on("error", (error) => {

            console.error(
                "Error PeerJS streamer:",
                error
            );

        });

    }


    /* =====================================================
       VIEWER
       ===================================================== */

    else {

        peer = new Peer();


        peer.on("open", () => {

            console.log(
                "Viewer listo."
            );


            connectToStreamer();

        });


        peer.on("error", (error) => {

            console.error(
                "Error PeerJS viewer:",
                error
            );

        });

    }

}


/* =========================================================
   CONECTAR VIEWER
   ========================================================= */

function connectToStreamer() {

    if (!peer) {
        return;
    }


    console.log(
        "Conectando al streamer..."
    );


    streamerConnection =
        peer.connect(ROOM_ID);


    streamerConnection.on("open", () => {

        console.log(
            "Viewer conectado al streamer."
        );

    });


    streamerConnection.on("data", (data) => {

        handleViewerData(data);

    });


    streamerConnection.on("close", () => {

        console.log(
            "Conexión cerrada. Reintentando..."
        );


        setTimeout(() => {

            connectToStreamer();

        }, 3000);

    });


    streamerConnection.on("error", (error) => {

        console.error(
            "Error de conexión:",
            error
        );

    });

}


/* =========================================================
   ENVIAR A TODOS LOS VIEWERS
   ========================================================= */

function broadcast(data) {

    connections.forEach((conn) => {

        if (conn && conn.open) {

            try {

                conn.send(data);

            } catch (error) {

                console.error(
                    "Error enviando:",
                    error
                );

            }

        }

    });

}


/* =========================================================
   CARGAR VIDEO
   ========================================================= */

function setVideoSource(
    path,
    notifyViewer = true
) {

    if (!path) {
        return;
    }


    console.log(
        "Cargando:",
        path
    );


    showVideo();


    video.pause();


    video.src = path;


    video.load();


    /*
     * Esperamos a que el video tenga
     * información suficiente para reproducirse.
     */

    video.addEventListener(
        "loadedmetadata",
        function playAfterLoad() {

            video.removeEventListener(
                "loadedmetadata",
                playAfterLoad
            );


            video.play().catch(() => {

                console.log(
                    "El navegador requiere interacción para reproducir."
                );

            });

        }
    );


    if (notifyViewer) {

        broadcast({

            type: "LOAD",

            path: path,

            time: 0,

            playing: true

        });

    }

}


/* =========================================================
   SELECTOR
   ========================================================= */

if (isStreamer && chapterSelect) {

    chapterSelect.addEventListener(
        "change",
        (event) => {

            const path =
                event.target.value;


            if (!path) {
                return;
            }


            setVideoSource(
                path,
                true
            );

        }
    );

}


/* =========================================================
   BOTÓN CARGAR
   ========================================================= */

if (isStreamer && loadBtn) {

    loadBtn.addEventListener(
        "click",
        () => {

            const path =
                urlInput.value.trim();


            if (!path) {
                return;
            }


            setVideoSource(
                path,
                true
            );


            urlInput.value = "";

        }
    );

}


/* =========================================================
   ENTER
   ========================================================= */

if (isStreamer && urlInput) {

    urlInput.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {

                loadBtn.click();

            }

        }
    );

}


/* =========================================================
   PLAY DEL STREAMER
   ========================================================= */

if (isStreamer) {

    video.addEventListener(
        "play",
        () => {

            broadcast({

                type: "PLAY",

                time: video.currentTime

            });

        }
    );


    /* =====================================================
       PAUSE
       ===================================================== */

    video.addEventListener(
        "pause",
        () => {

            broadcast({

                type: "PAUSE",

                time: video.currentTime

            });

        }
    );


    /* =====================================================
       SEEK
       ===================================================== */

    video.addEventListener(
        "seeked",
        () => {

            broadcast({

                type: "SEEK",

                time: video.currentTime

            });

        }
    );


    /* =====================================================
       HEARTBEAT
       ===================================================== */

    setInterval(() => {

        if (
            video.readyState <
            HTMLMediaElement.HAVE_METADATA
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
   DATOS DEL VIEWER
   ========================================================= */

async function handleViewerData(data) {

    if (!data) {
        return;
    }


    /* =====================================================
       LOAD
       ===================================================== */

    if (data.type === "LOAD") {

        showVideo();


        video.src = data.path;


        video.load();


        video.addEventListener(
            "loadedmetadata",
            function viewerLoad() {

                video.removeEventListener(
                    "loadedmetadata",
                    viewerLoad
                );


                if (
                    typeof data.time === "number"
                ) {

                    video.currentTime =
                        data.time;

                }


                if (data.playing) {

                    video.play().catch(() => {

                        /*
                         * Autoplay bloqueado.
                         * El viewer puede iniciar
                         * mediante interacción.
                         */

                    });

                }

            }
        );


        return;

    }


    /* =====================================================
       PLAY
       ===================================================== */

    if (data.type === "PLAY") {

        if (
            typeof data.time === "number"
        ) {

            video.currentTime =
                data.time;

        }


        video.play().catch(() => {});


        return;

    }


    /* =====================================================
       PAUSE
       ===================================================== */

    if (data.type === "PAUSE") {

        if (
            typeof data.time === "number"
        ) {

            video.currentTime =
                data.time;

        }


        video.pause();


        return;

    }


    /* =====================================================
       SEEK
       ===================================================== */

    if (data.type === "SEEK") {

        if (
            typeof data.time === "number"
        ) {

            video.currentTime =
                data.time;

        }


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


        const difference =
            data.time -
            video.currentTime;


        if (
            Math.abs(difference) > 1.5
        ) {

            video.currentTime =
                data.time;

        }


        if (
            data.playing &&
            video.paused
        ) {

            video.play().catch(() => {});

        }


        if (
            !data.playing &&
            !video.paused
        ) {

            video.pause();

        }

    }

}


/* =========================================================
   VOLUMEN VIEWER
   ========================================================= */

if (
    isViewer &&
    viewerVolume
) {

    viewerVolume.addEventListener(
        "input",
        () => {

            video.volume =
                Number(
                    viewerVolume.value
                );


            if (
                video.volume > 0
            ) {

                video.muted = false;

            }

        }
    );

}

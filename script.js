/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const twitchChannel = "theponchomx";
const twitchParent = "animxcat.github.io";

const params = new URLSearchParams(window.location.search);

const isStreamer = params.get("streamer") === "1";
const isViewer = !isStreamer;


/* =========================================================
   ELEMENTOS HTML
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

if (twitchStreamFrame) {

    twitchStreamFrame.src =
        `https://player.twitch.tv/?channel=${twitchChannel}&parent=${twitchParent}&theme=dark`;

}

if (twitchChatFrame) {

    twitchChatFrame.src =
        `https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${twitchParent}&theme=dark`;

}


/* =========================================================
   CONFIGURACIÓN DE VISTA
   ========================================================= */

if (isViewer) {

    if (streamerControls) {
        streamerControls.style.display = "none";
    }

    if (video) {
        video.controls = false;
    }

    if (viewerVolumeControl) {
        viewerVolumeControl.style.display = "flex";
    }

} else {

    if (streamerControls) {
        streamerControls.style.display = "flex";
    }

    if (video) {
        video.controls = true;
    }

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
   PEERJS
   ========================================================= */

const peerScript =
    document.createElement("script");

peerScript.src =
    "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";

peerScript.onload = () => {

    console.log("PeerJS cargado correctamente.");

    startPeer();

};

peerScript.onerror = () => {

    console.error(
        "No se pudo cargar PeerJS."
    );

};

document.head.appendChild(peerScript);


/* =========================================================
   SALA
   ========================================================= */

const ROOM_ID =
    "animxcat-stream-room-v3";


let peer = null;

let connections = [];

let streamerConn = null;


/* =========================================================
   BROADCAST
   ========================================================= */

function broadcast(data) {

    connections.forEach((conn) => {

        if (conn && conn.open) {

            try {

                conn.send(data);

            } catch (error) {

                console.error(
                    "Error enviando datos:",
                    error
                );

            }

        }

    });

}


/* =========================================================
   INICIAR PEER
   ========================================================= */

function startPeer() {


    /* =====================================================
       STREAMER
       ===================================================== */

    if (isStreamer) {

        peer = new Peer(ROOM_ID);


        peer.on("open", (id) => {

            console.log(
                "Streamer listo. Sala:",
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
                    "Viewer conectado correctamente."
                );


                /*
                 * Si el streamer ya tiene un video,
                 * se lo mandamos al nuevo viewer.
                 */

                if (
                    video &&
                    video.src
                ) {

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

            if (
                error.type === "unavailable-id"
            ) {

                console.warn(
                    "La sala ya está ocupada. Cierra otra pestaña del streamer."
                );

            }

        });

    }


    /* =====================================================
       VIEWER
       ===================================================== */

    else {

        peer = new Peer();


        peer.on("open", () => {

            console.log(
                "Viewer listo. Conectando..."
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
   CONECTAR VIEWER AL STREAMER
   ========================================================= */

function connectToStreamer() {

    if (!peer) {
        return;
    }


    if (
        streamerConn &&
        streamerConn.open
    ) {

        return;

    }


    console.log(
        "Conectando al streamer..."
    );


    streamerConn =
        peer.connect(ROOM_ID);


    streamerConn.on("open", () => {

        console.log(
            "Viewer conectado al streamer."
        );

    });


    streamerConn.on("data", (data) => {

        handleViewerSync(data);

    });


    streamerConn.on("close", () => {

        console.log(
            "Conexión perdida. Reintentando..."
        );


        streamerConn = null;


        setTimeout(() => {

            connectToStreamer();

        }, 3000);

    });


    streamerConn.on("error", (error) => {

        console.error(
            "Error de conexión:",
            error
        );

    });

}


/* =========================================================
   CARGAR VIDEO EN STREAMER
   ========================================================= */

function setVideoSource(
    filePath,
    notifyViewer = false
) {

    if (
        !filePath ||
        !video
    ) {

        return;

    }


    console.log(
        "Cargando video:",
        filePath
    );


    showVideo();


    video.pause();


    video.src =
        filePath;


    video.load();


    /*
     * Esperar a que el video tenga metadatos
     * antes de intentar reproducir.
     */

    const playWhenReady =
        () => {

            video.removeEventListener(
                "loadedmetadata",
                playWhenReady
            );


            video.play().catch(() => {

                console.log(
                    "El navegador bloqueó el autoplay."
                );

            });

        };


    video.addEventListener(
        "loadedmetadata",
        playWhenReady
    );


    if (notifyViewer) {

        broadcast({

            type: "LOAD",

            path: filePath,

            time: 0,

            playing: true

        });

    }

}


/* =========================================================
   SELECTOR DE VIDEOS
   ========================================================= */

if (
    isStreamer &&
    chapterSelect
) {

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
   BOTÓN CARGAR VIDEO
   ========================================================= */

if (
    isStreamer &&
    loadBtn
) {

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
   ENTER EN EL INPUT
   ========================================================= */

if (
    isStreamer &&
    urlInput
) {

    urlInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                if (loadBtn) {
                    loadBtn.click();
                }

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

                time:
                    video.currentTime

            });

        }
    );


    /* =====================================================
       PAUSE DEL STREAMER
       ===================================================== */

    video.addEventListener(
        "pause",
        () => {

            broadcast({

                type: "PAUSE",

                time:
                    video.currentTime

            });

        }
    );


    /* =====================================================
       SEEK DEL STREAMER
       ===================================================== */

    video.addEventListener(
        "seeked",
        () => {

            broadcast({

                type: "SEEK",

                time:
                    video.currentTime

            });

        }
    );


    /* =====================================================
       HEARTBEAT
       ===================================================== */

    setInterval(
        () => {

            if (
                !video ||
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {

                return;

            }


            broadcast({

                type: "HEARTBEAT",

                time:
                    video.currentTime,

                playing:
                    !video.paused

            });

        },
        1000
    );

}


/* =========================================================
   SINCRONIZACIÓN DEL VIEWER
   ========================================================= */

async function handleViewerSync(data) {

    if (
        !data ||
        !video
    ) {

        return;

    }


    /* =====================================================
       LOAD
       ===================================================== */

    if (
        data.type === "LOAD"
    ) {

        showVideo();


        video.pause();


        video.src =
            data.path;


        video.load();


        const loadAndPlay =
            () => {

                video.removeEventListener(
                    "loadedmetadata",
                    loadAndPlay
                );


                if (
                    typeof data.time === "number"
                ) {

                    try {

                        video.currentTime =
                            data.time;

                    } catch (error) {}

                }


                if (
                    data.playing
                ) {

                    playVideoSafely();

                }

            };


        video.addEventListener(
            "loadedmetadata",
            loadAndPlay
        );


        return;

    }


    /* =====================================================
       PLAY
       ===================================================== */

    if (
        data.type === "PLAY"
    ) {

        if (
            typeof data.time === "number"
        ) {

            try {

                video.currentTime =
                    data.time;

            } catch (error) {}

        }


        playVideoSafely();


        return;

    }


    /* =====================================================
       PAUSE
       ===================================================== */

    if (
        data.type === "PAUSE"
    ) {

        if (
            typeof data.time === "number"
        ) {

            try {

                video.currentTime =
                    data.time;

            } catch (error) {}

        }


        video.pause();


        return;

    }


    /* =====================================================
       SEEK
       ===================================================== */

    if (
        data.type === "SEEK"
    ) {

        if (
            typeof data.time === "number"
        ) {

            try {

                video.currentTime =
                    data.time;

            } catch (error) {}

        }


        return;

    }


    /* =====================================================
       HEARTBEAT
       ===================================================== */

    if (
        data.type === "HEARTBEAT"
    ) {

        if (
            video.readyState <
            HTMLMediaElement.HAVE_METADATA
        ) {

            return;

        }


        const difference =
            data.time -
            video.currentTime;


        const absoluteDifference =
            Math.abs(difference);


        /*
         * Diferencia grande:
         * corregir directamente.
         */

        if (
            absoluteDifference > 1.5
        ) {

            try {

                video.currentTime =
                    data.time;

            } catch (error) {}

        }


        /*
         * El streamer reproduce.
         */

        if (
            data.playing &&
            video.paused
        ) {

            playVideoSafely();

        }


        /*
         * El streamer pausa.
         */

        else if (
            !data.playing &&
            !video.paused
        ) {

            video.pause();

        }

    }

}


/* =========================================================
   REPRODUCCIÓN SEGURA
   ========================================================= */

async function playVideoSafely() {

    if (!video) {
        return;
    }


    try {

        await video.play();

    } catch (error) {

        /*
         * Si el navegador bloquea autoplay,
         * intentamos silenciar.
         */

        try {

            video.muted = true;

            await video.play();

        } catch (secondError) {

            console.log(
                "El navegador bloqueó la reproducción automática."
            );

        }

    }

}


/* =========================================================
   VOLUMEN DEL VIEWER
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

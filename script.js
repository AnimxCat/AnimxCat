/* =========================================================
   CONFIGURACIÓN Y DETECCIÓN
   ========================================================= */

const twitchChannel = "catsaac_";
const twitchParent = "animxcat.github.io";

const params = new URLSearchParams(window.location.search);

const isStreamer =
    params.get("streamer") === "1";

const isViewer =
    !isStreamer;


/* =========================================================
   ELEMENTOS HTML
   ========================================================= */

const video =
    document.getElementById("videoPlayer");

const emptyMessage =
    document.getElementById("emptyMessage");

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

        streamerControls.style.display =
            "none";
    }

    video.controls = false;


    if (viewerVolumeControl) {

        viewerVolumeControl.style.display =
            "flex";
    }

} else {

    if (streamerControls) {

        streamerControls.style.display =
            "flex";
    }

    video.controls = true;


    if (viewerVolumeControl) {

        viewerVolumeControl.style.display =
            "none";
    }
}


/* =========================================================
   MOSTRAR VIDEO
   ========================================================= */

function showVideo() {

    if (emptyMessage) {

        emptyMessage.style.display =
            "none";
    }

    if (video) {

        video.style.display =
            "block";
    }
}


/* =========================================================
   PEERJS
   ========================================================= */

const ROOM_ID =
    "animxcat-stream-room-v3";


let peer = null;

let connections = [];

let streamerConn = null;


/* =========================================================
   CARGAR PEERJS
   ========================================================= */

const peerScript =
    document.createElement("script");

peerScript.src =
    "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";


peerScript.onload = () => {

    console.log(
        "✅ PeerJS cargado correctamente."
    );

    startPeer();
};


peerScript.onerror = () => {

    console.error(
        "❌ No se pudo cargar PeerJS."
    );
};


document.head.appendChild(
    peerScript
);


/* =========================================================
   INICIAR PEER
   ========================================================= */

function startPeer() {

    if (!window.Peer) {

        console.error(
            "❌ PeerJS no está disponible."
        );

        return;
    }


    if (isStreamer) {

        startStreamer();

    } else {

        startViewer();
    }
}


/* =========================================================
   ENVIAR DATOS A TODOS LOS VIEWERS
   ========================================================= */

function broadcast(data) {

    connections.forEach(conn => {

        if (conn && conn.open) {

            conn.send(data);
        }

    });
}


/* =========================================================
   STREAMER
   ========================================================= */

function startStreamer() {

    peer =
        new Peer(ROOM_ID);


    peer.on("open", (id) => {

        console.log(
            "✅ Streamer activo. ID:",
            id
        );

    });


    peer.on("connection", (conn) => {

        console.log(
            "🔗 Viewer conectado."
        );


        connections.push(conn);


        /*
         * Si ya hay un video reproduciéndose,
         * mandarlo inmediatamente al nuevo viewer.
         */

        if (video && video.src) {

            conn.on("open", () => {

                conn.send({

                    type: "LOAD",

                    path: video.src,

                    time:
                        video.currentTime,

                    playing:
                        !video.paused

                });

            });
        }


        conn.on("close", () => {

            connections =
                connections.filter(
                    c => c !== conn
                );

        });

    });


    peer.on("error", (err) => {

        console.error(
            "❌ Error de conexión en Streamer:",
            err
        );


        if (
            err.type ===
            "unavailable-id"
        ) {

            console.warn(
                "⚠️ La sala ya está ocupada por otra pestaña."
            );
        }

    });

}


/* =========================================================
   VIEWER
   ========================================================= */

function startViewer() {

    peer =
        new Peer();


    peer.on("open", () => {

        console.log(
            "📡 Conectando con el Streamer..."
        );

        connectToStreamer();

    });


    function connectToStreamer() {

        streamerConn =
            peer.connect(ROOM_ID);


        streamerConn.on("open", () => {

            console.log(
                "✅ Conectado al Streamer."
            );

        });


        streamerConn.on("data", (data) => {

            handleViewerSync(data);

        });


        streamerConn.on("close", () => {

            console.warn(
                "⚠️ Se perdió la conexión con el Streamer."
            );


            setTimeout(
                connectToStreamer,
                3000
            );

        });

    }


    peer.on("error", (err) => {

        console.error(
            "❌ Error en Viewer:",
            err
        );

    });

}


/* =========================================================
   CAMBIAR VIDEO
   ========================================================= */

function setVideoSource(
    filePath,
    notifyViewer = false
) {

    if (!filePath || !video) {

        return;
    }


    showVideo();


    video.src =
        filePath;


    video.load();


    video.play()
        .catch(() => {});


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
   CONTROLES DEL STREAMER
   ========================================================= */

if (isStreamer) {


    /* -------------------------
       CAPÍTULOS
       ------------------------- */

    if (chapterSelect) {

        chapterSelect.addEventListener(
            "change",
            (e) => {

                if (e.target.value) {

                    setVideoSource(
                        e.target.value,
                        true
                    );

                }

            }
        );

    }


    /* -------------------------
       CARGAR URL
       ------------------------- */

    if (loadBtn) {

        loadBtn.addEventListener(
            "click",
            () => {

                const path =
                    urlInput.value.trim();


                if (path) {

                    setVideoSource(
                        path,
                        true
                    );


                    urlInput.value =
                        "";

                }

            }
        );

    }


    /* -------------------------
       ENTER EN URL
       ------------------------- */

    if (urlInput) {

        urlInput.addEventListener(
            "keydown",
            (e) => {

                if (
                    e.key === "Enter" &&
                    loadBtn
                ) {

                    loadBtn.click();

                }

            }
        );

    }


    /* -------------------------
       PLAY
       ------------------------- */

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


    /* -------------------------
       PAUSE
       ------------------------- */

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


    /* -------------------------
       SEEK
       ------------------------- */

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


    /* -------------------------
       HEARTBEAT
       ------------------------- */

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

    if (!data || !video) {

        return;
    }


    /* -------------------------
       CARGAR VIDEO
       ------------------------- */

    if (data.type === "LOAD") {

        video.src =
            data.path;

        video.load();

        showVideo();


        if (data.playing) {

            playVideoSafely();

        }

        return;
    }


    /* -------------------------
       PLAY
       ------------------------- */

    if (data.type === "PLAY") {

        if (
            typeof data.time ===
            "number"
        ) {

            video.currentTime =
                data.time;

        }


        playVideoSafely();

        return;
    }


    /* -------------------------
       PAUSE
       ------------------------- */

    if (data.type === "PAUSE") {

        if (
            typeof data.time ===
            "number"
        ) {

            video.currentTime =
                data.time;

        }


        video.pause();

        return;
    }


    /* -------------------------
       SEEK
       ------------------------- */

    if (data.type === "SEEK") {

        if (
            typeof data.time ===
            "number"
        ) {

            video.currentTime =
                data.time;

        }

        return;
    }


    /* -------------------------
       HEARTBEAT
       ------------------------- */

    if (data.type === "HEARTBEAT") {

        if (
            video.readyState <
            HTMLMediaElement.HAVE_METADATA
        ) {

            return;
        }


        const diff =
            data.time -
            video.currentTime;


        if (
            Math.abs(diff) > 1.5
        ) {

            video.currentTime =
                data.time;

        }


        if (
            data.playing &&
            video.paused
        ) {

            playVideoSafely();

        } else if (
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

    try {

        await video.play();

    } catch (e) {

        /*
         * Algunos celulares bloquean
         * autoplay con sonido.
         */

        video.muted =
            true;


        await video.play()
            .catch(() => {});

    }

}


/* =========================================================
   CONTROL DE VOLUMEN DEL VIEWER
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

                video.muted =
                    false;

            }

        }
    );

}

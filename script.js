/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const twitchChannel = "catsaac_";


/* =========================================================
   STREAMER / VIEWER
   ========================================================= */

const params = new URLSearchParams(
    window.location.search
);

const isViewer =
    params.get("streamer") !== "1";

const isStreamer =
    !isViewer;


/* =========================================================
   ELEMENTOS
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
   CANAL ENTRE STREAMER Y VIEWER
   ========================================================= */

const channel =
    new BroadcastChannel(
        "anime-stream-sync"
    );


/* =========================================================
   CONFIGURAR STREAMER / VIEWER
   ========================================================= */

if (isViewer) {

    /*
     * Viewer:
     * No muestra los controles del Streamer.
     */

    if (streamerControls) {

        streamerControls.style.display =
            "none";

    }

    /*
     * El Viewer no tiene controles nativos.
     * Solamente tendrá nuestro control de volumen.
     */

    video.controls = false;

    /*
     * El control de volumen sí se muestra.
     */

    if (viewerVolumeControl) {

        viewerVolumeControl.style.display =
            "flex";

    }

} else {

    /*
     * Streamer:
     * Muestra sus controles normales.
     */

    if (streamerControls) {

        streamerControls.style.display =
            "flex";

    }

    video.controls = true;

    /*
     * El Streamer no necesita control de volumen
     * adicional.
     */

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
   CARGAR VIDEO
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


    /*
     * Si el Streamer carga un capítulo,
     * avisamos inmediatamente al Viewer.
     */

    if (notifyViewer) {

        channel.postMessage({

            type: "LOAD",

            path: filePath,

            time: 0

        });

    }

}


/* =========================================================
   STREAMER:
   CARGAR CAPÍTULO DESDE SELECT
   ========================================================= */

if (isStreamer && chapterSelect) {

    chapterSelect.addEventListener(
        "change",
        function (event) {

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
   STREAMER:
   CARGAR VIDEO DESDE INPUT
   ========================================================= */

if (isStreamer && loadBtn) {

    loadBtn.addEventListener(
        "click",
        function () {

            let path =
                urlInput.value.trim();

            if (!path) {

                return;

            }

            if (
                !path.startsWith("videos/")
            ) {

                path =
                    "videos/" + path;

            }

            setVideoSource(
                path,
                true
            );

            urlInput.value =
                "";

        }
    );

}


/* =========================================================
   ENTER EN INPUT
   ========================================================= */

if (isStreamer && urlInput) {

    urlInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key !== "Enter") {

                return;

            }

            if (loadBtn) {

                loadBtn.click();

            }

        }
    );

}


/* =========================================================
   STREAMER:
   PLAY
   ========================================================= */

if (isStreamer) {

    video.addEventListener(
        "play",
        function () {

            channel.postMessage({

                type: "PLAY",

                time:
                    video.currentTime

            });

        }
    );

}


/* =========================================================
   STREAMER:
   PAUSE
   ========================================================= */

if (isStreamer) {

    video.addEventListener(
        "pause",
        function () {

            channel.postMessage({

                type: "PAUSE",

                time:
                    video.currentTime

            });

        }
    );

}


/* =========================================================
   STREAMER:
   SEEK / ADELANTAR / RETROCEDER
   ========================================================= */

if (isStreamer) {

    video.addEventListener(
        "seeked",
        function () {

            channel.postMessage({

                type: "SEEK",

                time:
                    video.currentTime

            });

        }
    );

}


/* =========================================================
   VIEWER:
   RECIBIR MENSAJES
   ========================================================= */

if (isViewer) {

    channel.addEventListener(
        "message",
        async function (event) {

            const data =
                event.data;

            if (!data) {

                return;

            }


            /* -----------------------------------------
               CARGAR CAPÍTULO
               ----------------------------------------- */

            if (data.type === "LOAD") {

                video.src =
                    data.path;

                video.load();

                showVideo();

                return;

            }


            /* -----------------------------------------
               PLAY
               ----------------------------------------- */

            if (data.type === "PLAY") {

                if (
                    typeof data.time ===
                    "number"
                ) {

                    video.currentTime =
                        data.time;

                }

                try {

                    await video.play();

                }
                catch (error) {

                    /*
                     * Si el navegador bloquea
                     * el autoplay con sonido,
                     * lo reproducimos silenciado.
                     */

                    video.muted =
                        true;

                    try {

                        await video.play();

                    }
                    catch (error2) {

                        console.log(
                            "El navegador bloqueó la reproducción automática.",
                            error2
                        );

                    }

                }

                return;

            }


            /* -----------------------------------------
               PAUSE
               ----------------------------------------- */

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


            /* -----------------------------------------
               SEEK
               ----------------------------------------- */

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

        }
    );

}


/* =========================================================
   SINCRONIZACIÓN CONTINUA
   ========================================================= */

/*
 * El Streamer manda su posición cada 500 ms.
 * Esto solamente corrige pequeñas diferencias
 * entre ambos videos.
 */

if (isStreamer) {

    setInterval(
        function () {

            if (!video) {

                return;

            }

            if (
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {

                return;

            }

            channel.postMessage({

                type: "HEARTBEAT",

                time:
                    video.currentTime,

                playing:
                    !video.paused

            });

        },
        500
    );

}


/* =========================================================
   VIEWER:
   CORREGIR DESFASE
   ========================================================= */

if (isViewer) {

    channel.addEventListener(
        "message",
        async function (event) {

            const data =
                event.data;

            if (
                !data ||
                data.type !==
                "HEARTBEAT"
            ) {

                return;

            }

            if (!video) {

                return;

            }

            if (
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {

                return;

            }

            if (
                typeof data.time !==
                "number"
            ) {

                return;

            }


            const difference =
                data.time -
                video.currentTime;

            const absoluteDifference =
                Math.abs(
                    difference
                );


            /*
             * Si hay más de 1 segundo
             * de diferencia, corregimos
             * directamente.
             */

            if (
                absoluteDifference >
                1
            ) {

                video.currentTime =
                    data.time;

            }


            /*
             * Si la diferencia es pequeña,
             * aceleramos o ralentizamos
             * ligeramente para alcanzar
             * al Streamer.
             */

            else if (
                absoluteDifference >
                0.30
            ) {

                if (difference > 0) {

                    video.playbackRate =
                        1.05;

                } else {

                    video.playbackRate =
                        0.95;

                }

            }


            /*
             * Ya están prácticamente
             * sincronizados.
             */

            else {

                video.playbackRate =
                    1.0;

            }


            /*
             * Si Streamer está reproduciendo,
             * Viewer debe reproducir.
             */

            if (
                data.playing &&
                video.paused
            ) {

                try {

                    await video.play();

                }
                catch (error) {

                    console.log(
                        "No se pudo iniciar automáticamente el Viewer.",
                        error
                    );

                }

            }


            /*
             * Si Streamer está pausado,
             * Viewer también.
             */

            if (
                !data.playing &&
                !video.paused
            ) {

                video.pause();

            }

        }
    );

}


/* =========================================================
   CONTROL DE VOLUMEN DEL VIEWER
   ========================================================= */

if (isViewer && viewerVolume) {

    viewerVolume.addEventListener(
        "input",
        function () {

            video.volume =
                Number(
                    viewerVolume.value
                );

            /*
             * Si el usuario sube el volumen,
             * quitamos mute.
             */

            if (
                video.volume > 0
            ) {

                video.muted =
                    false;

            }

        }
    );

}

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const twitchChannel = "catsaac_";

const STREAMER_PEER_ID = "animxcat-stream-room-v1";
const PEERJS_URL = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";


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
   INTERFAZ
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
   VIDEO
   ========================================================= */

function showVideo() {

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }

    if (video) {
        video.style.display = "block";
    }
}


function waitForMetadata() {

    return new Promise((resolve, reject) => {

        if (!video) {
            reject(new Error("Video element no encontrado."));
            return;
        }

        if (
            video.readyState >=
            HTMLMediaElement.HAVE_METADATA
        ) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => {

            cleanup();

            reject(
                new Error(
                    "El video tardó demasiado en cargar sus metadatos."
                )
            );

        }, 30000);


        function loaded() {

            cleanup();
            resolve();

        }


        function failed() {

            cleanup();

            reject(
                new Error(
                    "El navegador no pudo cargar el video."
                )
            );

        }


        function cleanup() {

            clearTimeout(timeout);

            video.removeEventListener(
                "loadedmetadata",
                loaded
            );

            video.removeEventListener(
                "error",
                failed
            );
        }


        video.addEventListener(
            "loadedmetadata",
            loaded,
            { once: true }
        );

        video.addEventListener(
            "error",
            failed,
            { once: true }
        );
    });
}


/* =========================================================
   PEERJS
   ========================================================= */

let peer = null;

let streamerConnections = [];

let streamerConnection = null;

let reconnectTimer = null;

let peerReady = false;


/* =========================================================
   ESTADO DEL STREAMER
   ========================================================= */

let masterState = {

    path: "",

    time: 0,

    playing: false

};


/* =========================================================
   ESTADO DEL VIEWER
   ========================================================= */

let viewerLoading = false;

let viewerCommand = 0;


/* =========================================================
   CARGAR PEERJS
   ========================================================= */

function loadPeerJS() {

    return new Promise((resolve, reject) => {

        if (window.Peer) {
            resolve();
            return;
        }


        const existing =
            document.querySelector(
                'script[data-peerjs="true"]'
            );

        if (existing) {

            existing.addEventListener(
                "load",
                resolve,
                { once: true }
            );

            existing.addEventListener(
                "error",
                reject,
                { once: true }
            );

            return;
        }


        const script =
            document.createElement("script");

        script.src = PEERJS_URL;

        script.dataset.peerjs = "true";

        script.onload = resolve;

        script.onerror = () => {
            reject(
                new Error(
                    "No se pudo cargar PeerJS."
                )
            );
        };

        document.head.appendChild(script);
    });
}


/* =========================================================
   ENVÍO SEGURO
   ========================================================= */

function sendConnection(connection, data) {

    if (!connection) {
        return false;
    }

    if (!connection.open) {
        return false;
    }

    try {

        connection.send(data);

        return true;

    } catch (error) {

        console.error(
            "Error enviando datos:",
            error
        );

        return false;
    }
}


/* =========================================================
   BROADCAST STREAMER
   ========================================================= */

function broadcast(data) {

    if (!isStreamer) {
        return;
    }

    streamerConnections =
        streamerConnections.filter(
            connection => {

                if (!connection) {
                    return false;
                }

                if (connection.open) {

                    try {

                        connection.send(data);

                        return true;

                    } catch (error) {

                        console.error(
                            "Error enviando a Viewer:",
                            error
                        );

                        return false;
                    }
                }

                return true;
            }
        );
}


/* =========================================================
   ESTADO COMPLETO
   ========================================================= */

function getMasterState() {

    return {

        type: "STATE",

        path: masterState.path,

        time:
            video && !isNaN(video.currentTime)
                ? video.currentTime
                : masterState.time,

        playing:
            video
                ? !video.paused
                : masterState.playing
    };
}


function sendCurrentState(connection) {

    if (!connection || !connection.open) {
        return;
    }

    sendConnection(
        connection,
        getMasterState()
    );
}


/* =========================================================
   STREAMER
   ========================================================= */

function startStreamer() {

    console.log(
        "Iniciando STREAMER..."
    );


    peer = new Peer(
        STREAMER_PEER_ID,
        {
            debug: 1
        }
    );


    peer.on("open", id => {

        peerReady = true;

        console.log(
            "STREAMER conectado a PeerJS:",
            id
        );

    });


    peer.on("connection", connection => {

        console.log(
            "Nuevo VIEWER conectado."
        );


        function registerConnection() {

            if (
                !streamerConnections.includes(
                    connection
                )
            ) {

                streamerConnections.push(
                    connection
                );
            }


            console.log(
                "Conexión VIEWER abierta."
            );


            /*
             * MUY IMPORTANTE:
             * solamente enviamos datos después
             * de que connection.open sea true.
             */

            sendCurrentState(connection);
        }


        if (connection.open) {

            registerConnection();

        } else {

            connection.on(
                "open",
                registerConnection
            );
        }


        connection.on(
            "data",
            data => {

                if (!data) {
                    return;
                }


                if (
                    data.type ===
                    "REQUEST_STATE"
                ) {

                    console.log(
                        "Viewer solicitó estado."
                    );

                    sendCurrentState(
                        connection
                    );
                }
            }
        );


        connection.on(
            "close",
            () => {

                streamerConnections =
                    streamerConnections.filter(
                        c => c !== connection
                    );

                console.log(
                    "Viewer desconectado."
                );
            }
        );


        connection.on(
            "error",
            error => {

                console.error(
                    "Error de conexión Viewer:",
                    error
                );
            }
        );
    });


    peer.on(
        "error",
        error => {

            console.error(
                "Error PeerJS STREAMER:",
                error
            );

            /*
             * Si el ID ya está ocupado,
             * normalmente existe otra ventana
             * de streamer abierta.
             */

            if (
                error.type ===
                "unavailable-id"
            ) {

                console.error(
                    "El ID del streamer ya está ocupado. Cierra cualquier otra ventana de STREAMER."
                );
            }
        }
    );


    peer.on(
        "disconnected",
        () => {

            peerReady = false;

            console.warn(
                "Streamer desconectado de PeerJS. Intentando reconectar..."
            );

            try {
                peer.reconnect();
            } catch (error) {
                console.error(error);
            }
        }
    );
}


/* =========================================================
   VIEWER
   ========================================================= */

function startViewerPeer() {

    console.log(
        "Iniciando VIEWER..."
    );


    peer = new Peer(
        undefined,
        {
            debug: 1
        }
    );


    peer.on(
        "open",
        () => {

            peerReady = true;

            console.log(
                "VIEWER conectado a PeerJS."
            );

            connectViewerToStreamer();
        }
    );


    peer.on(
        "error",
        error => {

            console.error(
                "Error PeerJS VIEWER:",
                error
            );

            scheduleViewerReconnect();
        }
    );


    peer.on(
        "disconnected",
        () => {

            peerReady = false;

            console.warn(
                "VIEWER perdió conexión con PeerJS."
            );

            try {
                peer.reconnect();
            } catch (error) {
                console.error(error);
            }
        }
    );
}


/* =========================================================
   CONECTAR VIEWER AL STREAMER
   ========================================================= */

function connectViewerToStreamer() {

    if (!isViewer) {
        return;
    }

    if (!peer) {
        return;
    }

    if (!peer.open) {
        return;
    }


    if (
        streamerConnection &&
        streamerConnection.open
    ) {
        return;
    }


    console.log(
        "Intentando conectar al STREAMER..."
    );


    const connection =
        peer.connect(
            STREAMER_PEER_ID,
            {
                reliable: true
            }
        );


    streamerConnection =
        connection;


    connection.on(
        "open",
        () => {

            console.log(
                "VIEWER conectado al STREAMER."
            );


            sendConnection(
                connection,
                {
                    type: "REQUEST_STATE"
                }
            );
        }
    );


    connection.on(
        "data",
        data => {

            handleViewerSync(data);
        }
    );


    connection.on(
        "close",
        () => {

            console.warn(
                "Conexión con STREAMER cerrada."
            );

            streamerConnection = null;

            scheduleViewerReconnect();
        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "Error conexión STREAMER:",
                error
            );

            streamerConnection = null;

            scheduleViewerReconnect();
        }
    );
}


/* =========================================================
   RECONEXIÓN VIEWER
   ========================================================= */

function scheduleViewerReconnect() {

    if (!isViewer) {
        return;
    }


    if (reconnectTimer) {
        return;
    }


    reconnectTimer = setTimeout(
        () => {

            reconnectTimer = null;

            connectViewerToStreamer();

        },
        2000
    );
}


/* =========================================================
   CAMBIAR VIDEO EN STREAMER
   ========================================================= */

async function setVideoSource(
    filePath
) {

    if (
        !isStreamer ||
        !video ||
        !filePath
    ) {
        return;
    }


    const cleanPath =
        filePath.trim();


    console.log(
        "Cargando video:",
        cleanPath
    );


    /*
     * Guardamos EXACTAMENTE la URL original.
     * No usamos video.currentSrc porque GitHub
     * puede redirigir el archivo a otro servidor.
     */

    masterState.path =
        cleanPath;

    masterState.time = 0;

    masterState.playing = false;


    showVideo();


    video.pause();

    video.removeAttribute("src");

    video.load();


    video.src =
        cleanPath;

    video.load();


    /*
     * Primero avisamos que existe un nuevo video.
     */

    broadcast({

        type: "LOAD",

        path: cleanPath,

        time: 0

    });


    try {

        await waitForMetadata();

        console.log(
            "Metadatos del video cargados."
        );


        /*
         * Intentamos iniciar automáticamente
         * en el STREAMER.
         */

        try {

            await video.play();

        } catch (error) {

            console.log(
                "Autoplay bloqueado en Streamer. Esperando Play manual."
            );
        }

    } catch (error) {

        console.error(
            "No se pudo cargar el video:",
            error
        );
    }
}


/* =========================================================
   EVENTOS DEL STREAMER
   ========================================================= */

if (isStreamer) {


    /*
     * Selección de capítulo
     */

    if (chapterSelect) {

        chapterSelect.addEventListener(
            "change",
            event => {

                const path =
                    event.target.value;

                if (path) {
                    setVideoSource(path);
                }
            }
        );
    }


    /*
     * Botón Cargar Video
     */

    if (loadBtn) {

        loadBtn.addEventListener(
            "click",
            () => {

                const path =
                    urlInput.value.trim();

                if (!path) {
                    return;
                }

                setVideoSource(path);

                urlInput.value = "";
            }
        );
    }


    /*
     * ENTER en la caja URL
     */

    if (urlInput) {

        urlInput.addEventListener(
            "keydown",
            event => {

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


    /*
     * PLAY
     */

    video.addEventListener(
        "play",
        () => {

            masterState.playing =
                true;

            masterState.time =
                video.currentTime;


            broadcast({

                type: "PLAY",

                time:
                    video.currentTime

            });
        }
    );


    /*
     * PAUSE
     */

    video.addEventListener(
        "pause",
        () => {

            masterState.playing =
                false;

            masterState.time =
                video.currentTime;


            broadcast({

                type: "PAUSE",

                time:
                    video.currentTime

            });
        }
    );


    /*
     * SEEK
     */

    video.addEventListener(
        "seeked",
        () => {

            masterState.time =
                video.currentTime;


            broadcast({

                type: "SEEK",

                time:
                    video.currentTime

            });
        }
    );


    /*
     * HEARTBEAT
     *
     * Cada segundo manda la posición real.
     */

    setInterval(
        () => {

            if (
                !video ||
                !masterState.path
            ) {
                return;
            }


            if (
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {
                return;
            }


            masterState.time =
                video.currentTime;

            masterState.playing =
                !video.paused;


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
   CARGAR VIDEO EN VIEWER
   ========================================================= */

async function loadViewerVideo(
    path,
    time = 0,
    shouldPlay = false
) {

    if (
        !isViewer ||
        !video ||
        !path
    ) {
        return;
    }


    const command =
        ++viewerCommand;


    viewerLoading = true;

    showVideo();


    /*
     * Si ya es el mismo video,
     * no lo descargamos nuevamente.
     */

    const sameVideo =
        video.src === path ||
        video.currentSrc === path;


    if (!sameVideo) {

        video.pause();

        video.src = path;

        video.load();
    }


    try {

        await waitForMetadata();


        /*
         * Si llegó otro comando mientras
         * cargábamos este video, abandonamos
         * este comando.
         */

        if (
            command !== viewerCommand
        ) {
            return;
        }


        if (
            typeof time === "number" &&
            isFinite(time)
        ) {

            try {

                video.currentTime =
                    Math.max(
                        0,
                        time
                    );

            } catch (error) {

                console.warn(
                    "No se pudo establecer currentTime:",
                    error
                );
            }
        }


        if (shouldPlay) {

            try {

                await video.play();

            } catch (error) {

                /*
                 * Chrome puede bloquear autoplay
                 * con sonido.
                 *
                 * Reintentamos silenciado.
                 */

                console.warn(
                    "Autoplay bloqueado. Reintentando silenciado."
                );


                video.muted = true;


                try {

                    await video.play();

                } catch (secondError) {

                    console.warn(
                        "El navegador también bloqueó la reproducción silenciada.",
                        secondError
                    );
                }
            }
        }

    } catch (error) {

        console.error(
            "Viewer no pudo cargar:",
            error
        );

    } finally {

        viewerLoading = false;
    }
}


/* =========================================================
   SINCRONIZACIÓN VIEWER
   ========================================================= */

async function handleViewerSync(data) {

    if (
        !data ||
        !video
    ) {
        return;
    }


    /* -----------------------------------------------------
       ESTADO COMPLETO
       ----------------------------------------------------- */

    if (
        data.type === "STATE"
    ) {

        console.log(
            "Estado recibido:",
            data
        );


        if (!data.path) {
            return;
        }


        await loadViewerVideo(
            data.path,
            data.time || 0,
            data.playing === true
        );


        return;
    }


    /* -----------------------------------------------------
       LOAD
       ----------------------------------------------------- */

    if (
        data.type === "LOAD"
    ) {

        console.log(
            "LOAD recibido:",
            data.path
        );


        await loadViewerVideo(
            data.path,
            data.time || 0,
            false
        );


        return;
    }


    /* -----------------------------------------------------
       PLAY
       ----------------------------------------------------- */

    if (
        data.type === "PLAY"
    ) {

        const command =
            ++viewerCommand;


        try {

            await waitForMetadata();


            if (
                command !== viewerCommand
            ) {
                return;
            }


            if (
                typeof data.time === "number"
            ) {

                video.currentTime =
                    Math.max(
                        0,
                        data.time
                    );
            }


            try {

                await video.play();

            } catch (error) {

                video.muted = true;

                await video.play().catch(
                    () => {}
                );
            }

        } catch (error) {

            console.warn(
                "PLAY recibido pero el video todavía no está listo."
            );
        }


        return;
    }


    /* -----------------------------------------------------
       PAUSE
       ----------------------------------------------------- */

    if (
        data.type === "PAUSE"
    ) {

        ++viewerCommand;


        try {

            if (
                typeof data.time === "number"
            ) {

                await waitForMetadata();

                video.currentTime =
                    Math.max(
                        0,
                        data.time
                    );
            }

        } catch (error) {

            console.warn(error);
        }


        video.pause();

        video.playbackRate = 1;

        return;
    }


    /* -----------------------------------------------------
       SEEK
       ----------------------------------------------------- */

    if (
        data.type === "SEEK"
    ) {

        try {

            await waitForMetadata();


            if (
                typeof data.time === "number"
            ) {

                video.currentTime =
                    Math.max(
                        0,
                        data.time
                    );
            }

        } catch (error) {

            console.warn(
                "No se pudo hacer SEEK:",
                error
            );
        }


        return;
    }


    /* -----------------------------------------------------
       HEARTBEAT
       ----------------------------------------------------- */

    if (
        data.type === "HEARTBEAT"
    ) {

        if (
            !masterState &&
            !video.src
        ) {
            return;
        }


        if (
            video.readyState <
            HTMLMediaElement.HAVE_METADATA
        ) {
            return;
        }


        if (
            typeof data.time !== "number"
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
         * corregimos directamente.
         */

        if (
            absoluteDifference > 1.5
        ) {

            try {

                video.currentTime =
                    data.time;

            } catch (error) {

                console.warn(error);
            }


            video.playbackRate = 1;
        }


        /*
         * Diferencia pequeña:
         * aceleramos o ralentizamos
         * ligeramente.
         */

        else if (
            absoluteDifference > 0.25
        ) {

            if (difference > 0) {

                video.playbackRate =
                    1.03;

            } else {

                video.playbackRate =
                    0.97;
            }

        } else {

            video.playbackRate =
                1;
        }


        /*
         * Estado PLAY / PAUSE
         */

        if (
            data.playing &&
            video.paused
        ) {

            try {

                await video.play();

            } catch (error) {

                video.muted = true;

                await video.play().catch(
                    () => {}
                );
            }

        } else if (
            !data.playing &&
            !video.paused
        ) {

            video.pause();

            video.playbackRate = 1;
        }


        return;
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


/* =========================================================
   INICIO
   ========================================================= */

async function initialize() {

    console.log(
        "================================="
    );

    console.log(
        isStreamer
            ? "ANIMXCAT - STREAMER"
            : "ANIMXCAT - VIEWER"
    );

    console.log(
        "================================="
    );


    try {

        await loadPeerJS();


        console.log(
            "PeerJS cargado correctamente."
        );


        if (isStreamer) {

            startStreamer();

        } else {

            startViewerPeer();
        }

    } catch (error) {

        console.error(
            "No se pudo iniciar PeerJS:",
            error
        );
    }
}


initialize();

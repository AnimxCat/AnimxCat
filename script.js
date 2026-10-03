document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('mainVideo');
    const chapterSelect = document.getElementById('chapterSelect');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const controlsPanel = document.getElementById('controls');

    // Detectar si el usuario es espectador (?view=viewer)
    const urlParams = new URLSearchParams(window.location.search);
    const isViewer = urlParams.get('view') === 'viewer';

    if (isViewer) {
        // Ocultar panel de control para el espectador
        if (controlsPanel) controlsPanel.style.display = 'none';
        
        // Escuchar cambios guardados por el Host en LocalStorage
        window.addEventListener('storage', (e) => {
            if (e.key === 'stream_state') {
                const state = JSON.parse(e.newValue);
                if (state) syncViewer(state);
            }
        });
    } else {
        // Lógica del HOST (Streamer)
        function updateState() {
            const state = {
                src: video.src,
                currentTime: video.currentTime,
                paused: video.paused,
                timestamp: Date.now()
            };
            localStorage.setItem('stream_state', JSON.stringify(state));
        }

        // Eventos para transmitir acciones
        video.addEventListener('play', updateState);
        video.addEventListener('pause', updateState);
        video.addEventListener('seeked', updateState);

        // Selección por menú desplegable
        chapterSelect.addEventListener('change', (e) => {
            const url = e.target.value;
            if (url) {
                video.src = url;
                video.play();
                updateState();
            }
        });

        // Selección por URL manual
        loadUrlBtn.addEventListener('click', () => {
            const url = videoUrlInput.value.trim();
            if (url) {
                video.src = url;
                video.play();
                updateState();
            }
        });
    }

    // Aplicar estado sincronizado al visor
    function syncViewer(state) {
        if (video.src !== state.src && state.src) {
            video.src = state.src;
        }

        const timeDifference = (Date.now() - state.timestamp) / 1000;
        const expectedTime = state.paused ? state.currentTime : state.currentTime + timeDifference;

        if (Math.abs(video.currentTime - expectedTime) > 1.5) {
            video.currentTime = expectedTime;
        }

        if (state.paused && !video.paused) {
            video.pause();
        } else if (!state.paused && video.paused) {
            video.play().catch(() => {
                console.log('El navegador bloqueó la reproducción automática.');
            });
        }
    }
});

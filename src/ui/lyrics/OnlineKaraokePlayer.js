let pendingApi;
function loadPlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pendingApi) return pendingApi;
  pendingApi = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    let timer;
    const script = document.createElement('script');
    const restore = () => { clearTimeout(timer); if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous; };
    const fail = () => { restore(); script.remove(); reject(Error('No se pudo conectar con YouTube. Puedes abrir la pista en el proveedor.')); };
    const ready = () => { restore(); if(typeof previous==='function') { try { previous(); } catch(_) {} } resolve(window.YT); };
    window.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    timer = setTimeout(fail, 15_000);
    document.head.append(script);
  }).catch(error => { pendingApi = null; throw error; });
  return pendingApi;
}
export class OnlineKaraokePlayer {
  constructor(iframe, status) { this.iframe = iframe; this.status = status; this.disposed = false; void this.connect(); }
  setStatus(text) { if (!this.disposed && this.status?.isConnected) this.status.textContent = text; }
  async connect() {
    try {
      const YT = await loadPlayerApi();
      if (this.disposed || !this.iframe?.isConnected) return;
      this.player = new YT.Player(this.iframe, { events: {
        onReady: () => this.setStatus('Pulsa reproducir en el vídeo para cantar.'),
        onStateChange: event => { if (event.data === 1) this.setStatus('El vídeo lleva la letra y el tiempo. La app muestra afinación libre.'); },
        onError: event => this.setStatus('YouTube no permite reproducir esta pista aquí (código ' + event.data + '). Abre el enlace del proveedor o elige otra pista.'),
      } });
    } catch (error) { this.setStatus(error.message); }
  }
  destroy() {
    this.disposed = true;
    try { this.player?.destroy(); } catch (_) {}
    if (this.iframe?.isConnected) this.iframe.remove();
    this.player = this.iframe = this.status = null;
  }
}

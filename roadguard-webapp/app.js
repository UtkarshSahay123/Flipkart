const siteFrame = document.getElementById('roadguard-site');
const loadingScreen = document.getElementById('loading-screen');
const connectionState = document.getElementById('connection-state');
const offlineNotice = document.getElementById('offline-notice');
const installButton = document.getElementById('install-button');
let installPrompt = null;
let loadFallbackTimer;

function fitWebsiteToAppFrame() {
  try {
    const frameDocument = siteFrame.contentDocument;
    if (!frameDocument?.head || !frameDocument.body) return;
    let responsiveStyle = frameDocument.getElementById('roadguard-installed-app-layout');
    if (!responsiveStyle) {
      responsiveStyle = frameDocument.createElement('style');
      responsiveStyle.id = 'roadguard-installed-app-layout';
      frameDocument.head.appendChild(responsiveStyle);
    }
    responsiveStyle.textContent = `
      html, body { max-width: 100vw !important; overflow-x: hidden !important; }
      @media (max-width: 767px) {
        body { min-width: 0 !important; }
        header { width: 100% !important; max-width: 100vw !important; }
        header > div { width: 100% !important; max-width: 100vw !important; padding-left: 12px !important; padding-right: 12px !important; }
        header nav { width: 100% !important; max-width: 100% !important; flex-wrap: wrap !important; justify-content: center !important; gap: 8px !important; }
        header nav a { white-space: normal !important; text-align: center !important; }
        #profile-dropdown-container { align-self: center !important; max-width: 100% !important; }
        #profile-menu-button { max-width: calc(100vw - 24px) !important; }
        #profile-dropdown-menu { left: 50% !important; right: auto !important; width: min(18rem, calc(100vw - 24px)) !important; transform: translateX(-50%) !important; }
        main { width: 100% !important; max-width: 100vw !important; min-width: 0 !important; }
        .leaflet-container { width: 100% !important; max-width: 100% !important; }
      }
      @media (max-width: 380px) {
        header nav { column-gap: 7px !important; row-gap: 5px !important; }
        header nav a { font-size: 11px !important; }
      }
    `;
    frameDocument.querySelectorAll('a[target="_blank"]').forEach(link => {
      try {
        if (new URL(link.href, frameDocument.baseURI).origin === frameDocument.location.origin) {
          link.target = '_self';
        }
      } catch {}
    });
    if (frameDocument.getElementById('map')) {
      responsiveStyle.textContent += `
        @media (max-width: 767px) {
          html, body { height: auto !important; min-height: 100% !important; }
          body { overflow-y: auto !important; }
          body > aside { position: relative !important; inset: auto !important; width: 100% !important; height: auto !important; max-height: 42vh !important; overflow-y: auto !important; }
          body > main { height: auto !important; min-height: 100vh !important; margin-left: 0 !important; }
          body > main > div.flex-1 { min-height: 0 !important; overflow: visible !important; }
          body > main > div.flex-1 > section:first-child { min-height: 58vh !important; height: 58vh !important; }
        }
      `;
    }
  } catch {
    // Cross-origin navigation is left untouched; production serves both pages on one origin.
  }
}

function setNetworkState() {
  const online = navigator.onLine;
  connectionState.classList.toggle('online', online);
  connectionState.classList.toggle('offline', !online);
  connectionState.querySelector('span').textContent = online ? 'Online' : 'Offline';
  offlineNotice.hidden = online;
}

function finishLoading() {
  clearTimeout(loadFallbackTimer);
  loadingScreen.classList.add('done');
}

siteFrame.addEventListener('load', () => {
  fitWebsiteToAppFrame();
  requestAnimationFrame(fitWebsiteToAppFrame);
  setTimeout(fitWebsiteToAppFrame, 150);
  finishLoading();
});
document.getElementById('reload-button').addEventListener('click', () => {
  loadingScreen.classList.remove('done');
  loadFallbackTimer = setTimeout(finishLoading, 12000);
  siteFrame.contentWindow.location.reload();
});

window.addEventListener('online', setNetworkState);
window.addEventListener('offline', setNetworkState);
setNetworkState();
loadFallbackTimer = setTimeout(finishLoading, 12000);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  installPrompt = null;
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

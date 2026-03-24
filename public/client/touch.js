export function setupTouchControls(contentWindow) {
  // Only activate on touch devices
  if (!('ontouchstart' in window)) return;

  const doc = contentWindow.document;

  // Create touch overlay
  const overlay = doc.createElement('div');
  overlay.id = 'touch-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999;touch-action:none;';
  doc.body.appendChild(overlay);

  // Split screen: left half = left player key (ArrowUp), right half = right player key (w)
  // But in online mode, player only needs ONE tap to jump (server maps it)
  // So: tap anywhere = press the jump key

  overlay.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // Fire both keys — server will only use the one mapped to this client's side
    contentWindow.dispatchEvent(new CustomEvent('basket-key', {
      detail: { type: 'keydown', key: 'ArrowUp' }
    }));
    contentWindow.dispatchEvent(new CustomEvent('basket-key', {
      detail: { type: 'keydown', key: 'w' }
    }));
  }, { passive: false });

  overlay.addEventListener('touchend', (e) => {
    e.preventDefault();
    contentWindow.dispatchEvent(new CustomEvent('basket-key', {
      detail: { type: 'keyup', key: 'ArrowUp' }
    }));
    contentWindow.dispatchEvent(new CustomEvent('basket-key', {
      detail: { type: 'keyup', key: 'w' }
    }));
  }, { passive: false });

  // Visual feedback — brief flash on tap
  overlay.addEventListener('touchstart', () => {
    overlay.style.backgroundColor = 'rgba(255,255,255,0.05)';
    setTimeout(() => overlay.style.backgroundColor = 'transparent', 100);
  });
}

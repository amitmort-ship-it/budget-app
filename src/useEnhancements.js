// useEnhancements.js
// Runs DOM-level UI enhancements after React renders.
// Called from main.jsx via: import './useEnhancements.js'

function applyEnhancements() {
  // ---- HEADER ----
  document.querySelectorAll('div[style*="linear-gradient(135deg, rgb(197"]').forEach(h => {
    h.style.background = 'linear-gradient(135deg, #5E3A9A 0%, #8258C8 55%, #A67FD8 100%)';
    h.style.borderRadius = '0 0 28px 28px';
    h.style.boxShadow = '0 6px 32px rgba(80,50,140,0.28)';
  });

  // ---- PAGE BG ----
  document.querySelectorAll('div[style*="background: rgb(245, 246, 248)"]').forEach(d => {
    d.style.background = '#EEE8F8';
  });

  // ---- WHITE CARDS ----
  document.querySelectorAll('div[style*="background: rgb(255, 255, 255)"]').forEach(card => {
    card.style.borderRadius = '18px';
    card.style.boxShadow = '0 3px 18px rgba(124,92,191,0.11)';
    card.style.border = '1px solid rgba(200,185,230,0.45)';
    card.style.transition = 'box-shadow 0.22s ease, transform 0.22s ease';
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 8px 30px rgba(124,92,191,0.20)';
      card.style.transform = 'translateY(-2px)';
    }, { passive: true, once: false });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '0 3px 18px rgba(124,92,191,0.11)';
      card.style.transform = '';
    }, { passive: true, once: false });
  });

  // ---- ZERO-SPEND CATEGORY MUTING ----
  document.querySelectorAll('div[style*="background: rgb(255, 255, 255)"]').forEach(card => {
    const text = card.textContent || '';
    if (/\(0%\)/.test(text) && text.includes('\u20AA0 /') && card.offsetHeight > 30 && card.offsetHeight < 100) {
      card.style.opacity = '0.45';
      card.style.filter = 'saturate(0.3)';
      card.style.transition = 'opacity 0.22s, filter 0.22s';
      card.addEventListener('mouseenter', () => { card.style.opacity = '1'; card.style.filter = ''; }, { passive: true });
      card.addEventListener('mouseleave', () => { card.style.opacity = '0.45'; card.style.filter = 'saturate(0.3)'; }, { passive: true });
    }
  });
}

function createFAB() {
  if (document.getElementById('claude-fab')) return;

  // Find the original add button
  const realBtn = Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent?.trim().includes('\u05e8\u05e9\u05d5\u05dd \u05d4\u05d5\u05e6\u05d0\u05d4')
  );
  if (!realBtn) return;
  realBtn.style.visibility = 'hidden';
  realBtn.style.position = 'fixed';
  realBtn.style.bottom = '-200px';

  const fab = document.createElement('button');
  fab.id = 'claude-fab';
  fab.innerHTML = '<span style="font-size:20px;line-height:1">\u＋</span><span>\u05e8\u05e9\u05d5\u05dd \u05d4\u05d5\u05e6\u05d0\u05d4</span>';
  fab.onclick = () => {
    realBtn.style.visibility = 'visible';
    realBtn.click();
    setTimeout(() => { realBtn.style.visibility = 'hidden'; }, 150);
  };
  document.body.appendChild(fab);
}

function createDarkModeBtn() {
  if (document.getElementById('claude-darkmode-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'claude-darkmode-btn';
  btn.title = '\u05de\u05e6\u05d1 \u05db\u05d4\u05d4 / \u05d1\u05d4\u05d9\u05e8';
  btn.textContent = '\uD83C\uDF19';
  let dark = false;
  btn.onclick = () => {
    dark = !dark;
    btn.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
    const appDiv = document.querySelector('body > div:first-child');
    if (appDiv) {
      appDiv.style.filter = dark ? 'invert(1) hue-rotate(180deg)' : '';
      appDiv.style.transition = 'filter 0.4s ease';
    }
    // Re-invert media
    document.querySelectorAll('body > div:first-child img, body > div:first-child canvas, body > div:first-child video').forEach(el => {
      el.style.filter = dark ? 'invert(1) hue-rotate(180deg)' : '';
    });
  };
  document.body.appendChild(btn);
}

// Run after DOM is ready, and re-run periodically to catch React re-renders
function init() {
  applyEnhancements();
  createFAB();
  createDarkModeBtn();
  // Re-apply after React renders new content
  const observer = new MutationObserver(() => {
    applyEnhancements();
    createFAB();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 500);
}

// useEnhancements.js
// DOM-level UI enhancements applied after React renders.

function applyEnhancements() {
  document.querySelectorAll('div[style*="linear-gradient(135deg, rgb(197"]').forEach(h => {
    h.style.background = 'linear-gradient(135deg, #5E3A9A 0%, #8258C8 55%, #A67FD8 100%)';
    h.style.borderRadius = '0 0 28px 28px';
    h.style.boxShadow = '0 6px 32px rgba(80,50,140,0.28)';
  });
  document.querySelectorAll('div[style*="background: rgb(245, 246, 248)"]').forEach(d => {
    d.style.background = '#EEE8F8';
  });
  document.querySelectorAll('div[style*="background: rgb(255, 255, 255)"]').forEach(card => {
    if (card._cl_enhanced) return;
    card._cl_enhanced = true;
    card.style.borderRadius = '18px';
    card.style.boxShadow = '0 3px 18px rgba(124,92,191,0.11)';
    card.style.border = '1px solid rgba(200,185,230,0.45)';
    card.style.transition = 'box-shadow 0.22s ease, transform 0.22s ease';
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 8px 30px rgba(124,92,191,0.20)';
      card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '0 3px 18px rgba(124,92,191,0.11)';
      card.style.transform = '';
    });
  });
}

function createFAB() {
  if (document.getElementById('claude-fab')) return;
  const realBtn = Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent && b.textContent.trim().includes('רשום הוצאה')
  );
  if (!realBtn) return;
  realBtn.style.visibility = 'hidden';
  realBtn.style.position = 'fixed';
  realBtn.style.bottom = '-200px';
  const fab = document.createElement('button');
  fab.id = 'claude-fab';
  fab.textContent = '+ רשום הוצאה';
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
  btn.textContent = '🌙';
  let dark = false;
  btn.onclick = () => {
    dark = !dark;
    btn.textContent = dark ? '☀️' : '🌙';
    const appDiv = document.querySelector('body > div:first-child');
    if (appDiv) {
      appDiv.style.filter = dark ? 'invert(1) hue-rotate(180deg)' : '';
      appDiv.style.transition = 'filter 0.4s ease';
    }
    document.querySelectorAll('body > div:first-child img, body > div:first-child canvas').forEach(el => {
      el.style.filter = dark ? 'invert(1) hue-rotate(180deg)' : '';
    });
  };
  document.body.appendChild(btn);
}

function init() {
  applyEnhancements();
  createFAB();
  createDarkModeBtn();
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

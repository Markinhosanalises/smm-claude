/* HTML from API responses must pass DOMPurify before entering the DOM. */
window.safeHTML = function (html) {
  if (!window.DOMPurify) throw new Error('Sanitizador indisponível');
  return DOMPurify.sanitize(String(html), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed'], FORBID_ATTR: ['srcdoc'] });
};
window.escapeHTML = function (value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  try { await navigator.clipboard.writeText(button.dataset.code || ''); button.textContent = 'Copiado ✓'; }
  catch { button.textContent = 'Selecione e copie o código acima'; }
});

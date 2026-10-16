/* HTML from API responses must pass DOMPurify before entering the DOM. */
window.safeHTML = function (html) {
  if (!window.DOMPurify) throw new Error('Sanitizador indisponível');
  return DOMPurify.sanitize(String(html), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed'], FORBID_ATTR: ['srcdoc'] });
};
// Table cells need a table parsing context; parsing them as body HTML drops td/th.
window.safeRowHTML = function (html) {
  const template = document.createElement('template');
  template.innerHTML = window.safeHTML('<table><tbody><tr>' + String(html) + '</tr></tbody></table>');
  return template.content.querySelector('tr')?.innerHTML || '';
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

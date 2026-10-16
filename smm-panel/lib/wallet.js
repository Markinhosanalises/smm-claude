const { fbTransaction, key } = require('./firebase');
const { fail } = require('./http');
function balanceCents(w) {
  const c = w?.saldoCentavos ?? Math.round(Number(w?.saldo || 0) * 100);
  if (!Number.isSafeInteger(c) || c < 0) fail('Saldo inválido. Contate o suporte.', 409);
  return c;
}
async function change(id, cents, operation) {
  key(id); key(operation);
  if (!Number.isSafeInteger(cents) || !cents) fail('Valor inválido');
  let insufficient = false, conflict = false;
  const result = await fbTransaction('carteiras/' + id, w => {
    w = w || {};
    insufficient = false; conflict = false;
    const prior = w.movimentos?.[operation];
    if (prior) { if (prior.centavos !== cents) { conflict = true; return; } return w; }
    const next = balanceCents(w) + cents;
    if (next < 0) { insufficient = true; return; }
    if (!Number.isSafeInteger(next)) return;
    return { ...w, saldoCentavos: next, saldo: next / 100, ...(cents > 0 ? { ultimoCredito: Date.now() } : {}), movimentos: { ...w.movimentos, [operation]: { centavos: cents, criadoEm: Date.now() } } };
  });
  if (!result.committed) fail(conflict ? 'Operação conflitante' : insufficient ? 'Saldo insuficiente' : 'Falha ao atualizar saldo', 409);
  return result.value.saldo;
}
module.exports = { change, balanceCents };

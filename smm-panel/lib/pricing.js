const { number, fail } = require('./http');
function rate(s, config, customer = {}) {
  const cost = number(s.taxaCusto, 'Custo', 0.000000001, 100000000);
  const fx = number(config.cotacaoUSDBRL ?? 1, 'Cotação', 0.000001, 100000);
  const margin = number(s.lucroPercentual ?? config.lucroPercentualGlobal ?? 30, 'Margem', 0, 100000);
  const discount = number(customer.desconto || 0, 'Desconto', 0, 90);
  // Per-thousand tariffs may be fractions of a cent. Round money at order total.
  return Number((cost * fx * (1 + margin / 100) * (1 - discount / 100)).toFixed(8));
}
function total(s, config, customer, quantity) {
  if (!s || !s.ativo || s.indisponivel) fail('Serviço indisponível', 404);
  if (!Number.isSafeInteger(Number(s.min)) || !Number.isSafeInteger(Number(s.max)) || Number(s.min) < 1 || Number(s.max) < Number(s.min)) fail('Limites do serviço inválidos', 409);
  const qtd = number(quantity, 'Quantidade', Math.max(1, Number(s.min)), Number(s.max), true);
  const cents = Math.round(rate(s, config, customer) * qtd / 1000 * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) fail('Valor do pedido inválido');
  return { qtd, cents, value: cents / 100 };
}
module.exports = { rate, total };

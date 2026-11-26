const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const SCALE = 10000n;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function decimal(value, title, maximum) {
  if (!['string', 'number'].includes(typeof value)) throw new Error(`${title}须为非负数字。`);
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text) || text.length > 32) throw new Error(`${title}须为非负数字，最多两位小数，不含货币符号或科学计数法。`);
  const [whole, fraction = ''] = text.split('.');
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (n > maximum) throw new Error(`${title}超出允许范围。`);
  return n;
}
export const toCents = value => Number(decimal(value, '金额', MAX));
export function formatMoney(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('金额须为非负安全整数分。');
  const n = BigInt(cents); return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}
const rate = (value, title) => decimal(value, title, SCALE);
const halfUp = (numerator, denominator) => (2n * numerator + denominator) / (2n * denominator);
/** Largest fractional remainder first; equal fractions follow input order. */
function distribute(numerators, denominator, target) {
  const values = numerators.map(n => n / denominator);
  let remaining = target - values.reduce((a, b) => a + b, 0n);
  const order = numerators.map((n, i) => ({ i, fraction: n % denominator })).sort((a, b) => a.fraction === b.fraction ? a.i - b.i : a.fraction > b.fraction ? -1 : 1);
  for (const { i } of order) { if (remaining === 0n) break; values[i]++; remaining--; }
  if (remaining !== 0n) throw new Error('尾差分配失败。');
  return values;
}
export function calculate(input) {
  if (!object(input)) throw new Error('规则须为 JSON 对象。');
  const total = decimal(input.total, '订单金额', MAX);
  if (total === 0n) throw new Error('订单金额须大于 0。');
  if (!object(input.fee)) throw new Error('请设置手续费规则。');
  const feeRate = rate(input.fee.rate, '手续费率');
  const feeFixed = decimal(input.fee.fixed, '固定手续费', MAX);
  const mode = input.fee.mode;
  if (!['before', 'participant', 'proportional'].includes(mode)) throw new Error('手续费承担方式无效。');
  const fee = halfUp(total * feeRate, SCALE) + feeFixed;
  if (fee > total) throw new Error('手续费不能超过订单金额。');
  const base = mode === 'before' ? total - fee : total;
  if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 50) throw new Error('请设置 1 至 50 个分配方。');
  const ids = new Set();
  const participants = input.participants.map((p, i) => {
    if (!object(p) || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.id) || ids.has(p.id)) throw new Error(`第 ${i + 1} 方的 ID 无效或重复。`);
    ids.add(p.id);
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 80) throw new Error(`第 ${i + 1} 方名称须为 1 至 80 个字符。`);
    if (!['percent', 'fixed', 'remainder'].includes(p.kind)) throw new Error(`第 ${i + 1} 方的分配类型无效。`);
    const value = p.kind === 'percent' ? rate(p.value, `${p.name}比例`) : p.kind === 'fixed' ? decimal(p.value, `${p.name}固定金额`, MAX) : 0n;
    return { id: p.id, name: p.name.trim(), kind: p.kind, value };
  });
  const remainders = participants.filter(p => p.kind === 'remainder');
  if (remainders.length !== 1) throw new Error('必须且只能设置一个“剩余金额”接收方。');
  const fixedTotal = participants.filter(p => p.kind === 'fixed').reduce((a, p) => a + p.value, 0n);
  const percentageTotal = participants.filter(p => p.kind === 'percent').reduce((a, p) => a + p.value, 0n);
  if (percentageTotal > SCALE || fixedTotal * SCALE + base * percentageTotal > base * SCALE) throw new Error('固定金额与比例分配合计超过分配基数，请调整规则。');
  const ratioIndices = participants.map((p, i) => p.kind === 'percent' ? i : -1).filter(i => i >= 0);
  const numerators = ratioIndices.map(i => base * participants[i].value);
  const ratioTarget = halfUp(base * percentageTotal, SCALE);
  const ratioAmounts = distribute(numerators, SCALE, ratioTarget);
  const amounts = participants.map(p => p.kind === 'fixed' ? p.value : 0n);
  ratioIndices.forEach((index, i) => { amounts[index] = ratioAmounts[i]; });
  amounts[participants.findIndex(p => p.kind === 'remainder')] = base - fixedTotal - ratioTarget;
  const charges = participants.map(() => 0n);
  if (mode === 'participant') {
    const index = participants.findIndex(p => p.id === input.fee.participantId);
    if (index < 0) throw new Error('请选择有效的手续费承担方。');
    if (amounts[index] < fee) throw new Error('指定方分配额不足以承担手续费，请更换承担方式或调整规则。');
    charges[index] = fee;
  } else if (mode === 'proportional') {
    const feeShares = distribute(amounts.map(a => a * fee), total, fee);
    feeShares.forEach((value, i) => { charges[i] = value; });
  }
  const rows = participants.map((p, i) => {
    const rounding = p.kind === 'percent' ? amounts[i] - base * p.value / SCALE : 0n;
    const net = amounts[i] - charges[i];
    if (net < 0n) throw new Error('扣费后金额不能为负数。');
    return { id: p.id, name: p.name, kind: p.kind, rule: p.kind === 'remainder' ? '剩余金额' : p.kind === 'percent' ? `${formatMoney(Number(p.value))}% × 分配基数` : `固定 ${formatMoney(Number(p.value))} 元`, allocatedCents: Number(amounts[i]), feeCents: Number(charges[i]), netCents: Number(net), roundingCents: Number(rounding) };
  });
  const netTotal = rows.reduce((a, r) => a + BigInt(r.netCents), 0n);
  if (netTotal + fee !== total) throw new Error('资金守恒检查失败。');
  const config = { total: formatMoney(Number(total)), fee: { rate: formatMoney(Number(feeRate)), fixed: formatMoney(Number(feeFixed)), mode, participantId: mode === 'participant' ? input.fee.participantId : '' }, participants: participants.map(p => ({ id: p.id, name: p.name, kind: p.kind, value: p.kind === 'remainder' ? '' : formatMoney(Number(p.value)) })) };
  return { version: '0.1.0', currency: 'CNY', config, totalCents: Number(total), feeCents: Number(fee), baseCents: Number(base), netTotalCents: Number(netTotal), rows };
}
export function exportCSV(result) {
  const quote = value => {
    let text = String(value);
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const data = [['有钱收分账试算', 'CNY', '本表不是到账证明'], ['订单金额(元)', formatMoney(result.totalCents)], ['总手续费(元)', formatMoney(result.feeCents)], ['分配基数(元)', formatMoney(result.baseCents)], ['承担方式', result.config.fee.mode], [], ['ID', '分配方', '规则', '分配额(元)', '承担手续费(元)', '预计净额(元)', '比例舍入补分(分)']];
  for (const r of result.rows) data.push([r.id, r.name, r.rule, formatMoney(r.allocatedCents), formatMoney(r.feeCents), formatMoney(r.netCents), r.roundingCents]);
  return '\uFEFF' + data.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

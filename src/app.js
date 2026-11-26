import { calculate, formatMoney, exportCSV } from './core.js';
const $ = id => document.getElementById(id);
const presets = {
  platform: { total: '1000.00', fee: { rate: '0.38', fixed: '0.00', mode: 'before', participantId: '' }, participants: [{ id: 'platform', name: '平台佣金', kind: 'percent', value: '5.00' }, { id: 'supplier', name: '供应商', kind: 'percent', value: '30.00' }, { id: 'store', name: '门店', kind: 'remainder', value: '' }] },
  fixed: { total: '1000.00', fee: { rate: '0.00', fixed: '0.00', mode: 'before', participantId: '' }, participants: [{ id: 'supplier', name: '供应商货款', kind: 'fixed', value: '200.00' }, { id: 'platform', name: '平台佣金', kind: 'percent', value: '5.00' }, { id: 'store', name: '门店', kind: 'remainder', value: '' }] },
  rounding: { total: '0.01', fee: { rate: '0.00', fixed: '0.00', mode: 'before', participantId: '' }, participants: [{ id: 'a', name: '甲方', kind: 'percent', value: '33.33' }, { id: 'b', name: '乙方', kind: 'percent', value: '33.33' }, { id: 'c', name: '剩余方', kind: 'remainder', value: '' }] }
};
let result = null, generation = 0;
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
function invalidate() {
  generation++; result = null; $('export-json').disabled = true; $('export-csv').disabled = true;
  $('rows').replaceChildren(); $('overview').replaceChildren(); $('rounding-note').textContent = '规则已修改，请重新试算。';
  $('edit-state').textContent = '规则已修改，原试算结果已清除。'; message('请点击“开始试算”更新结果。');
}
function participants() {
  return [...$('participants').children].map(row => ({ id: row.dataset.id, name: row.querySelector('.party-name').value, kind: row.querySelector('.party-kind').value, value: row.querySelector('.party-value').value }));
}
function payerOptions() {
  const selected = $('fee-payer').value; $('fee-payer').replaceChildren();
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = '请选择承担方'; $('fee-payer').append(empty);
  for (const p of participants()) { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name || '未命名分配方'; $('fee-payer').append(option); }
  $('fee-payer').value = selected; $('payer-field').hidden = $('fee-mode').value !== 'participant';
}
function addParty(p) {
  const row = document.createElement('div'); row.className = 'party'; row.dataset.id = p.id;
  const nameLabel = document.createElement('label'); nameLabel.textContent = '分配方名称';
  const name = document.createElement('input'); name.className = 'party-name'; name.value = p.name; name.maxLength = 80; nameLabel.append(name);
  const kindLabel = document.createElement('label'); kindLabel.textContent = '分配方式';
  const kind = document.createElement('select'); kind.className = 'party-kind';
  for (const [value, text] of [['percent', '按比例（%）'], ['fixed', '固定金额（元）'], ['remainder', '剩余金额']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; kind.append(option); }
  kind.value = p.kind; kindLabel.append(kind);
  const valueLabel = document.createElement('label'); valueLabel.textContent = '比例 / 金额';
  const value = document.createElement('input'); value.className = 'party-value'; value.inputMode = 'decimal'; value.value = p.value; value.disabled = p.kind === 'remainder'; valueLabel.append(value);
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '删除'; remove.setAttribute('aria-label', '删除此分配方');
  remove.addEventListener('click', () => { row.remove(); payerOptions(); invalidate(); $('add').disabled = false; });
  name.addEventListener('input', () => { payerOptions(); invalidate(); });
  value.addEventListener('input', invalidate);
  kind.addEventListener('change', () => { value.disabled = kind.value === 'remainder'; if (value.disabled) value.value = ''; else if (!value.value) value.value = '0.00'; invalidate(); });
  row.append(nameLabel, kindLabel, valueLabel, remove); $('participants').append(row);
}
function setConfig(config) {
  $('total').value = config.total; $('fee-rate').value = config.fee.rate; $('fee-fixed').value = config.fee.fixed; $('fee-mode').value = config.fee.mode;
  $('participants').replaceChildren(); config.participants.forEach(addParty); payerOptions(); $('fee-payer').value = config.fee.participantId || '';
  $('add').disabled = config.participants.length >= 50; invalidate();
}
function readConfig() { return { total: $('total').value, fee: { rate: $('fee-rate').value, fixed: $('fee-fixed').value, mode: $('fee-mode').value, participantId: $('fee-payer').value }, participants: participants() }; }
function render(data) {
  $('overview').replaceChildren();
  const equation = document.createElement('div'); equation.className = 'equation';
  for (const [name, value] of [['订单金额', data.totalCents], ['手续费', data.feeCents], ['各方净额合计', data.netTotalCents]]) {
    const block = document.createElement('div'), label = document.createElement('span'), amount = document.createElement('strong');
    label.textContent = name; amount.textContent = formatMoney(value); block.append(label, amount); equation.append(block);
  }
  const basis = document.createElement('p'); basis.className = 'basis'; basis.textContent = `本次分配基数 ${formatMoney(data.baseCents)} 元；${data.config.fee.mode === 'before' ? '已先扣手续费，明细中不重复扣费。' : data.config.fee.mode === 'participant' ? '按订单原金额分配，手续费由指定方承担。' : '按订单原金额分配，手续费按各方分配额分摊。'}`;
  $('overview').append(equation, basis); $('rows').replaceChildren();
  for (const r of data.rows) {
    const tr = document.createElement('tr'), name = document.createElement('td'), note = document.createElement('small'); name.textContent = r.name; note.textContent = r.rule; name.append(note); tr.append(name);
    for (const amount of [r.allocatedCents, r.feeCents, r.netCents]) { const td = document.createElement('td'); td.className = 'number'; td.textContent = formatMoney(amount); tr.append(td); } $('rows').append(tr);
  }
  const rounded = data.rows.filter(r => r.roundingCents);
  $('rounding-note').textContent = rounded.length ? `比例舍入补分：${rounded.map(r => `${r.name} +${r.roundingCents} 分`).join('；')}。同余数按列表顺序分配；剩余金额另归指定方。` : '比例分配无额外补分。订单金额 = 总手续费 + 各方预计净额，资金守恒检查通过。';
  $('export-json').disabled = false; $('export-csv').disabled = false; $('edit-state').textContent = '结果对应当前规则，修改任一字段后需重新试算。';
}
function run() {
  try { result = calculate(readConfig()); render(result); message('试算完成，资金守恒检查通过。预计净额不代表实际到账。'); if (innerWidth <= 760) document.querySelector('.report').scrollIntoView({ block: 'start' }); }
  catch (error) { invalidate(); message(error.message, true); }
}
for (const id of ['total', 'fee-rate', 'fee-fixed']) $(id).addEventListener('input', invalidate);
$('fee-mode').addEventListener('change', () => { payerOptions(); invalidate(); }); $('fee-payer').addEventListener('change', invalidate);
$('add').addEventListener('click', () => { if (participants().length >= 50) return; addParty({ id: 'p-' + crypto.randomUUID(), name: '新分配方', kind: 'percent', value: '0.00' }); payerOptions(); invalidate(); $('add').disabled = participants().length >= 50; });
$('calculate').addEventListener('click', run);
$('demo').addEventListener('click', () => { setConfig(presets[$('preset').value]); run(); });
$('import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const token = ++generation;
  try {
    if (file.size > 256 * 1024) throw new Error('规则文件最大支持 256 KB。');
    const text = await file.text(); if (token !== generation) return;
    const input = JSON.parse(text.replace(/^\uFEFF/, ''));
    const validated = calculate(input?.config ?? input);
    setConfig(validated.config); run();
  } catch (error) { if (token === generation) message(`导入失败，原规则保留：${error.message}`, true); }
  finally { event.target.value = ''; }
});
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-json').addEventListener('click', () => { if (result) download(JSON.stringify(result, null, 2) + '\n', 'application/json', 'yqspay-split-result.json'); });
$('export-csv').addEventListener('click', () => { if (result) download(exportCSV(result), 'text/csv;charset=utf-8', 'yqspay-split-result.csv'); });
setConfig(presets.platform); $('edit-state').textContent = '默认规则已就绪，点击“开始试算”。'; message('');

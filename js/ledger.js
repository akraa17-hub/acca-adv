/* ============================================================
   ledger.js — دفتر الأستاذ وميزان المراجعة والقوائم المالية
   يحتوي على: دفتر الأستاذ العام، ميزان المراجعة،
   قائمة الدخل، الميزانية العمومية، قائمة التدفقات النقدية
   ============================================================ */

/* ============================================================
   دفتر الأستاذ (General Ledger)
   ============================================================ */

/* ===== تحديث قائمة تصفية الحسابات ===== */
function updateLedgerFilter() {
  const sel = document.getElementById('ledger-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الحسابات</option>' +
    S.accounts.map(a => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${a.code} - ${a.name}</option>`).join('');
}

/* ===== عرض دفتر الأستاذ ===== */
function renderLedger() {
  const filter   = document.getElementById('ledger-filter')?.value || '';
  const accounts = filter ? S.accounts.filter(a => a.id === filter) : S.accounts;
  const container = document.getElementById('ledger-content');
  let html = '';

  accounts.forEach(acc => {
    // جمع الحركات المرتبطة بهذا الحساب
    const lines = [];
    S.journalEntries.forEach(e => {
      e.lines
        .filter(l => l.accountId === acc.id)
        .forEach(l => lines.push({ date: e.date, desc: e.desc, ref: e.number, debit: l.debit || 0, credit: l.credit || 0 }));
    });

    // تخطي الحساب إذا لم تكن له حركات ولا رصيد افتتاحي
    if (!lines.length && !(acc.opening > 0)) return;

    // ترتيب الحركات بالتاريخ
    lines.sort((a, b) => a.date.localeCompare(b.date));

    const debitNature = isDebitNature(acc);
    let running = acc.opening || 0;

    const rows = lines.map(l => {
      running += debitNature ? (l.debit - l.credit) : (l.credit - l.debit);
      const sign = running >= 0 ? 'مدين' : 'دائن';
      return `<tr>
        <td>${l.date}</td>
        <td>${l.ref}</td>
        <td>${escH(l.desc)}</td>
        <td class="text-green">${l.debit  > 0 ? fmt(l.debit)  : ''}</td>
        <td class="text-red">${l.credit > 0 ? fmt(l.credit) : ''}</td>
        <td class="fw-800 ${running >= 0 ? 'text-accent' : 'text-red'}">${fmt(Math.abs(running))} ${sign}</td>
      </tr>`;
    }).join('');

    html += `<div class="ledger-card">
      <div class="ledger-header">
        <span class="ledger-account-name">${escH(acc.name)}</span>
        <span class="ledger-code">${acc.code}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
          <tbody>
            ${acc.opening > 0 ? `<tr><td>—</td><td>—</td><td>رصيد افتتاحي</td><td class="text-green">${fmt(acc.opening)}</td><td></td><td class="fw-800 text-accent">${fmt(acc.opening)}</td></tr>` : ''}
            ${rows}
          </tbody>
        </table>
      </div>
    </div>`;
  });

  container.innerHTML = html || '<div class="empty-state"><div class="empty-icon">📖</div><p>لا توجد حركات</p></div>';
}

/* ============================================================
   ميزان المراجعة (Trial Balance)
   ============================================================ */
function renderTrialBalance() {
  const tbody = document.getElementById('trial-body');
  let ttDr = 0, ttCr = 0, ttBDr = 0, ttBCr = 0;

  tbody.innerHTML = S.accounts.map(acc => {
    const opening     = acc.opening || 0;
    const { dr, cr }  = getAccBalance(acc.id);
    const debitNature = isDebitNature(acc);

    // أعمدة مجموع المدين / مجموع الدائن (شاملة الرصيد الافتتاحي)
    const tDr = dr + (debitNature  ? opening : 0);
    const tCr = cr + (!debitNature ? opening : 0);

    // أعمدة الرصيد (مدين / دائن)
    const netVal = debitNature ? (tDr - tCr) : (tCr - tDr);
    const balDr  = debitNature  && netVal > 0 ? netVal : 0;
    const balCr  = !debitNature && netVal > 0 ? netVal : 0;

    // تخطي الحسابات الفارغة تماماً
    if (tDr === 0 && tCr === 0) return '';

    ttDr  += tDr;
    ttCr  += tCr;
    ttBDr += balDr;
    ttBCr += balCr;

    const rowClass = netVal < 0 ? 'style="background:var(--red-dim)"' : '';
    return `<tr ${rowClass}>
      <td class="text-muted">${acc.code}</td>
      <td>${escH(acc.name)}</td>
      <td class="text-green">${tDr  > 0     ? fmt(tDr)  : ''}</td>
      <td class="text-red">${tCr   > 0     ? fmt(tCr)  : ''}</td>
      <td class="fw-800 text-accent">${balDr > 0.005 ? fmt(balDr) : ''}</td>
      <td class="fw-800 text-red">${balCr   > 0.005 ? fmt(balCr) : ''}</td>
    </tr>`;
  }).join('');

  // صف الإجماليات
  document.getElementById('tt-debit').textContent      = fmt(ttDr);
  document.getElementById('tt-credit').textContent     = fmt(ttCr);
  document.getElementById('tt-bal-debit').textContent  = fmt(ttBDr);
  document.getElementById('tt-bal-credit').textContent = fmt(ttBCr);

  // مؤشر التوازن
  const diff     = Math.abs(ttDr - ttCr);
  const balanced = diff < 0.01;
  document.getElementById('balance-status').innerHTML =
    `<div style="display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:8px;
      background:${balanced ? 'var(--green-dim)' : 'var(--red-dim)'};
      color:${balanced ? 'var(--green)' : 'var(--red)'};font-weight:700;font-size:12.5px">
      ${balanced
        ? '✓ الميزان متوازن — مجموع المدين = مجموع الدائن = ' + fmt(ttDr)
        : '⚠ الميزان غير متوازن — فرق: ' + fmt(diff) + ' | تحقق من القيود المدخلة'}
    </div>`;
}

/* ============================================================
   قائمة الدخل (Income Statement)
   ============================================================ */
function renderIS() {
  // نستخدم الحسابات الورقية فقط (ليس لها أبناء) لتجنب التضاعف
  const isLeaf   = id => !S.accounts.some(a => a.parentId === id);
  const revAccs  = S.accounts.filter(a => a.type === 'revenue' && isLeaf(a.id));
  const cogsAccs = S.accounts.filter(a => a.type === 'cogs'    && isLeaf(a.id));
  const expAccs  = S.accounts.filter(a => a.type === 'expense' && isLeaf(a.id));

  let tRev = 0, tCogs = 0, tExp = 0;

  // الإيرادات
  document.getElementById('is-revenues').innerHTML = revAccs.map(a => {
    const b = Math.abs(getNetBalance(a.id)); tRev += b;
    return `<div class="fs-row"><span>${escH(a.name)}</span><span class="text-green">${fmt(b)}</span></div>`;
  }).join('') || '<div class="fs-row text-muted"><span>لا إيرادات</span><span>0.00</span></div>';
  document.getElementById('is-total-rev').textContent = fmt(tRev);

  // تكلفة المبيعات
  document.getElementById('is-cogs').innerHTML = cogsAccs.map(a => {
    const b = Math.abs(getNetBalance(a.id)); tCogs += b;
    return `<div class="fs-row"><span>${escH(a.name)}</span><span class="text-red">${fmt(b)}</span></div>`;
  }).join('') || '<div class="fs-row text-muted"><span>لا تكاليف</span><span>0.00</span></div>';
  document.getElementById('is-total-cogs').textContent = fmt(tCogs);

  // مجمل الربح
  const gross = tRev - tCogs;
  const gpEl  = document.getElementById('is-gross-profit');
  gpEl.textContent = fmt(gross);
  gpEl.className   = gross >= 0 ? 'text-green fw-800' : 'text-red fw-800';

  // المصروفات
  document.getElementById('is-expenses').innerHTML = expAccs.map(a => {
    const b = Math.abs(getNetBalance(a.id)); tExp += b;
    return `<div class="fs-row"><span>${escH(a.name)}</span><span class="text-red">${fmt(b)}</span></div>`;
  }).join('') || '<div class="fs-row text-muted"><span>لا مصروفات</span><span>0.00</span></div>';
  document.getElementById('is-total-exp').textContent = fmt(tExp);

  // صافي الربح / الخسارة
  const net   = gross - tExp;
  const netEl = document.getElementById('is-net-profit');
  netEl.textContent = fmt(Math.abs(net)) + (net < 0 ? ' (خسارة)' : '');
  netEl.className   = net >= 0 ? 'text-green fw-800' : 'text-red fw-800';
}

/* ============================================================
   الميزانية العمومية (Balance Sheet)
   ============================================================ */
function renderBS() {
  const isLeaf = id => !S.accounts.some(a => a.parentId === id);

  // دالة مساعدة لعرض قسم من الحسابات
  function rSec(accs) {
    let total = 0;
    const html = accs.filter(a => isLeaf(a.id)).map(a => {
      const b = getNetBalance(a.id);
      if (Math.abs(b) < 0.005) return '';
      total += Math.abs(b);
      return `<div class="fs-row"><span>${escH(a.name)}</span><span class="${b < 0 ? 'text-red' : ''}">${fmt(Math.abs(b))}</span></div>`;
    }).join('') || '<div class="fs-row text-muted"><span>لا بيانات</span><span>0.00</span></div>';
    return { html, total };
  }

  // ── حساب صافي الربح/الخسارة تلقائياً من قائمة الدخل ──────────────
  const tRev  = S.accounts.filter(a => a.type === 'revenue' && !S.accounts.some(x => x.parentId === a.id))
                           .reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const tCogs = S.accounts.filter(a => a.type === 'cogs'    && !S.accounts.some(x => x.parentId === a.id))
                           .reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const tExp  = S.accounts.filter(a => a.type === 'expense' && !S.accounts.some(x => x.parentId === a.id))
                           .reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const netProfit = tRev - tCogs - tExp;

  const ca = rSec(S.accounts.filter(a => a.type === 'asset'     && a.subtype === 'current'));
  const fa = rSec(S.accounts.filter(a => a.type === 'asset'     && a.subtype !== 'current'));
  const cl = rSec(S.accounts.filter(a => a.type === 'liability'));
  const eq = rSec(S.accounts.filter(a => a.type === 'equity'));

  const totalAssets  = ca.total + fa.total;

  // ── إضافة صافي الربح/الخسارة تلقائياً في حقوق الملكية ────────────
  const netProfitLabel = netProfit >= 0 ? 'صافي الربح للفترة' : 'صافي الخسارة للفترة';
  const netProfitClass = netProfit >= 0 ? 'text-green' : 'text-red';
  const netProfitHTML  = Math.abs(netProfit) > 0.005
    ? `<div class="fs-row" style="border-right:3px solid ${netProfit >= 0 ? 'var(--green)' : 'var(--red)'};padding-right:10px">
        <span>${netProfitLabel} 📊</span>
        <span class="${netProfitClass} fw-800">${fmt(Math.abs(netProfit))}</span>
       </div>`
    : '';

  const totalEquity  = eq.total + (netProfit > 0 ? netProfit : 0);
  const totalLiabEq  = cl.total + totalEquity;

  document.getElementById('bs-current-assets').innerHTML         = ca.html;
  document.getElementById('bs-total-current-assets').textContent = fmt(ca.total);
  document.getElementById('bs-fixed-assets').innerHTML           = fa.html;
  document.getElementById('bs-total-fixed-assets').textContent   = fmt(fa.total);
  document.getElementById('bs-total-assets').textContent         = fmt(totalAssets);
  document.getElementById('bs-current-liabilities').innerHTML    = cl.html;
  document.getElementById('bs-total-current-liab').textContent   = fmt(cl.total);
  // حقوق الملكية + صافي الربح التلقائي
  document.getElementById('bs-equity').innerHTML                 = eq.html + netProfitHTML;
  document.getElementById('bs-total-equity').textContent         = fmt(totalEquity);
  document.getElementById('bs-total-liab-equity').textContent    = fmt(totalLiabEq);

  // ── مؤشر توازن المركز المالي ──────────────────────────────────────
  const bsDiff = Math.abs(totalAssets - totalLiabEq);
  const bsEl   = document.getElementById('bs-balance-status');
  if (bsEl) {
    bsEl.innerHTML = bsDiff < 0.01
      ? `<div style="padding:8px 14px;border-radius:8px;background:var(--green-dim);color:var(--green);font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px">✓ المركز المالي متوازن</div>`
      : `<div style="padding:8px 14px;border-radius:8px;background:var(--yellow-dim);color:var(--yellow);font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px">⚠ فرق: ${fmt(bsDiff)} — تحقق من القيود المدخلة</div>`;
  }
}

/* ============================================================
   قائمة التدفقات النقدية (Cash Flow Statement)
   ============================================================ */
function renderCF() {
  const revenues   = S.accounts.filter(a => a.type === 'revenue');
  const expenses   = S.accounts.filter(a => ['expense', 'cogs'].includes(a.type));
  const fixedAssets = S.accounts.filter(a => a.type === 'asset' && a.subtype === 'fixed');
  const equity     = S.accounts.filter(a => a.type === 'equity');

  const totalRev  = revenues.reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const totalExp  = expenses.reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const netOper   = totalRev - totalExp;
  const netInv    = -fixedAssets.reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const netFin    = equity.reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);

  // التدفقات التشغيلية
  document.getElementById('cf-operating').innerHTML =
    `<div class="fs-row"><span>الإيرادات المحصّلة</span><span class="text-green">${fmt(totalRev)}</span></div>
     <div class="fs-row"><span>المصروفات المدفوعة</span><span class="text-red">(${fmt(totalExp)})</span></div>`;
  const cfOperEl = document.getElementById('cf-net-oper');
  cfOperEl.textContent = fmt(netOper);
  cfOperEl.className   = 'fw-800 ' + (netOper >= 0 ? 'text-green' : 'text-red');

  // التدفقات الاستثمارية
  document.getElementById('cf-investing').innerHTML =
    `<div class="fs-row"><span>الأصول الثابتة</span><span class="text-red">(${fmt(Math.abs(netInv))})</span></div>`;
  const cfInvEl = document.getElementById('cf-net-inv');
  cfInvEl.textContent = fmt(netInv);
  cfInvEl.className   = 'fw-800 ' + (netInv >= 0 ? 'text-green' : 'text-red');

  // التدفقات التمويلية
  document.getElementById('cf-financing').innerHTML =
    `<div class="fs-row"><span>رأس المال</span><span class="text-green">${fmt(netFin)}</span></div>`;
  const cfFinEl = document.getElementById('cf-net-fin');
  cfFinEl.textContent = fmt(netFin);
  cfFinEl.className   = 'fw-800 text-green';

  // صافي التغير في النقدية
  document.getElementById('cf-net-total').textContent = fmt(netOper + netInv + netFin);
}
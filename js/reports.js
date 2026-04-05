/* ============================================================
   reports.js — التقارير المالية
   يحتوي على: تقرير الأرباح والخسائر، تقرير المخزون،
   تقرير حركات الحسابات، تقرير العمر الزمني (Aging)،
   عرض لوحة التحكم (Dashboard)
   ============================================================ */

/* ============================================================
   لوحة التحكم (Dashboard)
   ============================================================ */
function renderDashboard() {
  const isLeaf = id => !S.accounts.some(a => a.parentId === id);

  // حساب المؤشرات الرئيسية
  const revenues = S.accounts.filter(a => a.type === 'revenue' && isLeaf(a.id))
    .reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const expenses = S.accounts.filter(a => ['expense', 'cogs'].includes(a.type) && isLeaf(a.id))
    .reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const net        = revenues - expenses;
  const totalSales = S.invoices.filter(i => i.type === 'sale')    .reduce((s, i) => s + i.total, 0);
  const totalPurch = S.invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + i.total, 0);

  // تحديث بطاقات المؤشرات
  document.getElementById('kpi-revenue').textContent  = fmt(revenues);
  document.getElementById('kpi-expenses').textContent = fmt(expenses);
  document.getElementById('kpi-entries').textContent  = S.journalEntries.length;
  document.getElementById('kpi-sales').textContent    = fmt(totalSales);
  document.getElementById('kpi-purch').textContent    = fmt(totalPurch);

  const netEl = document.getElementById('kpi-net');
  netEl.textContent = fmt(Math.abs(net));
  netEl.className   = 'kpi-value ' + (net >= 0 ? 'text-green' : 'text-red');

  // آخر القيود (5 قيود)
  const eb     = document.getElementById('dash-entries-body');
  const recent = [...S.journalEntries].reverse().slice(0, 5);
  eb.innerHTML = recent.length
    ? recent.map(e => `<tr>
        <td>${e.date}</td>
        <td>${escH(e.desc)}</td>
        <td class="fw-800 text-accent">${fmt(e.debitTotal)}</td>
      </tr>`).join('')
    : '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📝</div><p>لا قيود</p></div></td></tr>';

  // آخر الفواتير (5 فواتير)
  const ib        = document.getElementById('dash-invoices-body');
  const recentInv = [...S.invoices].reverse().slice(0, 5);
  ib.innerHTML = recentInv.length
    ? recentInv.map(i => `<tr>
        <td class="fw-800">${i.number}</td>
        <td><span class="badge ${i.type === 'sale' ? 'badge-green' : 'badge-blue'}">${i.type === 'sale' ? 'مبيعات' : 'مشتريات'}</span></td>
        <td class="fw-800">${fmt(i.total)}</td>
      </tr>`).join('')
    : '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">🧾</div><p>لا فواتير</p></div></td></tr>';

  // تنبيهات المخزون المنخفض
  const low = S.inventory.filter(i => (i.qty || 0) <= (i.minQty || 0));
  const al  = document.getElementById('dash-inventory-alerts');
  al.innerHTML = low.length
    ? low.map(i => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:var(--yellow-dim);border-radius:7px;margin-bottom:5px">
          <span style="color:var(--yellow)">⚠</span>
          <span style="font-size:12.5px;font-weight:600">${escH(i.name)}</span>
          <span class="badge badge-yellow">الكمية: ${i.qty} | الحد: ${i.minQty}</span>
        </div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">✅</div><p>لا تنبيهات</p></div>';
}

/* ============================================================
   تقرير الأرباح والخسائر (Profit & Loss Report)
   ============================================================ */
function renderProfitReport() {
  const isLeaf = id => !S.accounts.some(a => a.parentId === id);

  const tRev  = S.accounts.filter(a => a.type === 'revenue' && isLeaf(a.id)).reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const tCogs = S.accounts.filter(a => a.type === 'cogs'    && isLeaf(a.id)).reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const tExp  = S.accounts.filter(a => a.type === 'expense' && isLeaf(a.id)).reduce((s, a) => s + Math.abs(getNetBalance(a.id)), 0);
  const gross = tRev - tCogs;
  const net   = gross - tExp;

  document.getElementById('profit-report').innerHTML = `
    <div style="max-width:500px">
      <div class="fs-row" style="font-weight:700;font-size:13px">
        <span>إجمالي الإيرادات</span>
        <span class="text-green">${fmt(tRev)}</span>
      </div>
      <div class="fs-row">
        <span>تكلفة المبيعات</span>
        <span class="text-red">(${fmt(tCogs)})</span>
      </div>
      <div class="fs-row fs-total">
        <span>مجمل الربح</span>
        <span class="${gross >= 0 ? 'text-green' : 'text-red'}">${fmt(gross)}</span>
      </div>
      <div class="fs-row" style="margin-top:7px">
        <span>المصروفات التشغيلية</span>
        <span class="text-red">(${fmt(tExp)})</span>
      </div>
      <div class="fs-row" style="background:var(--accent-glow);border-radius:8px;padding:11px;margin-top:8px;font-size:15px;font-weight:900;border:1px solid var(--accent)">
        <span>صافي الربح/الخسارة</span>
        <span class="${net >= 0 ? 'text-green' : 'text-red'}">${fmt(Math.abs(net))} ${net >= 0 ? 'ربح' : 'خسارة'}</span>
      </div>
      ${tRev > 0 ? `
        <div class="fs-row" style="font-size:11.5px;color:var(--text3);margin-top:7px">
          <span>هامش الربح الإجمالي</span>
          <span>${((gross / tRev) * 100).toFixed(1)}%</span>
        </div>
        <div class="fs-row" style="font-size:11.5px;color:var(--text3)">
          <span>هامش صافي الربح</span>
          <span>${((net / tRev) * 100).toFixed(1)}%</span>
        </div>` : ''}
    </div>`;
}

/* ============================================================
   تقرير المخزون (Inventory Report)
   ============================================================ */
function renderInventoryReport() {
  const totalCost  = S.inventory.reduce((s, i) => s + (i.qty || 0) * (i.cost  || 0), 0);
  const totalSaleV = S.inventory.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);

  document.getElementById('inventory-report').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
      <div class="kpi-card blue" style="padding:12px 16px">
        <div class="kpi-label">إجمالي الأصناف</div>
        <div class="kpi-value text-accent" style="font-size:22px">${S.inventory.length}</div>
      </div>
      <div class="kpi-card green" style="padding:12px 16px">
        <div class="kpi-label">قيمة المخزون (تكلفة)</div>
        <div class="kpi-value text-green" style="font-size:18px">${fmt(totalCost)}</div>
      </div>
      <div class="kpi-card purple" style="padding:12px 16px">
        <div class="kpi-label">قيمة البيع المتوقعة</div>
        <div class="kpi-value" style="font-size:18px;color:var(--purple)">${fmt(totalSaleV)}</div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الصنف</th><th>الكمية</th><th>تكلفة الوحدة</th>
            <th>سعر البيع</th><th>القيمة الكلية</th><th>هامش الربح</th>
          </tr>
        </thead>
        <tbody>
          ${S.inventory.map(i => {
            const margin = i.price > 0 ? ((i.price - i.cost) / i.price * 100).toFixed(1) + '%' : '—';
            return `<tr>
              <td class="fw-800">${escH(i.name)}</td>
              <td>${i.qty} ${i.unit || ''}</td>
              <td>${fmt(i.cost)}</td>
              <td>${fmt(i.price)}</td>
              <td class="fw-800 text-accent">${fmt((i.qty || 0) * (i.cost || 0))}</td>
              <td class="${i.price > i.cost ? 'text-green' : 'text-red'}">${margin}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="6"><div class="empty-state"><p>لا بيانات</p></div></td></tr>'}
        </tbody>
      </table>
    </div>`;
}

/* ============================================================
   تقرير حركات الحسابات (Movements Report)
   ============================================================ */
function generateMovementsReport() {
  const from    = document.getElementById('rep-from').value;
  const to      = document.getElementById('rep-to').value;
  const entries = S.journalEntries.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
  const cont    = document.getElementById('movements-report');

  if (!entries.length) {
    cont.innerHTML = '<div class="empty-state"><p>لا توجد حركات في الفترة</p></div>';
    return;
  }

  cont.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>المدين</th><th>الدائن</th></tr>
        </thead>
        <tbody>
          ${entries.map(e => `<tr>
            <td>${e.date}</td>
            <td class="fw-800">${e.number}</td>
            <td>${escH(e.desc)}</td>
            <td class="text-green">${fmt(e.debitTotal)}</td>
            <td class="text-red">${fmt(e.creditTotal)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ============================================================
   تقرير العمر الزمني للذمم (Aging Report)
   ============================================================ */
function renderAgingReport() {
  const today   = new Date();
  const tbody   = document.getElementById('aging-body');
  const customers = S.contacts.filter(c => c.kind === 'customer');

  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>لا بيانات</p></div></td></tr>';
    return;
  }

  const rows = customers.map(c => {
    // فواتير آجلة غير مسددة
    const creditInvs = S.invoices.filter(i => i.contactId === c.id && i.type === 'sale' && i.payment === 'credit');
    if (!creditInvs.length) return '';

    let b0 = 0, b30 = 0, b60 = 0, b90 = 0;

    creditInvs.forEach(inv => {
      const invDate = new Date(inv.date);
      const days    = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));
      if      (days < 30)  b0  += inv.total;
      else if (days < 60)  b30 += inv.total;
      else if (days < 90)  b60 += inv.total;
      else                 b90 += inv.total;
    });

    const total = b0 + b30 + b60 + b90;
    if (total === 0) return '';

    return `<tr>
      <td class="fw-800">${escH(c.name)}</td>
      <td>${b0  > 0 ? fmt(b0)  : '—'}</td>
      <td>${b30 > 0 ? fmt(b30) : '—'}</td>
      <td>${b60 > 0 ? fmt(b60) : '—'}</td>
      <td class="${b90 > 0 ? 'text-red fw-800' : ''}">${b90 > 0 ? fmt(b90) : '—'}</td>
      <td class="fw-800 text-accent">${fmt(total)}</td>
    </tr>`;
  }).filter(Boolean).join('');

  tbody.innerHTML = rows || '<tr><td colspan="6"><div class="empty-state"><p>لا ذمم آجلة</p></div></td></tr>';
}

/* ============================================================
   تقرير الحساب (Account Report)
   فلتر ذكي: عملاء / موردون / حساب محدد + فترة زمنية
   ============================================================ */

/* ===== عند تغيير نوع التقرير — تحديث قائمة الاختيار التفصيلي ===== */
function onRaccTypeChange() {
  const type   = document.getElementById('racc-type').value;
  const label  = document.getElementById('racc-detail-label');
  const sel    = document.getElementById('racc-detail');

  if (!type) {
    sel.innerHTML = '<option value="">-- اختر أولاً --</option>';
    return;
  }

  if (type === 'customer') {
    label.textContent = 'العميل';
    const opts = S.contacts.filter(c => c.kind === 'customer')
      .map(c => `<option value="contact:${c.id}">${c.name}</option>`).join('');
    sel.innerHTML = '<option value="customer:all">📋 كل العملاء</option>' + opts;

  } else if (type === 'supplier') {
    label.textContent = 'المورد';
    const opts = S.contacts.filter(c => c.kind === 'supplier')
      .map(c => `<option value="contact:${c.id}">${c.name}</option>`).join('');
    sel.innerHTML = '<option value="supplier:all">📋 كل الموردين</option>' + opts;

  } else if (type === 'account') {
    label.textContent = 'الحساب';
    const opts = S.accounts
      .map(a => `<option value="account:${a.id}">${a.code} - ${a.name}</option>`).join('');
    sel.innerHTML = '<option value="account:all">📋 كل الحسابات</option>' + opts;
  }
}

/* ===== توليد التقرير ===== */
function generateAccountReport() {
  const type    = document.getElementById('racc-type').value;
  const detail  = document.getElementById('racc-detail').value;
  const scope   = document.getElementById('racc-scope').value;
  const from    = document.getElementById('racc-from').value;
  const to      = document.getElementById('racc-to').value;
  const cont    = document.getElementById('account-report-result');

  if (!type || !detail) {
    cont.innerHTML = '<div class="empty-state"><p>اختر نوع التقرير والتفاصيل أولاً</p></div>';
    return;
  }

  // تحديد الحسابات المطلوبة بناءً على الاختيار
  let targetAccountIds = [];
  let reportTitle      = '';

  if (detail === 'customer:all') {
    // كل حسابات الذمم المدينة
    targetAccountIds = S.accounts.filter(a => a.type === 'asset' && (a.code === '1030' || a.name.includes('عملاء') || a.name.includes('ذمم مدينة'))).map(a => a.id);
    reportTitle = 'تقرير كل العملاء';

  } else if (detail === 'supplier:all') {
    targetAccountIds = S.accounts.filter(a => a.type === 'liability' && (a.code === '2010' || a.name.includes('موردون') || a.name.includes('ذمم دائنة'))).map(a => a.id);
    reportTitle = 'تقرير كل الموردين';

  } else if (detail.startsWith('contact:')) {
    const contactId = detail.split(':')[1];
    const contact   = S.contacts.find(c => c.id === contactId);
    if (!contact) { cont.innerHTML = '<div class="empty-state"><p>لم يُوجد الطرف</p></div>'; return; }
    reportTitle = (contact.kind === 'customer' ? 'تقرير العميل: ' : 'تقرير المورد: ') + contact.name;
    // جمع الفواتير المرتبطة بهذا الطرف وقيودها
    const invs  = S.invoices.filter(i => i.contactId === contactId);
    const jIds  = invs.map(i => i.journalId).filter(Boolean);
    cont.innerHTML = buildContactReport(contact, invs, jIds, from, to, scope, reportTitle);
    return;

  } else if (detail === 'account:all') {
    targetAccountIds = S.accounts.map(a => a.id);
    reportTitle = 'تقرير كل الحسابات';

  } else if (detail.startsWith('account:')) {
    const accId = detail.split(':')[1];
    targetAccountIds = [accId];
    const acc   = S.accounts.find(a => a.id === accId);
    reportTitle = 'تقرير الحساب: ' + (acc ? acc.code + ' - ' + acc.name : '');
  }

  cont.innerHTML = buildAccountsReport(targetAccountIds, from, to, scope, reportTitle);
}

/* ===== بناء تقرير الحسابات العامة ===== */
function buildAccountsReport(accountIds, from, to, scope, title) {
  if (!accountIds.length) return '<div class="empty-state"><p>لا توجد حسابات مطابقة</p></div>';

  let totalDr = 0, totalCr = 0;
  let sectionsHTML = '';

  accountIds.forEach(accId => {
    const acc = S.accounts.find(a => a.id === accId);
    if (!acc) return;

    // جمع الحركات مع الفلتر
    const lines = [];
    S.journalEntries.forEach(e => {
      if (from && e.date < from) return;
      if (to   && e.date > to)   return;
      e.lines.filter(l => l.accountId === accId).forEach(l => {
        if (scope === 'debit'  && !(l.debit  > 0)) return;
        if (scope === 'credit' && !(l.credit > 0)) return;
        lines.push({ date: e.date, ref: e.number, desc: e.desc, debit: l.debit || 0, credit: l.credit || 0 });
      });
    });

    if (!lines.length && !(acc.opening > 0)) return;
    lines.sort((a, b) => a.date.localeCompare(b.date));

    const debitNature = isDebitNature(acc);
    let running = acc.opening || 0;
    let secDr = 0, secCr = 0;

    const rows = lines.map(l => {
      running += debitNature ? (l.debit - l.credit) : (l.credit - l.debit);
      secDr += l.debit; secCr += l.credit;
      totalDr += l.debit; totalCr += l.credit;
      const sign = running >= 0 ? 'مدين' : 'دائن';
      return `<tr>
        <td>${l.date}</td>
        <td class="text-muted">${l.ref}</td>
        <td>${escH(l.desc)}</td>
        <td class="text-green">${l.debit  > 0 ? fmt(l.debit)  : ''}</td>
        <td class="text-red">${l.credit  > 0 ? fmt(l.credit) : ''}</td>
        <td class="fw-800 ${running >= 0 ? 'text-accent' : 'text-red'}">${fmt(Math.abs(running))} ${sign}</td>
      </tr>`;
    }).join('');

    if (!rows && !(acc.opening > 0)) return;

    sectionsHTML += `
      <div class="ledger-card" style="margin-bottom:14px">
        <div class="ledger-header">
          <span class="ledger-account-name">${escH(acc.name)}</span>
          <span class="ledger-code">${acc.code}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
            <tbody>
              ${acc.opening > 0 ? `<tr><td>—</td><td>—</td><td>رصيد افتتاحي</td><td class="text-green">${fmt(acc.opening)}</td><td></td><td class="fw-800 text-accent">${fmt(acc.opening)}</td></tr>` : ''}
              ${rows || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:12px">لا حركات في هذه الفترة</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  });

  if (!sectionsHTML) return '<div class="empty-state"><div class="empty-icon">📋</div><p>لا توجد حركات في الفترة المحددة</p></div>';

  return `
    <!-- رأس التقرير -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-weight:800;font-size:14px">${escH(title)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${from || '—'} ← ${to || '—'}</div>
      </div>
      <div style="display:flex;gap:16px">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">إجمالي المدين</div>
          <div style="font-weight:800;color:var(--green)">${fmt(totalDr)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">إجمالي الدائن</div>
          <div style="font-weight:800;color:var(--red)">${fmt(totalCr)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">الرصيد</div>
          <div style="font-weight:800;color:var(--accent2)">${fmt(Math.abs(totalDr - totalCr))}</div>
        </div>
      </div>
    </div>
    ${sectionsHTML}`;
}

/* ===== بناء كشف حساب العميل / المورد ===== */
function buildContactReport(contact, invs, jIds, from, to, scope, title) {
  const isCustomer = contact.kind === 'customer';

  // جمع كل حركات القيود المرتبطة بفواتير هذا الطرف
  const lines = [];
  S.journalEntries.forEach(e => {
    if (!jIds.includes(e.id)) return;
    if (from && e.date < from) return;
    if (to   && e.date > to)   return;
    // نبحث عن حساب الذمم المدينة أو الدائنة في القيد
    e.lines.forEach(l => {
      const acc = S.accounts.find(a => a.id === l.accountId);
      if (!acc) return;
      // للعميل: نعرض حركات حساب الذمم المدينة (أصل)
      // للمورد: نعرض حركات حساب الموردين (خصم)
      const relevant = isCustomer
        ? (acc.type === 'asset'     && (acc.code === '1030' || acc.name.includes('عملاء') || acc.name.includes('ذمم مدينة')))
        : (acc.type === 'liability' && (acc.code === '2010' || acc.name.includes('موردون') || acc.name.includes('ذمم دائنة')));
      if (relevant) {
        lines.push({
          date   : e.date,
          ref    : e.number,
          desc   : e.desc,
          debit  : l.debit  || 0,
          credit : l.credit || 0,
        });
      }
    });
  });

  // إذا لم توجد حركات في القيود → استخدم بيانات الفواتير مباشرة
  const useInvFallback = lines.length === 0;
  const filtered = invs.filter(i => {
    if (from && i.date < from) return false;
    if (to   && i.date > to)   return false;
    return true;
  });

  const allLines = useInvFallback
    ? filtered.map(i => ({
        date  : i.date,
        ref   : i.number,
        desc  : (isCustomer ? 'فاتورة مبيعات' : 'فاتورة مشتريات') + ' – ' + i.number,
        debit : isCustomer ? i.total : 0,
        credit: isCustomer ? 0 : i.total,
      }))
    : lines;

  allLines.sort((a, b) => a.date.localeCompare(b.date));

  // حساب الرصيد التراكمي
  let running = 0;
  let totalDr = 0, totalCr = 0;

  const rows = allLines.map(l => {
    // للعميل: طبيعة مدينة (مدين يزيد الرصيد)
    // للمورد: طبيعة دائنة (دائن يزيد الرصيد)
    running += isCustomer ? (l.debit - l.credit) : (l.credit - l.debit);
    totalDr += l.debit;
    totalCr += l.credit;
    const balLabel = running >= 0 ? (isCustomer ? 'مدين' : 'دائن') : (isCustomer ? 'دائن' : 'مدين');
    const balClass = running >= 0 ? 'text-accent' : 'text-red';
    return `<tr>
      <td>${l.date}</td>
      <td class="fw-800 text-muted">${l.ref}</td>
      <td>${escH(l.desc)}</td>
      <td class="text-green fw-800">${l.debit  > 0 ? fmt(l.debit)  : '—'}</td>
      <td class="text-red fw-800">${l.credit  > 0 ? fmt(l.credit) : '—'}</td>
      <td class="fw-800 ${balClass}">${fmt(Math.abs(running))} <span style="font-size:10px;font-weight:600">${balLabel}</span></td>
    </tr>`;
  }).join('');

  if (!rows) return '<div class="empty-state"><div class="empty-icon">📋</div><p>لا حركات في هذه الفترة</p></div>';

  // الرصيد النهائي
  const finalBalance  = Math.abs(running);
  const balanceLabel  = running > 0
    ? (isCustomer ? '🔴 مستحق على العميل' : '🔴 مستحق للمورد')
    : running < 0
    ? (isCustomer ? '🟢 رصيد دائن للعميل' : '🟢 رصيد مدفوع زيادة')
    : '✅ الحساب صفر';
  const balanceColor  = running !== 0 ? (running > 0 ? 'var(--red)' : 'var(--green)') : 'var(--green)';

  return `
    <!-- رأس كشف الحساب (يظهر عند الطباعة) -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <!-- بيانات الطرف -->
        <div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${isCustomer ? 'كشف حساب عميل' : 'كشف حساب مورد'}</div>
          <div style="font-weight:900;font-size:16px">${escH(contact.name)}</div>
          ${contact.phone  ? `<div style="font-size:11.5px;color:var(--text2);margin-top:3px">📞 ${contact.phone}</div>`  : ''}
          ${contact.taxNo  ? `<div style="font-size:11.5px;color:var(--text2)">رقم ضريبي: ${contact.taxNo}</div>`        : ''}
          ${contact.address? `<div style="font-size:11.5px;color:var(--text2)">📍 ${escH(contact.address)}</div>`         : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:4px">الفترة: ${from || 'البداية'} — ${to || 'اليوم'}</div>
        </div>
        <!-- ملخص الأرقام -->
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="text-align:center;background:var(--surface3);border-radius:8px;padding:10px 16px;min-width:90px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">إجمالي المدين</div>
            <div style="font-weight:800;color:var(--green);font-size:14px">${fmt(totalDr)}</div>
          </div>
          <div style="text-align:center;background:var(--surface3);border-radius:8px;padding:10px 16px;min-width:90px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">إجمالي الدائن</div>
            <div style="font-weight:800;color:var(--red);font-size:14px">${fmt(totalCr)}</div>
          </div>
          <div style="text-align:center;background:var(--surface2);border:2px solid ${balanceColor};border-radius:8px;padding:10px 16px;min-width:110px">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">الرصيد النهائي</div>
            <div style="font-weight:900;color:${balanceColor};font-size:15px">${fmt(finalBalance)}</div>
            <div style="font-size:9.5px;font-weight:700;color:${balanceColor};margin-top:2px">${balanceLabel}</div>
          </div>
        </div>
      </div>
    </div>
    <!-- جدول الحركات -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>المرجع</th>
            <th>البيان</th>
            <th>مدين</th>
            <th>دائن</th>
            <th>الرصيد</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--surface2);font-weight:800;border-top:2px solid var(--border2)">
            <td colspan="3" style="padding:9px 11px">الإجمالي</td>
            <td style="padding:9px 11px;color:var(--green)">${fmt(totalDr)}</td>
            <td style="padding:9px 11px;color:var(--red)">${fmt(totalCr)}</td>
            <td style="padding:9px 11px;color:${balanceColor}">${fmt(finalBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}
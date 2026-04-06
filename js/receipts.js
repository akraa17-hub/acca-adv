/* ============================================================
   receipts.js — سندات القبض والصرف
   يحتوي على: فتح/حفظ/حذف السند، ربط السند بالفاتورة،
   القيد التلقائي، عرض جداول القبض والصرف
   ============================================================ */

/* ============================================================
   نافذة السند (Receipt Modal)
   ============================================================ */
function openReceiptModal(type, invoiceId = null) {
  S._receiptType = type; // 'receipt' قبض | 'payment' صرف
  S._edit        = 'new';
  S._editId      = null;

  const isReceipt = type === 'receipt';
  document.getElementById('receipt-modal-title').textContent =
    isReceipt ? 'سند قبض جديد' : 'سند صرف جديد';

  // تفريغ الحقول
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('rec-date').value   = today;
  document.getElementById('rec-amount').value = '';
  document.getElementById('rec-notes').value  = '';
  document.getElementById('rec-number').value =
    (isReceipt ? 'REC-' : 'PAY-') +
    String(S.receipts.filter(r => r.type === type).length + 1).padStart(4, '0');

  // قائمة الأطراف (عملاء أو موردون)
  const contacts = S.contacts.filter(c =>
    c.kind === (isReceipt ? 'customer' : 'supplier'));
  const partySel = document.getElementById('rec-party-select');
  partySel.innerHTML = '<option value="">-- اختر --</option>' +
    contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // قائمة حسابات الدفع (الحسابات التي عليها علامة حساب دفع)
  const payAccs = S.accounts.filter(a => a.isPayment === true);
  const payAccSel = document.getElementById('rec-pay-account');
  payAccSel.innerHTML = '<option value="">-- اختر حساب الدفع --</option>' +
    payAccs.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('');

  // قائمة الفواتير الآجلة غير المسددة
  const unpaidInvs = S.invoices.filter(i =>
    i.type === (isReceipt ? 'sale' : 'purchase') &&
    i.payment === 'credit' &&
    !i.settled
  );
  const invSel = document.getElementById('rec-invoice-select');
  invSel.innerHTML = '<option value="">-- بدون فاتورة (سند مستقل) --</option>' +
    unpaidInvs.map(i =>
      `<option value="${i.id}" data-amount="${i.total}">${i.number} — ${escH(i.partyName)} — ${fmt(i.total)}</option>`
    ).join('');

  // إذا فُتح من فاتورة محددة → تعبئة تلقائية
  if (invoiceId) {
    invSel.value = invoiceId;
    const inv = S.invoices.find(i => i.id === invoiceId);
    if (inv) {
      document.getElementById('rec-amount').value = inv.total;
      if (inv.contactId) partySel.value = inv.contactId;
    }
  }

  document.getElementById('rec-party-label').textContent = isReceipt ? 'العميل' : 'المورد';
  openModal('receipt-modal');
}

/* ===== عند اختيار فاتورة — تعبئة المبلغ والطرف تلقائياً ===== */
function onReceiptInvoiceSelect() {
  const sel    = document.getElementById('rec-invoice-select');
  const opt    = sel.options[sel.selectedIndex];
  const amount = opt.getAttribute('data-amount');
  const invId  = sel.value;
  if (invId && amount) {
    document.getElementById('rec-amount').value = amount;
    const inv = S.invoices.find(i => i.id === invId);
    if (inv && inv.contactId)
      document.getElementById('rec-party-select').value = inv.contactId;
  }
}

/* ============================================================
   حفظ السند
   ============================================================ */
function saveReceipt() {
  const type      = S._receiptType;
  const number    = document.getElementById('rec-number').value;
  const date      = document.getElementById('rec-date').value;
  const amount    = parseFloat(document.getElementById('rec-amount').value || 0);
  const contactId = document.getElementById('rec-party-select').value;
  const payAccId  = document.getElementById('rec-pay-account').value;
  const invoiceId = document.getElementById('rec-invoice-select').value || null;
  const notes     = document.getElementById('rec-notes').value.trim();

  if (!date)       { showToast('يرجى اختيار التاريخ', 'error');       return; }
  if (amount <= 0) { showToast('يرجى إدخال المبلغ', 'error');         return; }
  if (!payAccId)   { showToast('يرجى اختيار حساب الدفع', 'error');    return; }

  const contact   = contactId ? S.contacts.find(c => c.id === contactId) : null;
  const partyName = contact ? contact.name : 'غير محدد';
  const payAcc    = S.accounts.find(a => a.id === payAccId);

  // ─── القيد التلقائي ──────────────────────────────────────
  const jLines = buildReceiptJournal(type, amount, payAccId, contactId);
  const jEntry = {
    id:            uid(),
    number:        'JE-' + String(S.journalEntries.length + 1).padStart(4, '0'),
    date,
    desc:          (type === 'receipt' ? 'سند قبض' : 'سند صرف') + ' – ' + number + ' – ' + partyName,
    ref:           number,
    lines:         jLines,
    debitTotal:    jLines.reduce((s, l) => s + l.debit,  0),
    creditTotal:   jLines.reduce((s, l) => s + l.credit, 0),
    status:        'تلقائي',
    autoGenerated: true,
  };
  S.journalEntries.push(jEntry);

  // ─── حفظ السند ───────────────────────────────────────────
  const receipt = {
    id: uid(), number, date, type,
    amount, contactId, partyName,
    payAccountId:   payAccId,
    payAccountName: payAcc ? payAcc.name : '',
    invoiceId, notes,
    journalId: jEntry.id,
  };
  S.receipts.push(receipt);

  // ─── تسديد الفاتورة المرتبطة ─────────────────────────────
  if (invoiceId) {
    const invIdx = S.invoices.findIndex(i => i.id === invoiceId);
    if (invIdx > -1) {
      S.invoices[invIdx].settled   = true;
      S.invoices[invIdx].settledBy = receipt.id;
    }
  }

  save();
  closeModal('receipt-modal');
  updateAll();
  showToast((type === 'receipt' ? 'تم حفظ سند القبض' : 'تم حفظ سند الصرف') + ' ✓', 'success');
}

/* ============================================================
   بناء القيد التلقائي للسند
   ============================================================ */
function buildReceiptJournal(type, amount, payAccId, contactId) {
  const payAcc = S.accounts.find(a => a.id === payAccId);
  const ar     = S.accounts.find(a => a.code === '1030'); // ذمم مدينة
  const ap     = S.accounts.find(a => a.code === '2010'); // ذمم دائنة
  const lines  = [];

  if (type === 'receipt') {
    // سند قبض: مدين الصندوق/البنك ← دائن الذمم المدينة
    if (payAcc) lines.push({ accountId: payAcc.id, desc: 'استلام نقدي – سند قبض', debit: amount, credit: 0 });
    if (ar)     lines.push({ accountId: ar.id,     desc: 'تحصيل ذمم مدينة',       debit: 0, credit: amount });
  } else {
    // سند صرف: مدين الذمم الدائنة ← دائن الصندوق/البنك
    if (ap)     lines.push({ accountId: ap.id,     desc: 'سداد للمورد – سند صرف', debit: amount, credit: 0 });
    if (payAcc) lines.push({ accountId: payAcc.id, desc: 'صرف نقدي',              debit: 0, credit: amount });
  }

  return lines;
}

/* ============================================================
   حذف السند
   ============================================================ */
function deleteReceipt(id) {
  const rec = S.receipts.find(r => r.id === id);
  if (!confirm('هل تريد حذف هذا السند وقيده التلقائي؟')) return;

  // إعادة فتح الفاتورة المرتبطة
  if (rec && rec.invoiceId) {
    const invIdx = S.invoices.findIndex(i => i.id === rec.invoiceId);
    if (invIdx > -1) {
      S.invoices[invIdx].settled   = false;
      S.invoices[invIdx].settledBy = null;
    }
  }

  // حذف القيد التلقائي
  if (rec && rec.journalId)
    S.journalEntries = S.journalEntries.filter(e => e.id !== rec.journalId);

  S.receipts = S.receipts.filter(r => r.id !== id);
  save();
  updateAll();
  showToast('تم الحذف', 'success');
}

/* ============================================================
   عرض جداول السندات (Render)
   ============================================================ */
function renderReceipts() {
  _renderReceiptTable('receipt', 'receipts-body');
  _renderReceiptTable('payment', 'payments-body');
}

function _renderReceiptTable(type, bodyId) {
  const tbody     = document.getElementById(bodyId);
  if (!tbody) return;
  const isReceipt = type === 'receipt';
  const list      = S.receipts.filter(r => r.type === type);

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">${isReceipt ? '💰' : '💸'}</div>
      <p>${isReceipt ? 'لا سندات قبض' : 'لا سندات صرف'}</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = [...list].reverse().map(r => {
    const inv = r.invoiceId ? S.invoices.find(i => i.id === r.invoiceId) : null;
    return `<tr>
      <td class="fw-800 text-accent">${r.number}</td>
      <td>${r.date}</td>
      <td class="fw-800">${escH(r.partyName || '—')}</td>
      <td class="fw-800 ${isReceipt ? 'text-green' : 'text-red'}">${fmt(r.amount)}</td>
      <td class="text-muted">${escH(r.payAccountName || '—')}</td>
      <td>${inv
        ? `<span class="badge badge-blue">${inv.number}</span>`
        : '<span class="text-muted" style="font-size:11px">مستقل</span>'}</td>
      <td>${r.notes ? escH(r.notes) : '—'}</td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteReceipt('${r.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ============================================================
   فتح سند من زر التسديد على الفاتورة
   ============================================================ */
function openSettleInvoice(invoiceId) {
  const inv = S.invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  openReceiptModal(inv.type === 'sale' ? 'receipt' : 'payment', invoiceId);
}

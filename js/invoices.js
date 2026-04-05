/* ============================================================
   invoices.js — فواتير المبيعات والمشتريات
   يحتوي على: فتح نافذة الفاتورة، إضافة/حذف سطر، حساب الإجماليات،
   بناء القيد التلقائي، حفظ/حذف الفاتورة، طباعة الفاتورة،
   عرض جداول المبيعات والمشتريات
   ============================================================ */

/* ============================================================
   نافذة الفاتورة (Invoice Modal)
   ============================================================ */
function openInvoiceModal(type, id = null) {
  S._invType = type;
  S._edit    = id ? 'edit' : 'new';
  S._editId  = id;

  document.getElementById('invoice-modal-title').textContent =
    id ? 'تعديل الفاتورة' : (type === 'sale' ? 'فاتورة مبيعات جديدة' : 'فاتورة مشتريات جديدة');
  document.getElementById('inv-party-label').textContent = type === 'sale' ? 'العميل *' : 'المورد *';

  // تفريغ السطور
  document.getElementById('inv-lines').innerHTML = '';
  invLineCount = 0;

  // حقول الفاتورة
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inv-date').value  = today;
  document.getElementById('inv-notes').value = '';

  // بناء قائمة الأطراف (عملاء أو موردون)
  const contacts = S.contacts.filter(c => c.kind === (type === 'sale' ? 'customer' : 'supplier'));
  const sel = document.getElementById('inv-party-select');
  sel.innerHTML = '<option value="">-- اختر --</option>' +
    contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // بناء قائمة حسابات الدفع (الحسابات التي عليها علامة "حساب دفع")
  const payAccounts = S.accounts.filter(a => a.isPayment === true);
  const paySelEl = document.getElementById('inv-pay-account');
  paySelEl.innerHTML = '<option value="">-- اختر حساب الدفع --</option>' +
    payAccounts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('');

  // رقم الفاتورة التلقائي
  const prefix  = type === 'sale' ? 'INV-' : 'PUR-';
  const nextNum = prefix + String(S.invoices.filter(i => i.type === type).length + 1).padStart(4, '0');
  document.getElementById('inv-number').value = nextNum;

  // تعبئة البيانات عند التعديل
  if (id) {
    const inv = S.invoices.find(i => i.id === id);
    if (inv) {
      document.getElementById('inv-number').value              = inv.number;
      document.getElementById('inv-date').value                = inv.date;
      document.getElementById('inv-party-select').value        = inv.contactId || '';
      document.getElementById('inv-payment').value             = inv.payment;
      document.getElementById('inv-pay-account').value         = inv.payAccountId || '';
      document.getElementById('inv-notes').value               = inv.notes || '';
      inv.lines.forEach(l => addInvoiceLine(l));
    }
  } else {
    addInvoiceLine(); // سطر افتراضي واحد
  }

  updateInvoiceTotals();
  openModal('invoice-modal');
}

/* ===== اختيار طرف من القائمة ===== */
function onPartySelect() { /* placeholder — يمكن ربطه بمعلومات الطرف لاحقاً */ }

/* ===== إضافة سطر صنف في الفاتورة ===== */
function addInvoiceLine(data = null) {
  const tbody = document.getElementById('inv-lines');
  const id2   = 'invl-' + (++invLineCount);

  // بناء قائمة أصناف المخزون
  const items = S.inventory.map(i =>
    `<option value="${i.id}" data-price="${i.price || 0}" data-cost="${i.cost || 0}" ${data && data.itemId === i.id ? 'selected' : ''}>${i.name}</option>`
  ).join('');

  const tr = document.createElement('tr');
  tr.id = id2;
  tr.innerHTML = `
    <td>
      <select class="invl-item" onchange="onInvItem(this)">
        <option value="">-- يدوي --</option>${items}
      </select>
      <input type="text" class="invl-desc" value="${data ? escH(data.desc || '') : ''}" placeholder="وصف الصنف أو الخدمة" style="margin-top:3px">
    </td>
    <td><input type="number" class="invl-qty"   value="${data ? data.qty   : 1}" min="0.001" step="any"  oninput="updateInvoiceTotals()"></td>
    <td><input type="number" class="invl-price" value="${data ? data.price : 0}" min="0"     step="0.01" oninput="updateInvoiceTotals()"></td>
    <td><input type="number" class="invl-disc"  value="${data ? data.disc  : 0}" min="0" max="100" step="0.01" oninput="updateInvoiceTotals()"></td>
    <td class="invl-total fw-800" style="white-space:nowrap">${data ? fmt(data.total || 0) : '0.00'}</td>
    <td><button class="btn btn-danger btn-sm" onclick="document.getElementById('${id2}').remove();updateInvoiceTotals()">✕</button></td>`;

  tbody.appendChild(tr);
  updateInvoiceTotals();
}

/* ===== تعبئة سعر الصنف تلقائياً من المخزون ===== */
function onInvItem(sel) {
  const opt   = sel.options[sel.selectedIndex];
  const price = parseFloat(opt.getAttribute('data-price') || 0);
  if (price > 0) sel.closest('tr').querySelector('.invl-price').value = price;
  updateInvoiceTotals();
}

/* ===== حساب إجماليات الفاتورة ===== */
function updateInvoiceTotals() {
  let sub = 0;
  document.querySelectorAll('#inv-lines tr').forEach(tr => {
    const qty   = parseFloat(tr.querySelector('.invl-qty')?.value   || 0);
    const price = parseFloat(tr.querySelector('.invl-price')?.value || 0);
    const disc  = parseFloat(tr.querySelector('.invl-disc')?.value  || 0);
    const total = qty * price * (1 - disc / 100);
    const td    = tr.querySelector('.invl-total');
    if (td) td.textContent = fmt(total);
    sub += total;
  });

  const vat    = S.settings.vat || 15;
  const vatAmt = sub * vat / 100;

  document.getElementById('inv-subtotal').textContent   = fmt(sub);
  document.getElementById('inv-vat-label').textContent  = `ضريبة القيمة المضافة (${vat}%)`;
  document.getElementById('inv-vat-amount').textContent = fmt(vatAmt);
  document.getElementById('inv-total').textContent      = fmt(sub + vatAmt);
}

/* ============================================================
   حفظ الفاتورة
   ============================================================ */
function saveInvoice() {
  const number    = document.getElementById('inv-number').value;
  const date      = document.getElementById('inv-date').value;
  const contactId = document.getElementById('inv-party-select').value;
  const payment      = document.getElementById('inv-payment').value;
  const payAccountId = document.getElementById('inv-pay-account').value || null;
  const notes        = document.getElementById('inv-notes').value.trim();

  if (!date) { showToast('يرجى اختيار التاريخ', 'error'); return; }

  // جمع سطور الفاتورة
  const lines = [];
  document.querySelectorAll('#inv-lines tr').forEach(tr => {
    const itemId    = tr.querySelector('.invl-item')?.value  || '';
    const desc      = tr.querySelector('.invl-desc')?.value  || '';
    const qty       = parseFloat(tr.querySelector('.invl-qty')?.value   || 0);
    const price     = parseFloat(tr.querySelector('.invl-price')?.value || 0);
    const disc      = parseFloat(tr.querySelector('.invl-disc')?.value  || 0);
    const total     = qty * price * (1 - disc / 100);
    const itemCost  = itemId ? (S.inventory.find(i => i.id === itemId)?.cost || 0) : 0;
    const itemName  = itemId ? (S.inventory.find(i => i.id === itemId)?.name || '') : '';
    if (qty > 0 && price > 0)
      lines.push({ itemId, desc: desc || itemName || 'خدمة', qty, price, disc, total, itemCost });
  });

  if (lines.length === 0) { showToast('أضف أصناف للفاتورة', 'error'); return; }

  const contact   = contactId ? S.contacts.find(c => c.id === contactId) : null;
  const partyName = contact ? contact.name : 'غير محدد';
  const sub       = lines.reduce((s, l) => s + l.total, 0);
  const vat       = S.settings.vat || 15;
  const vatAmt    = sub * vat / 100;
  const total     = sub + vatAmt;

  const isEdit = S._edit === 'edit' && S._editId;
  const oldInv = isEdit ? S.invoices.find(i => i.id === S._editId) : null;

  // ─── تحديث المخزون ───────────────────────────────────────────────
  if (isEdit && oldInv) {
    // عكس تأثير الفاتورة القديمة على المخزون
    oldInv.lines.forEach(l => {
      if (l.itemId) {
        const item = S.inventory.find(i => i.id === l.itemId);
        if (item) {
          if (oldInv.type === 'sale') item.qty += l.qty;
          else item.qty = Math.max(0, item.qty - l.qty);
        }
      }
    });
  }

  // تطبيق تأثير الفاتورة الجديدة على المخزون
  lines.forEach(l => {
    if (l.itemId) {
      const item = S.inventory.find(i => i.id === l.itemId);
      if (item) {
        if (S._invType === 'sale') {
          // مبيعات: نقص الكمية، واحفظ تكلفة الوحدة الحالية في السطر (للقيد التلقائي)
          item.qty = Math.max(0, item.qty - l.qty);
        } else {
          // مشتريات: زيادة الكمية + تحديث تكلفة الوحدة (متوسط متحرك)
          const oldQty   = item.qty;
          const oldCost  = item.cost || 0;
          const newQty   = oldQty + l.qty;
          // معادلة المتوسط المتحرك: (تكلفة قديمة × كمية قديمة + تكلفة جديدة × كمية جديدة) / إجمالي الكمية
          item.cost = newQty > 0 ? ((oldCost * oldQty) + (l.price * l.qty)) / newQty : l.price;
          item.qty  = newQty;
          // تحديث سعر البيع فقط إذا كان 0 (لم يُحدد مسبقاً)
          if (!item.price || item.price === 0) item.price = l.price;
        }
      }
    }
  });

  // ─── القيد التلقائي ──────────────────────────────────────────────
  const jLines = buildInvoiceJournal(S._invType, lines, sub, vatAmt, total, payment, payAccountId, date, number);

  let journalId = null;
  if (isEdit && oldInv && oldInv.journalId) {
    // تحديث القيد التلقائي الموجود
    const jIdx = S.journalEntries.findIndex(e => e.id === oldInv.journalId);
    if (jIdx > -1) {
      S.journalEntries[jIdx] = {
        ...S.journalEntries[jIdx],
        date,
        lines: jLines,
        debitTotal:  jLines.reduce((s, l) => s + l.debit,  0),
        creditTotal: jLines.reduce((s, l) => s + l.credit, 0),
        desc: (S._invType === 'sale' ? 'قيد مبيعات' : 'قيد مشتريات') + ' – ' + number
      };
      journalId = S.journalEntries[jIdx].id;
    }
  } else {
    // إنشاء قيد تلقائي جديد
    const jEntry = {
      id: uid(),
      number: 'JE-' + String(S.journalEntries.length + 1).padStart(4, '0'),
      date,
      desc: (S._invType === 'sale' ? 'قيد مبيعات' : 'قيد مشتريات') + ' – ' + number + ' – ' + partyName,
      ref: number,
      lines: jLines,
      debitTotal:  jLines.reduce((s, l) => s + l.debit,  0),
      creditTotal: jLines.reduce((s, l) => s + l.credit, 0),
      status: 'تلقائي',
      autoGenerated: true
    };
    S.journalEntries.push(jEntry);
    journalId = jEntry.id;
  }

  // ─── حفظ الفاتورة ────────────────────────────────────────────────
  const invoice = { id: uid(), number, date, type: S._invType, contactId, partyName, payment, payAccountId, notes, lines, subtotal: sub, vatAmt, total, status: 'مكتمل', journalId };

  if (isEdit) {
    const idx = S.invoices.findIndex(i => i.id === S._editId);
    if (idx > -1) S.invoices[idx] = { ...invoice, id: S._editId };
  } else {
    S.invoices.push(invoice);
  }

  save();
  closeModal('invoice-modal');
  updateAll();
  showToast('تم حفظ الفاتورة والقيد التلقائي ✓', 'success');
}

/* ============================================================
   بناء القيد التلقائي للفاتورة
   ============================================================ */
function buildInvoiceJournal(type, lines, sub, vatAmt, total, payment, payAccountId, date, number) {
  // دالة مساعدة: ابحث عن الحساب بالكود أو بالنوع احتياطاً
  const fa = (code, fbType, fbSubtype) => {
    const byCode = S.accounts.find(a => a.code === code);
    if (byCode) return byCode;
    if (fbSubtype) return S.accounts.find(a => a.type === fbType && a.subtype === fbSubtype);
    return S.accounts.find(a => a.type === fbType);
  };

  // خريطة الحسابات المستخدمة في القيود
  const cash   = fa('1010', 'asset',     'current');  // الصندوق
  const bank   = fa('1020', 'asset',     'current');  // البنك
  const ar     = fa('1030', 'asset',     'current');  // ذمم مدينة
  const invAcc = fa('1040', 'asset',     'current');  // مخزون
  const vatIn  = fa('2025', 'asset',     'current');  // ضريبة مدخلات
  const ap     = fa('2010', 'liability', 'current');  // موردون
  const vatOut = fa('2020', 'liability', 'current');  // ضريبة مخرجات
  const rev    = fa('4010', 'revenue');               // إيرادات مبيعات
  const cogs   = fa('5010', 'cogs');                  // تكلفة مبيعات

  // حساب الدفع: إذا اختار المستخدم حساباً محدداً يُستخدم، وإلا الافتراضي
  const selectedPayAcc = payAccountId ? S.accounts.find(a => a.id === payAccountId) : null;
  const cashAcc = selectedPayAcc || (payment === 'bank' ? bank : cash);

  const jLines = [];

  if (type === 'sale') {
    // مدين: المدفوع (نقدي/بنك) أو ذمم مدينة
    const drAcc = payment === 'credit' ? ar : cashAcc;
    if (drAcc) jLines.push({ accountId: drAcc.id, desc: 'إجمالي الفاتورة شامل الضريبة – ' + number, debit: total, credit: 0 });

    // دائن: إيرادات المبيعات (قبل الضريبة)
    if (rev) jLines.push({ accountId: rev.id, desc: 'إيرادات مبيعات – ' + number, debit: 0, credit: sub });

    // دائن: ضريبة المخرجات
    if (vatAmt > 0 && vatOut) jLines.push({ accountId: vatOut.id, desc: 'ضريبة القيمة المضافة على المبيعات', debit: 0, credit: vatAmt });

    // قيد تكلفة البضاعة المباعة (COGS)
    const cogsTotal = lines.reduce((s, l) => s + (l.qty * (l.itemCost || 0)), 0);
    if (cogsTotal > 0.005) {
      if (cogs)   jLines.push({ accountId: cogs.id,   desc: 'تكلفة البضاعة المباعة – ' + number, debit: cogsTotal, credit: 0 });
      if (invAcc) jLines.push({ accountId: invAcc.id, desc: 'خروج مخزون – ' + number,            debit: 0,         credit: cogsTotal });
    }

  } else {
    // مشتريات: مدين المخزون
    if (invAcc) jLines.push({ accountId: invAcc.id, desc: 'مشتريات بضاعة – ' + number, debit: sub, credit: 0 });

    // مدين: ضريبة المدخلات (أصل قابل للاسترداد)
    if (vatAmt > 0.005 && vatIn) jLines.push({ accountId: vatIn.id, desc: 'ضريبة القيمة المضافة على المشتريات', debit: vatAmt, credit: 0 });

    // دائن: المورد أو الصندوق
    const crAcc = payment === 'credit' ? ap : cashAcc;
    if (crAcc) jLines.push({ accountId: crAcc.id, desc: 'سداد/التزام مشتريات – ' + number, debit: 0, credit: total });
  }

  // تحقق داخلي: إذا كان هناك فرق بسبب حسابات مفقودة → سطر موازنة مؤقت
  const sumDr = jLines.reduce((s, l) => s + l.debit,  0);
  const sumCr = jLines.reduce((s, l) => s + l.credit, 0);
  const diff  = Math.round((sumDr - sumCr) * 100) / 100;
  if (Math.abs(diff) > 0.005) {
    const balAcc = cashAcc || S.accounts[0];
    if (balAcc) {
      if (diff > 0) jLines.push({ accountId: balAcc.id, desc: '⚠ فرق موازنة تلقائية', debit: 0,            credit: diff });
      else          jLines.push({ accountId: balAcc.id, desc: '⚠ فرق موازنة تلقائية', debit: Math.abs(diff), credit: 0 });
    }
  }

  return jLines;
}

/* ============================================================
   حذف الفاتورة
   ============================================================ */
function deleteInvoice(id) {
  const inv = S.invoices.find(i => i.id === id);
  if (!confirm('هل تريد حذف هذه الفاتورة وقيدها التلقائي؟')) return;

  // عكس تأثير المخزون
  if (inv && inv.lines) {
    inv.lines.forEach(l => {
      if (l.itemId) {
        const item = S.inventory.find(i => i.id === l.itemId);
        if (item) {
          if (inv.type === 'sale') item.qty += l.qty;
          else item.qty = Math.max(0, item.qty - l.qty);
        }
      }
    });
  }

  // حذف القيد التلقائي المرتبط
  if (inv && inv.journalId)
    S.journalEntries = S.journalEntries.filter(e => e.id !== inv.journalId);

  S.invoices = S.invoices.filter(i => i.id !== id);
  save();
  updateAll();
  showToast('تم الحذف', 'success');
}

/* ============================================================
   طباعة الفاتورة (Print)
   ============================================================ */
function printInvoice(id) {
  const inv = S.invoices.find(i => i.id === id);
  if (!inv) return;

  const contact = inv.contactId ? S.contacts.find(c => c.id === inv.contactId) : null;
  const vat     = S.settings.vat || 15;

  const rows = inv.lines.map((l, idx) => `
    <tr>
      <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center">${idx + 1}</td>
      <td style="padding:7px 10px;border:1px solid #e5e7eb">${escH(l.desc)}</td>
      <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center">${l.qty}</td>
      <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:left">${fmt(l.price)}</td>
      <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center">${l.disc || 0}%</td>
      <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:left;font-weight:700">${fmt(l.total)}</td>
    </tr>`).join('');

  const accentColor = inv.type === 'sale' ? '#22c55e' : '#3b82f6';
  const bgColor     = inv.type === 'sale' ? '#f0fdf4'  : '#eff6ff';
  const textColor   = inv.type === 'sale' ? '#16a34a'  : '#2563eb';
  const typeLabel   = inv.type === 'sale' ? 'فاتورة مبيعات ضريبية' : 'فاتورة مشتريات ضريبية';
  const payLabel    = inv.payment === 'cash' ? 'نقدي' : inv.payment === 'bank' ? 'تحويل بنكي' : 'آجل';
  const partyLabel  = inv.type === 'sale' ? 'بيانات العميل' : 'بيانات المورد';

  _printInvoiceHTML = `
    <div style="font-family:'Cairo',sans-serif;direction:rtl;color:#111;max-width:700px;margin:auto">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:3px solid ${accentColor}">
        <div>
          <div style="font-size:22px;font-weight:900;margin:0 0 4px">${escH(S.settings.company)}</div>
          ${S.settings.address ? `<div style="font-size:11.5px;color:#666">${escH(S.settings.address)}</div>` : ''}
          ${S.settings.phone   ? `<div style="font-size:11.5px;color:#666">📞 ${escH(S.settings.phone)}</div>` : ''}
          ${S.settings.taxNo   ? `<div style="font-size:11.5px;color:#666">الرقم الضريبي: ${escH(S.settings.taxNo)}</div>` : ''}
        </div>
        <div style="text-align:left;background:${bgColor};border-radius:10px;padding:12px 18px">
          <div style="font-size:15px;font-weight:800;color:${textColor}">${typeLabel}</div>
          <div style="font-size:12px;margin-top:4px">رقم: <strong>${inv.number}</strong></div>
          <div style="font-size:12px">التاريخ: <strong>${inv.date}</strong></div>
          <div style="font-size:12px">الدفع: ${payLabel}</div>
        </div>
      </div>
      ${contact ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px">
          <strong>${partyLabel}:</strong>
          ${escH(contact.name)}
          ${contact.phone ? ` | 📞 ${contact.phone}` : ''}
          ${contact.taxNo ? ` | الرقم الضريبي: ${contact.taxNo}` : ''}
        </div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;width:36px">#</th>
            <th style="padding:8px 10px;text-align:right;border:1px solid #e5e7eb">الصنف / الخدمة</th>
            <th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;width:70px">الكمية</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;width:100px">سعر الوحدة</th>
            <th style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;width:70px">خصم</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #e5e7eb;width:100px">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-right:auto;max-width:320px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12.5px">
        <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f0f0f0"><span>المجموع قبل الضريبة</span><span>${fmt(inv.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f0f0f0"><span>ضريبة القيمة المضافة (${vat}%)</span><span>${fmt(inv.vatAmt)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 14px;font-weight:900;font-size:14px;background:#f8fafc"><span>الإجمالي شامل الضريبة</span><span>${fmt(inv.total)}</span></div>
      </div>
      ${inv.notes ? `<p style="font-size:11px;color:#888;margin-top:14px;padding-top:10px;border-top:1px solid #f0f0f0">ملاحظة: ${escH(inv.notes)}</p>` : ''}
      <p style="font-size:10px;color:#ccc;margin-top:20px;text-align:center;padding-top:12px;border-top:1px solid #f5f5f5">تم إصداره بواسطة نظام المحاسبة التدريبي</p>
    </div>`;

  document.getElementById('invoice-print-body').innerHTML = _printInvoiceHTML;
  openModal('invoice-print-modal');
}

/* ============================================================
   إضافة عميل/مورد سريع من داخل الفاتورة
   ============================================================ */
function quickAddContact() {
  const kind = S._invType === 'sale' ? 'customer' : 'supplier';
  document.getElementById('qc-title').textContent = kind === 'customer' ? 'إضافة عميل سريع' : 'إضافة مورد سريع';
  ['qc-name', 'qc-phone', 'qc-taxno'].forEach(f => document.getElementById(f).value = '');
  openModal('quick-contact-modal');
}

function saveQuickContact() {
  const name = document.getElementById('qc-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }

  const kind = S._invType === 'sale' ? 'customer' : 'supplier';
  const newC = {
    id: uid(), kind, name,
    phone:  document.getElementById('qc-phone').value,
    taxNo:  document.getElementById('qc-taxno').value,
    email: '', address: '', creditLimit: 0, notes: ''
  };
  S.contacts.push(newC);
  save();

  // إضافة الخيار الجديد واختياره تلقائياً
  const sel = document.getElementById('inv-party-select');
  const opt = document.createElement('option');
  opt.value       = newC.id;
  opt.textContent = newC.name;
  sel.appendChild(opt);
  sel.value = newC.id;

  closeModal('quick-contact-modal');
  showToast((kind === 'customer' ? 'تم إضافة العميل' : 'تم إضافة المورد') + ' ✓', 'success');
}

/* ============================================================
   عرض جداول المبيعات والمشتريات (Render)
   ============================================================ */
function renderSales() {
  const sales = S.invoices.filter(i => i.type === 'sale');
  const tbody = document.getElementById('sales-body');

  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🧾</div><p>لا فواتير مبيعات</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = [...sales].reverse().map(i => `
    <tr>
      <td class="fw-800 text-accent">${i.number}</td>
      <td>${i.date}</td>
      <td>${escH(i.partyName || '—')}</td>
      <td class="text-muted">${i.lines.length}</td>
      <td>${fmt(i.subtotal)}</td>
      <td class="text-yellow">${fmt(i.vatAmt)}</td>
      <td class="fw-800 text-green">${fmt(i.total)}</td>
      <td><span class="badge badge-green">${i.status}</span></td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" title="طباعة" onclick="printInvoice('${i.id}')">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="openInvoiceModal('sale','${i.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${i.id}')">🗑</button>
      </div></td>
    </tr>`).join('');
}

function renderPurchases() {
  const purch = S.invoices.filter(i => i.type === 'purchase');
  const tbody = document.getElementById('purchases-body');

  if (!purch.length) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div><p>لا فواتير مشتريات</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = [...purch].reverse().map(i => `
    <tr>
      <td class="fw-800 text-accent">${i.number}</td>
      <td>${i.date}</td>
      <td>${escH(i.partyName || '—')}</td>
      <td class="text-muted">${i.lines.length}</td>
      <td>${fmt(i.subtotal)}</td>
      <td class="text-yellow">${fmt(i.vatAmt)}</td>
      <td class="fw-800 text-red">${fmt(i.total)}</td>
      <td><span class="badge badge-blue">${i.status}</span></td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" title="طباعة" onclick="printInvoice('${i.id}')">🖨️</button>
        <button class="btn btn-ghost btn-sm" onclick="openInvoiceModal('purchase','${i.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${i.id}')">🗑</button>
      </div></td>
    </tr>`).join('');
}
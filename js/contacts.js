/* ============================================================
   contacts.js — العملاء والموردون
   يحتوي على: فتح/حفظ/حذف جهة الاتصال،
   عرض جدول العملاء، عرض جدول الموردين
   ============================================================ */

/* ============================================================
   نافذة جهة الاتصال (Contact Modal)
   ============================================================ */
function openContactModal(kind, id = null) {
  S._ctKind = kind;
  S._edit   = id ? 'edit' : 'new';
  S._editId = id;

  const isEdit    = !!id;
  const isCustomer = kind === 'customer';

  document.getElementById('contact-modal-title').textContent = isEdit
    ? (isCustomer ? 'تعديل العميل' : 'تعديل المورد')
    : (isCustomer ? 'عميل جديد'    : 'مورد جديد');

  // تفريغ الحقول
  ['ct-name', 'ct-phone', 'ct-email', 'ct-taxno', 'ct-address', 'ct-notes'].forEach(f =>
    document.getElementById(f).value = '');
  document.getElementById('ct-credit').value = 0;

  // تعبئة البيانات عند التعديل
  if (id) {
    const c = S.contacts.find(x => x.id === id);
    if (c) {
      document.getElementById('ct-name').value    = c.name;
      document.getElementById('ct-phone').value   = c.phone       || '';
      document.getElementById('ct-email').value   = c.email       || '';
      document.getElementById('ct-taxno').value   = c.taxNo       || '';
      document.getElementById('ct-address').value = c.address     || '';
      document.getElementById('ct-credit').value  = c.creditLimit || 0;
      document.getElementById('ct-notes').value   = c.notes       || '';
    }
  }

  openModal('contact-modal');
}

/* ===== حفظ جهة الاتصال (إضافة أو تعديل) ===== */
function saveContact() {
  const name = document.getElementById('ct-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }

  const obj = {
    id:          uid(),
    kind:        S._ctKind,
    name,
    phone:       document.getElementById('ct-phone').value,
    email:       document.getElementById('ct-email').value,
    taxNo:       document.getElementById('ct-taxno').value,
    address:     document.getElementById('ct-address').value,
    creditLimit: parseFloat(document.getElementById('ct-credit').value || 0),
    notes:       document.getElementById('ct-notes').value
  };

  if (S._edit === 'edit' && S._editId) {
    const idx = S.contacts.findIndex(c => c.id === S._editId);
    if (idx > -1) S.contacts[idx] = { ...S.contacts[idx], ...obj, id: S._editId };
  } else {
    S.contacts.push(obj);
  }

  save();
  closeModal('contact-modal');
  updateAll();
  showToast('تم الحفظ ✓', 'success');
}

/* ===== حذف جهة الاتصال ===== */
function deleteContact(id) {
  // منع الحذف إذا كانت جهة الاتصال مرتبطة بفواتير
  if (S.invoices.some(i => i.contactId === id)) {
    showToast('⚠ لا يمكن حذف هذا الطرف — له فواتير مسجّلة', 'error');
    return;
  }

  if (!confirm('هل تريد الحذف؟')) return;

  S.contacts = S.contacts.filter(c => c.id !== id);
  save();
  updateAll();
  showToast('تم الحذف', 'success');
}

/* ============================================================
   عرض جدول العملاء (Render Customers)
   ============================================================ */
function renderCustomers() {
  const tbody = document.getElementById('customers-body');
  const custs = S.contacts.filter(c => c.kind === 'customer');

  if (!custs.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👤</div><p>أضف أول عميل</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = custs.map(c => {
    // فواتير هذا العميل
    const invs    = S.invoices.filter(i => i.contactId === c.id && i.type === 'sale');
    const total   = invs.reduce((s, i) => s + i.total, 0);
    const balance = invs.filter(i => i.payment === 'credit').reduce((s, i) => s + i.total, 0);

    return `<tr>
      <td>
        <div style="font-weight:700">${escH(c.name)}</div>
        ${c.taxNo   ? `<div class="text-muted" style="font-size:11px">رقم ضريبي: ${c.taxNo}</div>` : ''}
        ${c.address ? `<div class="text-muted" style="font-size:11px">${escH(c.address)}</div>`     : ''}
      </td>
      <td>${c.phone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td class="${balance > 0 ? 'text-red fw-800' : ''}">${fmt(balance)}</td>
      <td class="text-green fw-800">${fmt(total)}</td>
      <td class="text-muted">${invs.length}</td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="openContactModal('customer','${c.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteContact('${c.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ============================================================
   عرض جدول الموردين (Render Suppliers)
   ============================================================ */
function renderSuppliers() {
  const tbody = document.getElementById('suppliers-body');
  const supps = S.contacts.filter(c => c.kind === 'supplier');

  if (!supps.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏭</div><p>أضف أول مورد</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = supps.map(c => {
    // فواتير هذا المورد
    const invs    = S.invoices.filter(i => i.contactId === c.id && i.type === 'purchase');
    const total   = invs.reduce((s, i) => s + i.total, 0);
    const balance = invs.filter(i => i.payment === 'credit').reduce((s, i) => s + i.total, 0);

    return `<tr>
      <td>
        <div style="font-weight:700">${escH(c.name)}</div>
        ${c.taxNo   ? `<div class="text-muted" style="font-size:11px">رقم ضريبي: ${c.taxNo}</div>` : ''}
        ${c.address ? `<div class="text-muted" style="font-size:11px">${escH(c.address)}</div>`     : ''}
      </td>
      <td>${c.phone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td class="${balance > 0 ? 'text-red fw-800' : ''}">${fmt(balance)}</td>
      <td class="text-accent fw-800">${fmt(total)}</td>
      <td class="text-muted">${invs.length}</td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="openContactModal('supplier','${c.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteContact('${c.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

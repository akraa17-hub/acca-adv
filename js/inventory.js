/* ============================================================
   inventory.js — إدارة المخزون
   يحتوي على: فتح/حفظ/حذف الصنف، عرض جدول المخزون
   مع شريط الكمية ومؤشر الحالة
   ============================================================ */

/* ============================================================
   نافذة الصنف (Inventory Modal)
   ============================================================ */
function openInventoryModal(id = null) {
  S._edit   = id ? 'edit' : 'new';
  S._editId = id;

  document.getElementById('inventory-modal-title').textContent = id ? 'تعديل الصنف' : 'صنف مخزون جديد';

  // تفريغ الحقول
  ['inv-code', 'inv-name-f', 'inv-cat'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('inv-qty').value   = 0;
  document.getElementById('inv-min').value   = 5;
  document.getElementById('inv-cost').value  = 0;
  document.getElementById('inv-price').value = 0;

  // تعبئة البيانات عند التعديل
  if (id) {
    const item = S.inventory.find(i => i.id === id);
    if (item) {
      document.getElementById('inv-code').value    = item.code;
      document.getElementById('inv-name-f').value  = item.name;
      document.getElementById('inv-cat').value     = item.category  || '';
      document.getElementById('inv-qty').value     = item.qty       || 0;
      document.getElementById('inv-min').value     = item.minQty    || 5;
      document.getElementById('inv-cost').value    = item.cost      || 0;
      document.getElementById('inv-price').value   = item.price     || 0;
      if (item.unit) document.getElementById('inv-unit').value = item.unit;
    }
  }

  openModal('inventory-modal');
}

/* ===== حفظ الصنف (إضافة أو تعديل) ===== */
function saveInventoryItem() {
  const code = document.getElementById('inv-code').value.trim();
  const name = document.getElementById('inv-name-f').value.trim();

  if (!code || !name) { showToast('كود واسم الصنف مطلوبان', 'error'); return; }

  const obj = {
    id:       uid(),
    code,
    name,
    category: document.getElementById('inv-cat').value.trim(),
    qty:      parseFloat(document.getElementById('inv-qty').value   || 0),
    minQty:   parseFloat(document.getElementById('inv-min').value   || 0),
    cost:     parseFloat(document.getElementById('inv-cost').value  || 0),
    price:    parseFloat(document.getElementById('inv-price').value || 0),
    unit:     document.getElementById('inv-unit').value
  };

  if (S._edit === 'edit' && S._editId) {
    const idx = S.inventory.findIndex(i => i.id === S._editId);
    if (idx > -1) S.inventory[idx] = { ...S.inventory[idx], ...obj, id: S._editId };
  } else {
    S.inventory.push(obj);
  }

  save();
  closeModal('inventory-modal');
  updateAll();
  showToast('تم حفظ الصنف ✓', 'success');
}

/* ===== حذف الصنف ===== */
function deleteInventoryItem(id) {
  // منع الحذف إذا كان الصنف مرتبطاً بفواتير
  if (S.invoices.some(i => i.lines.some(l => l.itemId === id))) {
    showToast('⚠ لا يمكن حذف صنف له فواتير مرتبطة', 'error');
    return;
  }

  if (!confirm('حذف هذا الصنف؟')) return;

  S.inventory = S.inventory.filter(i => i.id !== id);
  save();
  updateAll();
  showToast('تم الحذف', 'success');
}

/* ============================================================
   عرض جدول المخزون (Render)
   ============================================================ */
function renderInventory() {
  const tbody = document.getElementById('inventory-body');

  if (!S.inventory.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">🗃️</div><p>أضف أصناف</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = S.inventory.map(item => {
    // حساب نسبة الكمية لشريط التقدم (الحد الأدنى × 3 = كافٍ)
    const pct    = item.minQty > 0 ? Math.min(100, (item.qty / (item.minQty * 3)) * 100) : 100;
    const color  = item.qty <= item.minQty ? 'var(--red)' : item.qty <= item.minQty * 2 ? 'var(--yellow)' : 'var(--green)';

    // تحديد الحالة
    const statusClass = item.qty <= item.minQty ? 'badge-red' : item.qty <= item.minQty * 2 ? 'badge-yellow' : 'badge-green';
    const statusText  = item.qty <= item.minQty ? 'منخفض'    : item.qty <= item.minQty * 2 ? 'تحذير'       : 'كافٍ';

    return `<tr>
      <td class="fw-800 text-muted">${item.code}</td>
      <td class="fw-800">${escH(item.name)}</td>
      <td class="text-muted">${item.category || '—'}</td>
      <td>
        <div>${item.qty} ${item.unit || ''}</div>
        <div class="stock-bar">
          <div class="stock-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </td>
      <td class="text-muted">${item.minQty}</td>
      <td>${fmt(item.cost)}</td>
      <td class="fw-800">${fmt(item.price)}</td>
      <td class="fw-800 text-accent">${fmt((item.qty || 0) * (item.cost || 0))}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="openInventoryModal('${item.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInventoryItem('${item.id}')">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

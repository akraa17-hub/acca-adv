/* ============================================================
   accounts.js — شجرة الحسابات
   يحتوي على: حساب الأرصدة (مدين/دائن)، فتح/حفظ/حذف الحساب،
   عرض الشجرة الهرمية، طي/توسيع العقد
   ✅ تحديث: إضافة خيار "حساب دفع" — يظهر في قائمة الدفع بالفواتير
   ============================================================ */

function isDebitNature(acc) {
  return ['asset', 'expense', 'cogs'].includes(acc.type);
}

function getAccBalance(accountId) {
  let dr = 0, cr = 0;
  S.journalEntries.forEach(e => {
    e.lines.forEach(l => {
      if (l.accountId === accountId) { dr += l.debit || 0; cr += l.credit || 0; }
    });
  });
  return { dr, cr };
}

function getNetBalance(accountId) {
  const acc = S.accounts.find(a => a.id === accountId);
  if (!acc) return 0;
  function getDirectBalance(id) {
    const a = S.accounts.find(x => x.id === id);
    if (!a) return 0;
    const hasKids = S.accounts.some(x => x.parentId === id);
    if (hasKids) return S.accounts.filter(x => x.parentId === id).reduce((s, c) => s + getDirectBalance(c.id), 0);
    const op = a.opening || 0;
    const { dr, cr } = getAccBalance(id);
    return isDebitNature(a) ? op + dr - cr : op + cr - dr;
  }
  return getDirectBalance(accountId);
}

function openAccountModal(id = null) {
  S._edit   = id ? 'edit' : 'new';
  S._editId = id;
  document.getElementById('account-modal-title').textContent = id ? 'تعديل الحساب' : 'حساب جديد';
  ['acc-code', 'acc-name', 'acc-notes'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('acc-opening').value      = 0;
  document.getElementById('acc-type').value         = 'asset';
  document.getElementById('acc-subtype').value      = 'current';
  document.getElementById('acc-is-payment').checked = false;
  const sel = document.getElementById('acc-parent');
  sel.innerHTML = '<option value="">— بدون أب (رئيسي) —</option>' +
    S.accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('');
  if (id) {
    const a = S.accounts.find(x => x.id === id);
    if (a) {
      document.getElementById('acc-code').value          = a.code;
      document.getElementById('acc-name').value          = a.name;
      document.getElementById('acc-type').value          = a.type;
      document.getElementById('acc-subtype').value       = a.subtype  || 'current';
      document.getElementById('acc-opening').value       = a.opening  || 0;
      document.getElementById('acc-notes').value         = a.notes    || '';
      document.getElementById('acc-parent').value        = a.parentId || '';
      document.getElementById('acc-is-payment').checked  = a.isPayment || false;
    }
  }
  openModal('account-modal');
}

function saveAccount() {
  const code      = document.getElementById('acc-code').value.trim();
  const name      = document.getElementById('acc-name').value.trim();
  const type      = document.getElementById('acc-type').value;
  const subtype   = document.getElementById('acc-subtype').value;
  const opening   = parseFloat(document.getElementById('acc-opening').value || 0);
  const notes     = document.getElementById('acc-notes').value.trim();
  const parentId  = document.getElementById('acc-parent').value || null;
  const isPayment = document.getElementById('acc-is-payment').checked;
  if (!code || !name) { showToast('رقم واسم الحساب مطلوبان', 'error'); return; }
  let level = 0;
  if (parentId) {
    const parent = S.accounts.find(a => a.id === parentId);
    level = parent ? (parent.level || 0) + 1 : 1;
  }
  if (S._edit === 'edit' && S._editId) {
    const idx = S.accounts.findIndex(a => a.id === S._editId);
    if (idx > -1) S.accounts[idx] = { ...S.accounts[idx], code, name, type, subtype, opening, notes, parentId, level, isPayment };
  } else {
    if (S.accounts.find(a => a.code === code)) { showToast('رقم الحساب موجود مسبقاً', 'error'); return; }
    S.accounts.push({ id: uid(), code, name, type, subtype, opening, notes, parentId, level, isPayment });
  }
  S.accounts.sort((a, b) => a.code.localeCompare(b.code, 'ar', { numeric: true }));
  save();
  closeModal('account-modal');
  updateAll();
  showToast('تم حفظ الحساب ✓', 'success');
}

function deleteAccount(id) {
  const usedInJournal = S.journalEntries.some(e => e.lines.some(l => l.accountId === id));
  if (usedInJournal) { showToast('⚠ لا يمكن حذف حساب له قيود مسجّلة', 'error'); return; }
  const hasChildren = S.accounts.some(a => a.parentId === id);
  if (hasChildren) { showToast('⚠ لا يمكن حذف حساب له فروع. احذف الفروع أولاً', 'error'); return; }
  if (!confirm('هل تريد حذف هذا الحساب؟')) return;
  S.accounts = S.accounts.filter(a => a.id !== id);
  save(); updateAll(); showToast('تم الحذف', 'success');
}

function addChildAccount(parentId) {
  openAccountModal();
  setTimeout(() => { document.getElementById('acc-parent').value = parentId; }, 100);
}

function renderAccounts() {
  const typeLabels    = { asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات', cogs: 'تكلفة مبيعات' };
  const typeColors    = { asset: 'badge-blue', liability: 'badge-red', equity: 'badge-green', revenue: 'badge-green', expense: 'badge-yellow', cogs: 'badge-yellow' };
  const normalBalance = { asset: 'مدين', liability: 'دائن', equity: 'دائن', revenue: 'دائن', expense: 'مدين', cogs: 'مدين' };
  const hasChildren   = id => S.accounts.some(a => a.parentId === id);
  const roots         = S.accounts.filter(a => !a.parentId);
  let html = '';
  function renderNode(acc, depth) {
    const hc            = hasChildren(acc.id);
    const balance       = getNetBalance(acc.id);
    const usedInJournal = S.journalEntries.some(e => e.lines.some(l => l.accountId === acc.id));
    const payBadge      = acc.isPayment ? `<span class="badge badge-teal" style="margin-right:5px;font-size:9.5px">💳 دفع</span>` : '';
    html += `<tr class="acc-level-${Math.min(depth, 2)}" data-id="${acc.id}">
      <td style="padding-right:${8 + depth * 16}px">
        <span class="acc-tree-expand" onclick="toggleAccNode('${acc.id}')" id="acc-toggle-${acc.id}">${hc ? '▼' : ''}</span>
        ${acc.code}
      </td>
      <td class="fw-800" style="padding-right:${depth > 0 ? 4 : 11}px">${'　'.repeat(depth)}${escH(acc.name)}${payBadge}</td>
      <td><span class="badge ${typeColors[acc.type] || 'badge-blue'}">${typeLabels[acc.type] || acc.type}</span></td>
      <td class="text-muted" style="font-size:11px">${normalBalance[acc.type] || '—'}</td>
      <td class="fw-800 ${balance > 0 ? 'text-accent' : balance < 0 ? 'text-red' : 'text-muted'}">${balance !== 0 ? fmt(Math.abs(balance)) : ''}</td>
      <td class="no-print"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="openAccountModal('${acc.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" title="إضافة فرع" onclick="addChildAccount('${acc.id}')">+</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAccount('${acc.id}')" ${usedInJournal ? 'disabled title="لا يمكن حذف — له قيود"' : ''}>🗑</button>
      </div></td>
    </tr>`;
    S.accounts.filter(a => a.parentId === acc.id).forEach(ch => renderNode(ch, depth + 1));
  }
  roots.forEach(r => renderNode(r, 0));
  document.getElementById('accounts-body').innerHTML = html;
}

function toggleAccNode(parentId) {
  const toggle      = document.getElementById('acc-toggle-' + parentId);
  const isCollapsed = toggle.textContent === '▶';
  toggle.textContent = isCollapsed ? '▼' : '▶';
  function getAllDescendants(pid) {
    const direct = S.accounts.filter(a => a.parentId === pid).map(a => a.id);
    return direct.reduce((acc, cid) => [...acc, ...getAllDescendants(cid)], [...direct]);
  }
  const allDesc = getAllDescendants(parentId);
  document.querySelectorAll('#accounts-body tr[data-id]').forEach(row => {
    if (allDesc.includes(row.getAttribute('data-id')))
      row.style.display = isCollapsed ? '' : 'none';
  });
}

function updateAccountParentSelects() {
  const sel = document.getElementById('acc-parent');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— بدون أب (رئيسي) —</option>' +
    S.accounts.map(a => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${a.code} - ${a.name}</option>`).join('');
}
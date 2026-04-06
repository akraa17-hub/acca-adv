/* ============================================================
   admin.js — لوحة تحكم الأدمن
   ============================================================ */

const ADMIN_EMAIL = 'akr.aa17@gmail.com';

async function loadAdminPanel() {
  document.getElementById('admin-loading').style.display = 'block';
  document.getElementById('admin-content').style.display = 'none';

  try {
    // جلب قائمة المستخدمين من usersList
    const snap  = await db.collection('usersList').get();
    const users = [];

    for (const doc of snap.docs) {
      const uid      = doc.id;
      const listData = doc.data();
      try {
        const stateDoc = await db.collection('users').doc(uid)
                                  .collection('data').doc('state').get();
        if (stateDoc.exists) {
          const data = stateDoc.data();
          users.push({
            uid,
            email:     listData.email || uid,
            company:   data.settings?.company   || '—',
            entries:   (data.journalEntries      || []).length,
            invoices:  (data.invoices             || []).length,
            contacts:  (data.contacts             || []).length,
            inventory: (data.inventory            || []).length,
            updatedAt: listData.lastLogin?.toDate?.()
                         ?.toLocaleDateString('ar-SA') || '—',
          });
        } else {
          users.push({
            uid, email: listData.email || uid,
            company: '—', entries: 0, invoices: 0,
            contacts: 0, inventory: 0,
            updatedAt: listData.lastLogin?.toDate?.()
                         ?.toLocaleDateString('ar-SA') || '—',
          });
        }
      } catch(e) { console.warn('خطأ في جلب بيانات:', uid, e); }
    }

    renderAdminStats(users);
    renderAdminUsersList(users);
    loadTemplateInfo();

  } catch(e) {
    console.error(e);
    document.getElementById('admin-loading').innerHTML =
      '<p style="color:var(--red)">⚠ تعذّر تحميل البيانات: ' + e.message + '</p>';
    return;
  }

  document.getElementById('admin-loading').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
}

function renderAdminStats(users) {
  const totalEntries  = users.reduce((s,u) => s + u.entries,  0);
  const totalInvoices = users.reduce((s,u) => s + u.invoices, 0);
  document.getElementById('admin-stats').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="kpi-card blue"   style="padding:14px 16px"><div class="kpi-label">إجمالي المتدربين</div><div class="kpi-value text-accent" style="font-size:24px">${users.length}</div><div class="kpi-icon">👥</div></div>
      <div class="kpi-card green"  style="padding:14px 16px"><div class="kpi-label">إجمالي القيود</div><div class="kpi-value text-green" style="font-size:24px">${totalEntries}</div><div class="kpi-icon">📝</div></div>
      <div class="kpi-card purple" style="padding:14px 16px"><div class="kpi-label">إجمالي الفواتير</div><div class="kpi-value" style="font-size:24px;color:var(--purple)">${totalInvoices}</div><div class="kpi-icon">🧾</div></div>
      <div class="kpi-card teal"   style="padding:14px 16px"><div class="kpi-label">آخر تحديث</div><div class="kpi-value" style="font-size:14px;color:var(--teal)">${new Date().toLocaleDateString('ar-SA')}</div><div class="kpi-icon">🕐</div></div>
    </div>`;
}

function renderAdminUsersList(users) {
  const tbody = document.getElementById('admin-users-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>لا يوجد متدربون مسجلون بعد</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = users.map((u,i) => `
    <tr>
      <td class="text-muted">${i+1}</td>
      <td class="fw-800">${u.email}</td>
      <td>${u.company}</td>
      <td class="text-accent fw-800">${u.entries}</td>
      <td class="text-green fw-800">${u.invoices}</td>
      <td class="text-muted">${u.contacts}</td>
      <td class="text-muted">${u.updatedAt}</td>
      <td><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="viewUserData('${u.uid}')">👁 عرض</button>
        <button class="btn btn-ghost btn-sm" onclick="exportUserData('${u.uid}')">📤 تصدير</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUserData('${u.uid}','${u.email}')">🗑 حذف</button>
      </div></td>
    </tr>`).join('');
}

async function viewUserData(uid) {
  const doc = await db.collection('users').doc(uid).collection('data').doc('state').get();
  if (!doc.exists) { showToast('لا توجد بيانات لهذا المتدرب', 'error'); return; }
  const data     = doc.data();
  const company  = data.settings?.company || 'غير محدد';
  const entries  = data.journalEntries    || [];
  const invoices = data.invoices           || [];
  const contacts = data.contacts           || [];
  const totalSales = invoices.filter(i=>i.type==='sale')    .reduce((s,i)=>s+i.total,0);
  const totalPurch = invoices.filter(i=>i.type==='purchase').reduce((s,i)=>s+i.total,0);

  document.getElementById('admin-user-detail-title').textContent = 'بيانات: ' + company;
  document.getElementById('admin-user-detail-body').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">القيود</div><div style="font-size:20px;font-weight:800;color:var(--accent2)">${entries.length}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">الفواتير</div><div style="font-size:20px;font-weight:800;color:var(--green)">${invoices.length}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">إجمالي المبيعات</div><div style="font-size:16px;font-weight:800;color:var(--green)">${fmt(totalSales)}</div></div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">إجمالي المشتريات</div><div style="font-size:16px;font-weight:800;color:var(--accent2)">${fmt(totalPurch)}</div></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">📝 آخر القيود</div>
      <div class="table-wrap"><table>
        <thead><tr><th>التاريخ</th><th>رقم القيد</th><th>البيان</th><th>المدين</th><th>الدائن</th></tr></thead>
        <tbody>${[...entries].reverse().slice(0,5).map(e=>`<tr>
          <td>${e.date}</td><td class="fw-800 text-accent">${e.number}</td>
          <td>${escH(e.desc)}</td><td class="text-green">${fmt(e.debitTotal)}</td>
          <td class="text-red">${fmt(e.creditTotal)}</td></tr>`).join('')
          ||'<tr><td colspan="5" class="text-muted" style="text-align:center">لا قيود</td></tr>'}
        </tbody>
      </table></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">🧾 آخر الفواتير</div>
      <div class="table-wrap"><table>
        <thead><tr><th>التاريخ</th><th>رقم الفاتورة</th><th>النوع</th><th>الطرف</th><th>الإجمالي</th></tr></thead>
        <tbody>${[...invoices].reverse().slice(0,5).map(i=>`<tr>
          <td>${i.date}</td><td class="fw-800 text-accent">${i.number}</td>
          <td><span class="badge ${i.type==='sale'?'badge-green':'badge-blue'}">${i.type==='sale'?'مبيعات':'مشتريات'}</span></td>
          <td>${escH(i.partyName||'—')}</td><td class="fw-800">${fmt(i.total)}</td></tr>`).join('')
          ||'<tr><td colspan="5" class="text-muted" style="text-align:center">لا فواتير</td></tr>'}
        </tbody>
      </table></div>
    </div>
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">👥 العملاء والموردون (${contacts.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${contacts.map(c=>`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:11.5px">
          <span class="badge ${c.kind==='customer'?'badge-green':'badge-blue'}" style="margin-left:5px">${c.kind==='customer'?'عميل':'مورد'}</span>${escH(c.name)}</div>`).join('')
          ||'<p class="text-muted" style="font-size:12px">لا عملاء أو موردون</p>'}
      </div>
    </div>`;
  openModal('admin-user-detail-modal');
}

async function exportUserData(uid) {
  const doc = await db.collection('users').doc(uid).collection('data').doc('state').get();
  if (!doc.exists) { showToast('لا توجد بيانات', 'error'); return; }
  const data    = doc.data();
  const company = data.settings?.company || uid;
  const blob    = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a       = document.createElement('a');
  a.href        = URL.createObjectURL(blob);
  a.download    = `بيانات_${company}_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('تم تصدير البيانات ✓', 'success');
}

async function deleteUserData(uid, email) {
  if (!confirm(`هل تريد حذف بيانات ${email}؟\nسيتم حذف كل قيوده وفواتيره ومخزونه.`)) return;
  try {
    await db.collection('users').doc(uid).collection('data').doc('state').delete();
    await db.collection('usersList').doc(uid).delete();
    showToast('تم الحذف ✓', 'success');
    loadAdminPanel();
  } catch(e) {
    showToast('تعذّر الحذف: ' + e.message, 'error');
  }
}

function refreshAdmin() { loadAdminPanel(); }

/* ===== إدارة القالب الافتراضي ===== */
async function uploadTemplate() {
  if (!confirm('هل تريد رفع شجرة الحسابات الحالية كقالب للمتدربين الجدد؟')) return;
  try {
    const ref = getUserDocRef();
    const doc = await ref.get();
    if (!doc.exists) { showToast('لا توجد بيانات في حسابك', 'error'); return; }
    const accounts = doc.data().accounts || [];
    if (!accounts.length) { showToast('شجرة الحسابات فارغة', 'error'); return; }
    await db.collection('templates').doc('default').set({
      accounts,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.email,
    });
    showToast('✓ تم رفع القالب بنجاح', 'success');
    loadTemplateInfo();
  } catch(e) { showToast('تعذّر رفع القالب: ' + e.message, 'error'); }
}

async function loadTemplateInfo() {
  try {
    const doc = await db.collection('templates').doc('default').get();
    const el  = document.getElementById('admin-template-info');
    if (!el) return;
    if (doc.exists) {
      const data      = doc.data();
      const updatedAt = data.updatedAt?.toDate?.()?.toLocaleString('ar-SA') || '—';
      const count     = (data.accounts || []).length;
      el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="badge badge-green">✓ قالب محفوظ</span>
        <span style="font-size:12px;color:var(--text2)">${count} حساب</span>
        <span style="font-size:11px;color:var(--text3)">آخر تحديث: ${updatedAt}</span>
        <span style="font-size:11px;color:var(--text3)">بواسطة: ${data.updatedBy||'—'}</span>
      </div>`;
    } else {
      el.innerHTML = '<span class="badge badge-yellow">⚠ لا يوجد قالب محفوظ بعد</span>';
    }
  } catch(e) { console.warn(e); }
}

async function deleteTemplate() {
  if (!confirm('هل تريد حذف القالب الافتراضي؟')) return;
  try {
    await db.collection('templates').doc('default').delete();
    showToast('تم حذف القالب', 'success');
    loadTemplateInfo();
  } catch(e) { showToast('تعذّر الحذف', 'error'); }
}

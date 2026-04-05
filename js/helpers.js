/* ============================================================
   helpers.js — الدوال المساعدة العامة
   يحتوي على: توليد ID، تنسيق الأرقام، تهريب HTML،
   إشعارات التوست، التنقل بين الصفحات، الشريط الجانبي،
   التبويبات، الطباعة، التصدير/الاستيراد
   ============================================================ */

/* ===== متغيرات الشريط الجانبي ===== */
let sidebarOpen = true;
let jLineCount = 0;
let invLineCount = 0;

/* ===== توليد معرف فريد (Unique ID) ===== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/* ===== تنسيق الأرقام بالفاصلة ===== */
function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ===== تهريب HTML لمنع XSS ===== */
function escH(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ===== إظهار إشعار التوست ===== */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  t.className = 'show ' + type;
  setTimeout(() => { t.className = ''; }, 3000);
}

/* ===== تعيين تاريخ اليوم في حقول التاريخ ===== */
function setToday() {
  const t = new Date().toISOString().split('T')[0];
  ['j-date', 'inv-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = t;
  });
}

/* ============================================================
   التنقل بين الصفحات (Navigation)
   ============================================================ */

/* معلومات كل صفحة: [العنوان، الوصف] */
const pageInfo = {
  dashboard:         ['لوحة التحكم',          'نظرة شاملة على الوضع المالي'],
  journal:           ['قيود اليومية',          'تسجيل القيود المحاسبية'],
  ledger:            ['دفتر الأستاذ',          'حركات الحسابات التفصيلية'],
  'trial-balance':   ['ميزان المراجعة',        'التحقق من توازن الدفاتر'],
  'income-statement':['قائمة الدخل',           'الإيرادات والمصروفات'],
  'balance-sheet':   ['الميزانية العمومية',    'الأصول والخصوم وحقوق الملكية'],
  'cash-flow':       ['قائمة التدفقات النقدية','حركة النقد في المنشأة'],
  sales:             ['فواتير المبيعات',       'إصدار وإدارة فواتير العملاء'],
  purchases:         ['فواتير المشتريات',      'تسجيل مشتريات الموردين'],
  inventory:         ['المخزون',               'إدارة الأصناف والكميات'],
  customers:         ['العملاء',               'إدارة بيانات العملاء'],
  suppliers:         ['الموردون',              'إدارة بيانات الموردين'],
  accounts:          ['شجرة الحسابات',         'الهيكل الهرمي للحسابات'],
  reports:           ['التقارير المالية',       'تقارير تحليلية متعددة'],
  settings:          ['الإعدادات',             'إعدادات الشركة والنظام'],
};

function navigate(page) {
  // إخفاء كل الصفحات وإظهار المطلوبة
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // تفعيل عنصر القائمة المناسب
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + page + "'"))
      n.classList.add('active');
  });

  // تحديث عنوان الصفحة
  const info = pageInfo[page] || [page, ''];
  document.getElementById('page-title').textContent = info[0];
  document.getElementById('page-sub').textContent = info[1];

  // تحديث رؤوس الطباعة
  document.querySelectorAll('.print-page-header h2').forEach(el => el.textContent = S.settings.company);

  updateAll();

  // أغلق الشريط الجانبي على الجوال بعد التنقل
  if (window.innerWidth <= 768 && sidebarOpen) toggleSidebar();
}

/* زر الإضافة العام في الشريط العلوي */
function showAddModal() {
  const active = document.querySelector('.page.active');
  if (!active) return;
  const id = active.id.replace('page-', '');
  if (id === 'journal')    openJournalModal();
  else if (id === 'accounts')  openAccountModal();
  else if (id === 'sales')     openInvoiceModal('sale');
  else if (id === 'purchases') openInvoiceModal('purchase');
  else if (id === 'inventory') openInventoryModal();
  else if (id === 'customers') openContactModal('customer');
  else if (id === 'suppliers') openContactModal('supplier');
}

/* ============================================================
   الشريط الجانبي (Sidebar Toggle)
   ============================================================ */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  applySidebar();
}

function applySidebar() {
  const sb      = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  const topbar  = document.getElementById('topbar');
  const overlay = document.getElementById('sidebar-overlay');
  const isMobile = window.innerWidth <= 768;

  if (sidebarOpen) {
    sb.classList.remove('collapsed');
    if (isMobile) {
      overlay.classList.add('show');
      main.style.marginRight = '0';
      topbar.style.marginRight = '0';
    } else {
      overlay.classList.remove('show');
      main.style.marginRight = '';
      topbar.style.marginRight = '';
      main.classList.remove('full');
      topbar.classList.remove('full');
    }
  } else {
    sb.classList.add('collapsed');
    overlay.classList.remove('show');
    main.style.marginRight = '0';
    topbar.style.marginRight = '0';
    main.classList.add('full');
    topbar.classList.add('full');
  }
}

/* إعادة فتح الشريط الجانبي عند توسيع الشاشة */
window.addEventListener('resize', () => {
  if (window.innerWidth > 768 && !sidebarOpen) {
    sidebarOpen = true;
    applySidebar();
  }
});

/* ============================================================
   النوافذ المنبثقة (Modals)
   ============================================================ */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  S._edit = null;
  S._editId = null;
}

/* ============================================================
   التبويبات (Tabs)
   ============================================================ */
function switchTab(btn, targetId) {
  const parent = btn.closest('.card');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(targetId).classList.add('active');
  if (targetId === 'rep-profit')    renderProfitReport();
  if (targetId === 'rep-inventory') renderInventoryReport();
  if (targetId === 'rep-account')   onRaccTypeChange();
}

/* ============================================================
   الطباعة (Print)
   ============================================================ */
function printPage() { window.print(); }

/* متغير لحفظ HTML الفاتورة للطباعة */
let _printInvoiceHTML = '';

function printInvoiceOnly() {
  const win = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
  if (!win) { showToast('السماح بالنوافذ المنبثقة في المتصفح', 'error'); return; }
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="UTF-8">
    <title>فاتورة</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Cairo',sans-serif;background:#fff;color:#000;padding:24px;}
      @media print{body{padding:0;} .no-print{display:none!important;}}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #e5e7eb;padding:7px 10px;text-align:right;font-size:12px;}
      th{background:#f3f4f6;font-weight:700;}
      .btn-print{background:#3b82f6;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px;}
    </style>
  </head><body>
    <div class="no-print" style="text-align:center;margin-bottom:20px">
      <button class="btn-print" onclick="window.print();window.close()">🖨️ طباعة / حفظ PDF</button>
    </div>
    ${_printInvoiceHTML}
  </body></html>`);
  win.document.close();
}

/* ============================================================
   التصدير والاستيراد (Export / Import)
   ============================================================ */
function exportData() { exportAllData(); }

function exportAllData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `accounting_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('تم التصدير ✓', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const p = JSON.parse(e.target.result);
      S = { ...S, ...p };
      save();
      updateAll();
      loadSettings();
      showToast('تم الاستيراد ✓', 'success');
    } catch {
      showToast('خطأ في قراءة الملف', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (!confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات نهائياً!')) return;
  S.journalEntries = [];
  S.invoices       = [];
  S.inventory      = [];
  S.contacts       = [];
  S.accounts       = [];
  seedAccounts();
  save();
  updateAll();
  showToast('تم الحذف', 'success');
}

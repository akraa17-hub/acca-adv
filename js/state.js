/* ============================================================
   state.js — إدارة الحالة والتخزين
   يحتوي على: كائن الحالة الرئيسي (S)،
   save() → يحفظ في Firestore
   load() → يحمّل من Firestore
   seedAccounts() → البيانات الافتراضية
   ============================================================ */

/* ===== كائن الحالة الرئيسي ===== */
let S = {
  settings: {
    company:  'شركة تدريب المحاسبة',
    currency: 'SAR',
    vat:      15,
    cr:       '',
    taxNo:    '',
    address:  '',
    phone:    '',
    email:    ''
  },
  accounts:       [],
  journalEntries: [],
  invoices:       [],
  receipts:       [],   // سندات القبض والصرف
  inventory:      [],
  contacts:       [],
  receipts:       [],
  _edit:      null,
  _editId:    null,
  _invType:   'sale',
  _ctKind:    'customer',
};

/* ===== حفظ البيانات في Firestore ===== */
async function save() {
  try {
    const ref = getUserDocRef();
    if (!ref) return;
    const toSave = {
      settings:       S.settings,
      accounts:       S.accounts,
      journalEntries: S.journalEntries,
      invoices:       S.invoices,
      receipts:       S.receipts,
      inventory:      S.inventory,
      contacts:       S.contacts,
      receipts:       S.receipts,
      updatedAt:      firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(toSave, { merge: true });
  } catch (e) {
    console.error('خطأ في الحفظ:', e);
    showToast('تعذّر الحفظ — تحقق من الاتصال', 'error');
  }
}

/* ===== تحميل البيانات من Firestore ===== */
async function load() {
  try {
    const ref = getUserDocRef();
    if (!ref) return;
    const doc = await ref.get();
    if (doc.exists) {
      const data = doc.data();
      S.settings       = data.settings       || S.settings;
      S.accounts       = data.accounts       || [];
      S.journalEntries = data.journalEntries || [];
      S.invoices       = data.invoices       || [];
      S.receipts       = data.receipts       || [];
      S.inventory      = data.inventory      || [];
      S.contacts       = data.contacts       || [];
      S.receipts       = data.receipts       || [];
    }
  } catch (e) {
    console.error('خطأ في التحميل:', e);
    showToast('تعذّر تحميل البيانات — تحقق من الاتصال', 'error');
  }
}

/* ===== تحميل القالب الافتراضي من Firestore ===== */
async function loadTemplate() {
  try {
    const doc = await db.collection('templates').doc('default').get();
    if (doc.exists && (doc.data().accounts || []).length > 0) {
      S.accounts = doc.data().accounts;
      await save();
      return true; // تم تحميل القالب
    }
  } catch(e) {
    console.warn('لم يُوجد قالب في Firestore، سيُستخدم الافتراضي:', e);
  }
  return false; // لم يُوجد قالب
}

/* ===== البيانات الافتراضية لشجرة الحسابات ===== */
function seedAccounts() {
  const raw = [
    { code: '1',      name: 'الأصول',                            type: 'asset',     subtype: 'current',   level: 0, parentCode: null },
    { code: '101',    name: 'الأصول المتداولة',                   type: 'asset',     subtype: 'current',   level: 1, parentCode: '1' },
    { code: '1010',   name: 'الصندوق / النقدية',                 type: 'asset',     subtype: 'current',   level: 2, parentCode: '101' },
    { code: '1020',   name: 'البنك',                             type: 'asset',     subtype: 'current',   level: 2, parentCode: '101' },
    { code: '1030',   name: 'العملاء / الذمم المدينة',           type: 'asset',     subtype: 'current',   level: 2, parentCode: '101' },
    { code: '1040',   name: 'المخزون',                           type: 'asset',     subtype: 'current',   level: 2, parentCode: '101' },
    { code: '102',    name: 'الأصول الثابتة',                    type: 'asset',     subtype: 'fixed',     level: 1, parentCode: '1' },
    { code: '1510',   name: 'الأصول الثابتة',                    type: 'asset',     subtype: 'fixed',     level: 2, parentCode: '102' },
    { code: '2',      name: 'الخصوم',                            type: 'liability', subtype: 'current',   level: 0, parentCode: null },
    { code: '201',    name: 'الخصوم المتداولة',                  type: 'liability', subtype: 'current',   level: 1, parentCode: '2' },
    { code: '2010',   name: 'الموردون / الذمم الدائنة',          type: 'liability', subtype: 'current',   level: 2, parentCode: '201' },
    { code: '2020',   name: 'ضريبة المخرجات (مستحقة)',           type: 'liability', subtype: 'current',   level: 2, parentCode: '201' },
    { code: '2025',   name: 'ضريبة المدخلات (قابلة للاسترداد)', type: 'asset',     subtype: 'current',   level: 2, parentCode: '101' },
    { code: '3',      name: 'حقوق الملكية',                      type: 'equity',    subtype: 'current',   level: 0, parentCode: null },
    { code: '3010',   name: 'رأس المال',                         type: 'equity',    subtype: 'current',   level: 1, parentCode: '3' },
    { code: '3020',   name: 'الأرباح المحتجزة',                  type: 'equity',    subtype: 'current',   level: 1, parentCode: '3' },
    { code: '4',      name: 'الإيرادات',                         type: 'revenue',   subtype: 'operating', level: 0, parentCode: null },
    { code: '4010',   name: 'إيرادات المبيعات',                  type: 'revenue',   subtype: 'operating', level: 1, parentCode: '4' },
    { code: '4020',   name: 'إيرادات أخرى',                      type: 'revenue',   subtype: 'operating', level: 1, parentCode: '4' },
    { code: '5',      name: 'تكلفة المبيعات',                    type: 'cogs',      subtype: 'operating', level: 0, parentCode: null },
    { code: '5010',   name: 'تكلفة البضاعة المباعة',             type: 'cogs',      subtype: 'operating', level: 1, parentCode: '5' },
    { code: '6',      name: 'المصروفات',                         type: 'expense',   subtype: 'operating', level: 0, parentCode: null },
    { code: '6010',   name: 'مصروفات الرواتب',                   type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
    { code: '6020',   name: 'مصروفات الإيجار',                   type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
    { code: '6030',   name: 'مصروفات الكهرباء والماء',           type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
    { code: '6040',   name: 'مصروفات الاتصالات',                 type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
    { code: '6050',   name: 'مصروفات التسويق',                   type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
    { code: '6060',   name: 'مصروفات متنوعة',                    type: 'expense',   subtype: 'operating', level: 1, parentCode: '6' },
  ];

  raw.forEach(a => { a.id = uid(); a.opening = 0; a.notes = ''; a.isPayment = false; });
  raw.forEach(a => {
    if (a.parentCode) {
      const parent = raw.find(p => p.code === a.parentCode);
      a.parentId = parent ? parent.id : null;
    } else {
      a.parentId = null;
    }
    delete a.parentCode;
  });

  S.accounts = raw;
  save();
}

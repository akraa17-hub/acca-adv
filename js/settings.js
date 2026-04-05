/* ============================================================
   settings.js — إعدادات الشركة والنظام
   يحتوي على: تحميل الإعدادات في النموذج، حفظ الإعدادات،
   تحديث اسم الشركة في كل صفحة
   ============================================================ */

/* ===== تحميل الإعدادات في حقول النموذج ===== */
function loadSettings() {
  document.getElementById('set-company').value  = S.settings.company  || '';
  document.getElementById('set-currency').value = S.settings.currency || 'SAR';
  document.getElementById('set-vat').value      = S.settings.vat      || 15;
  document.getElementById('set-cr').value       = S.settings.cr       || '';
  document.getElementById('set-tax-no').value   = S.settings.taxNo    || '';
  document.getElementById('set-address').value  = S.settings.address  || '';
  document.getElementById('set-phone').value    = S.settings.phone    || '';
  document.getElementById('set-email').value    = S.settings.email    || '';
}

/* ===== حفظ الإعدادات ===== */
function saveSettings() {
  S.settings.company  = document.getElementById('set-company').value.trim() || 'شركة تدريب المحاسبة';
  S.settings.currency = document.getElementById('set-currency').value;
  S.settings.vat      = parseFloat(document.getElementById('set-vat').value || 15);
  S.settings.cr       = document.getElementById('set-cr').value;
  S.settings.taxNo    = document.getElementById('set-tax-no').value;
  S.settings.address  = document.getElementById('set-address').value;
  S.settings.phone    = document.getElementById('set-phone').value;
  S.settings.email    = document.getElementById('set-email').value;

  save();
  updateAll();
  showToast('تم حفظ الإعدادات ✓', 'success');
}

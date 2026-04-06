/* ============================================================
   app.js — نقطة البداية الرئيسية للتطبيق
   ملاحظة: init() لا تُستدعى هنا مباشرة —
   يتولى auth.js تشغيلها بعد التحقق من تسجيل الدخول
   ============================================================ */

/* ============================================================
   تحديث جميع الشاشات (Update All)
   دالة مركزية تُستدعى بعد أي تغيير في البيانات
   ============================================================ */
function updateAll() {
  renderDashboard();
  renderJournal();
  renderLedger();
  renderTrialBalance();
  renderIS();
  renderBS();
  renderCF();
  renderSales();
  renderPurchases();
  renderReceipts();
  renderInventory();
  renderCustomers();
  renderSuppliers();
  renderAccounts();
  renderProfitReport();
  renderInventoryReport();
  renderAgingReport();
  renderReceipts();
  updateLedgerFilter();
  updateAccountParentSelects();
  document.getElementById('is-company').textContent = S.settings.company;
  document.querySelectorAll('.print-page-header h2').forEach(el => el.textContent = S.settings.company);
}

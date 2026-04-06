/* ============================================================
   auth.js — إدارة المصادقة (تسجيل الدخول / التسجيل / الخروج)
   يحتوي على: مراقبة حالة المستخدم، تسجيل الدخول،
   إنشاء حساب جديد، تسجيل الخروج، إعادة تعيين كلمة المرور
   ============================================================ */

/* ===== مراقبة حالة تسجيل الدخول =====
   تُستدعى تلقائياً عند أي تغيير في حالة المستخدم
*/
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // إخفاء شاشة تسجيل الدخول
    document.getElementById('auth-screen').style.display = 'none';

    // ===== هل هو أدمن؟ =====
    if (user.email === ADMIN_EMAIL) {
      document.getElementById('app-screen').style.display   = 'none';
      document.getElementById('admin-screen').style.display = 'block';
      document.getElementById('admin-user-email').textContent = user.email;
      await loadAdminPanel();
      return;
    }

    // ===== مستخدم عادي =====
    document.getElementById('app-screen').style.display   = 'block';
    document.getElementById('admin-screen').style.display = 'none';

    // عرض بريد المستخدم في الشريط العلوي
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;

    // تحميل بيانات المستخدم من Firestore
    await load();

    // تهيئة التطبيق
    if (!S.accounts || S.accounts.length === 0) seedAccounts();
    if (!S.contacts) S.contacts = [];
    updateAll();
    setToday();
    loadSettings();
    if (window.innerWidth <= 768) { sidebarOpen = false; applySidebar(); }
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

  } else {
    // المستخدم غير مسجّل
    document.getElementById('auth-screen').style.display  = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
    document.getElementById('admin-screen').style.display = 'none';
  }
});

/* ===== تسجيل الدخول ===== */
async function signIn() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');

  if (!email || !password) { errEl.textContent = 'يرجى إدخال البريد وكلمة المرور'; return; }

  setAuthLoading(true);
  try {
    await auth.signInWithEmailAndPassword(email, password);
    errEl.textContent = '';
  } catch (e) {
    errEl.textContent = getAuthError(e.code);
  } finally {
    setAuthLoading(false);
  }
}

/* ===== إنشاء حساب جديد ===== */
async function signUp() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');

  if (!email || !password) { errEl.textContent = 'يرجى إدخال البريد وكلمة المرور'; return; }
  if (password.length < 6)  { errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'; return; }

  setAuthLoading(true);
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    errEl.textContent = '';
  } catch (e) {
    errEl.textContent = getAuthError(e.code);
  } finally {
    setAuthLoading(false);
  }
}

/* ===== تسجيل الخروج ===== */
async function signOut() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  await auth.signOut();
  // إعادة تعيين الحالة
  S.accounts       = [];
  S.journalEntries = [];
  S.invoices       = [];
  S.inventory      = [];
  S.contacts       = [];
}

/* ===== إعادة تعيين كلمة المرور ===== */
async function resetPassword() {
  const email = document.getElementById('auth-email').value.trim();
  const errEl = document.getElementById('auth-error');

  if (!email) { errEl.textContent = 'أدخل بريدك الإلكتروني أولاً'; return; }

  try {
    await auth.sendPasswordResetEmail(email);
    errEl.style.color   = 'var(--green)';
    errEl.textContent   = '✓ تم إرسال رابط إعادة التعيين إلى بريدك';
  } catch (e) {
    errEl.style.color   = 'var(--red)';
    errEl.textContent   = getAuthError(e.code);
  }
}

/* ===== التبديل بين تسجيل الدخول وإنشاء حساب ===== */
function toggleAuthMode() {
  const isLogin   = document.getElementById('auth-submit-btn').dataset.mode === 'login';
  const btn       = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const title     = document.getElementById('auth-title');
  const resetBtn  = document.getElementById('auth-reset-btn');
  const errEl     = document.getElementById('auth-error');

  errEl.textContent = '';
  errEl.style.color = 'var(--red)';

  if (isLogin) {
    // التحويل لوضع إنشاء حساب
    title.textContent      = 'إنشاء حساب جديد';
    btn.textContent        = 'إنشاء الحساب';
    btn.dataset.mode       = 'signup';
    toggleBtn.textContent  = 'لديك حساب؟ سجّل الدخول';
    resetBtn.style.display = 'none';
    btn.onclick            = signUp;
  } else {
    // التحويل لوضع تسجيل الدخول
    title.textContent      = 'تسجيل الدخول';
    btn.textContent        = 'دخول';
    btn.dataset.mode       = 'login';
    toggleBtn.textContent  = 'ليس لديك حساب؟ أنشئ حساباً';
    resetBtn.style.display = 'block';
    btn.onclick            = signIn;
  }
}

/* ===== ترجمة أخطاء Firebase ===== */
function getAuthError(code) {
  const errors = {
    'auth/user-not-found':       'البريد الإلكتروني غير مسجّل',
    'auth/wrong-password':       'كلمة المرور غير صحيحة',
    'auth/email-already-in-use': 'هذا البريد مسجّل مسبقاً',
    'auth/invalid-email':        'صيغة البريد الإلكتروني غير صحيحة',
    'auth/weak-password':        'كلمة المرور ضعيفة جداً',
    'auth/too-many-requests':    'محاولات كثيرة، حاول لاحقاً',
    'auth/network-request-failed': 'خطأ في الاتصال بالإنترنت',
    'auth/invalid-credential':   'البريد أو كلمة المرور غير صحيحة',
  };
  return errors[code] || 'حدث خطأ، حاول مجدداً';
}

/* ===== مؤشر التحميل على زر تسجيل الدخول ===== */
function setAuthLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled    = loading;
  btn.textContent = loading ? '⏳ جاري التحميل...' : (btn.dataset.mode === 'login' ? 'دخول' : 'إنشاء الحساب');
}

/* ===== السماح بالضغط على Enter لتسجيل الدخول ===== */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') {
    const mode = document.getElementById('auth-submit-btn')?.dataset.mode;
    if (mode === 'login') signIn();
    else signUp();
  }
});

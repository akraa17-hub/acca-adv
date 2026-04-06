/* ============================================================
   auth.js — إدارة المصادقة
   ============================================================ */

auth.onAuthStateChanged(async (user) => {
  if (user) {
    document.getElementById('auth-screen').style.display = 'none';

    // أدمن — يفتح لوحة الأدمن افتراضياً
    if (user.email === ADMIN_EMAIL) {
      document.getElementById('admin-user-email').textContent = user.email;
      // تحميل بيانات الأدمن أيضاً (للتطبيق)
      await load();
      if (!S.accounts || S.accounts.length === 0) {
        const templateLoaded = await loadTemplate();
        if (!templateLoaded) seedAccounts();
      }
      if (!S.contacts) S.contacts = [];
      updateAll(); setToday(); loadSettings();
      if (window.innerWidth <= 768) { sidebarOpen = false; applySidebar(); }
      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
          if (e.target === overlay) overlay.classList.remove('open');
        });
      });
      // افتح لوحة الأدمن افتراضياً
      switchToAdmin();
      return;
    }

    // مستخدم عادي
    document.getElementById('app-screen').style.display   = 'block';
    document.getElementById('admin-screen').style.display = 'none';

    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;

    // إظهار زر لوحة الأدمن فقط لحساب الأدمن
    const adminBtn = document.getElementById('btn-switch-admin');
    if (adminBtn && user.email === ADMIN_EMAIL) adminBtn.style.display = 'inline-flex';

    // تسجيل المستخدم في usersList (للأدمن)
    try {
      await db.collection('usersList').doc(user.uid).set({
        email:     user.email,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch(e) { console.warn('خطأ في usersList:', e); }

    // تحميل بيانات المستخدم
    await load();

    // مستخدم جديد: حمّل القالب أو استخدم الافتراضي
    if (!S.accounts || S.accounts.length === 0) {
      const templateLoaded = await loadTemplate();
      if (!templateLoaded) seedAccounts();
    }
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
    document.getElementById('auth-screen').style.display  = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
    document.getElementById('admin-screen').style.display = 'none';
  }
});

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
  } finally { setAuthLoading(false); }
}

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
  } finally { setAuthLoading(false); }
}

async function signOut() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  await auth.signOut();
  S.accounts = []; S.journalEntries = []; S.invoices = [];
  S.inventory = []; S.contacts = [];
}

async function resetPassword() {
  const email = document.getElementById('auth-email').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!email) { errEl.textContent = 'أدخل بريدك الإلكتروني أولاً'; return; }
  try {
    await auth.sendPasswordResetEmail(email);
    errEl.style.color = 'var(--green)';
    errEl.textContent = '✓ تم إرسال رابط إعادة التعيين إلى بريدك';
  } catch (e) {
    errEl.style.color = 'var(--red)';
    errEl.textContent = getAuthError(e.code);
  }
}

function toggleAuthMode() {
  const isLogin  = document.getElementById('auth-submit-btn').dataset.mode === 'login';
  const btn      = document.getElementById('auth-submit-btn');
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = ''; errEl.style.color = 'var(--red)';
  if (isLogin) {
    document.getElementById('auth-title').textContent     = 'إنشاء حساب جديد';
    btn.textContent = 'إنشاء الحساب'; btn.dataset.mode   = 'signup';
    document.getElementById('auth-toggle-btn').textContent= 'لديك حساب؟ سجّل الدخول';
    document.getElementById('auth-reset-btn').style.display = 'none';
    btn.onclick = signUp;
  } else {
    document.getElementById('auth-title').textContent     = 'تسجيل الدخول';
    btn.textContent = 'دخول'; btn.dataset.mode            = 'login';
    document.getElementById('auth-toggle-btn').textContent= 'ليس لديك حساب؟ أنشئ حساباً';
    document.getElementById('auth-reset-btn').style.display = 'block';
    btn.onclick = signIn;
  }
}

function getAuthError(code) {
  const errors = {
    'auth/user-not-found':        'البريد الإلكتروني غير مسجّل',
    'auth/wrong-password':        'كلمة المرور غير صحيحة',
    'auth/email-already-in-use':  'هذا البريد مسجّل مسبقاً',
    'auth/invalid-email':         'صيغة البريد الإلكتروني غير صحيحة',
    'auth/weak-password':         'كلمة المرور ضعيفة جداً',
    'auth/too-many-requests':     'محاولات كثيرة، حاول لاحقاً',
    'auth/network-request-failed':'خطأ في الاتصال بالإنترنت',
    'auth/invalid-credential':    'البريد أو كلمة المرور غير صحيحة',
  };
  return errors[code] || 'حدث خطأ، حاول مجدداً';
}

function setAuthLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled    = loading;
  btn.textContent = loading ? '⏳ جاري التحميل...' : (btn.dataset.mode === 'login' ? 'دخول' : 'إنشاء الحساب');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') {
    const mode = document.getElementById('auth-submit-btn')?.dataset.mode;
    if (mode === 'login') signIn(); else signUp();
  }
});

/* ===== التبديل بين لوحة الأدمن والتطبيق ===== */
function switchToAdmin() {
  document.getElementById('app-screen').style.display   = 'none';
  document.getElementById('admin-screen').style.display = 'block';
  loadAdminPanel();
}

function switchToApp() {
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'block';
  updateAll();
}

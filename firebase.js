/* ============================================================
   firebase.js — إعداد الاتصال بـ Firebase
   يحتوي على: تهيئة Firebase، Auth، Firestore
   يجب تحميل هذا الملف أولاً قبل كل الملفات الأخرى
   ============================================================ */

// ===== إعدادات Firebase =====
const firebaseConfig = {
  apiKey:            "AIzaSyCk9plrQXLM2wuiIKFKw0Ny-WVDACvFRbc",
  authDomain:        "acca-adv.firebaseapp.com",
  projectId:         "acca-adv",
  storageBucket:     "acca-adv.firebasestorage.app",
  messagingSenderId: "729735161800",
  appId:             "1:729735161800:web:b0bdd8eec71ea00b8d42fd",
  measurementId:     "G-D94DKWDE1L"
};

// ===== تهيئة Firebase =====
firebase.initializeApp(firebaseConfig);

// ===== مراجع الخدمات =====
const db   = firebase.firestore();   // قاعدة البيانات
const auth = firebase.auth();        // نظام المصادقة

/* ===== مرجع بيانات المستخدم الحالي في Firestore =====
   البنية: users/{uid}/data/state
*/
function getUserDocRef() {
  const user = auth.currentUser;
  if (!user) return null;
  return db.collection('users').doc(user.uid).collection('data').doc('state');
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQRl3toKm_L8Nzfi7_73Gl6lHcaJNv1bU",
    authDomain: "easycrypto-3d6bb.firebaseapp.com",
    projectId: "easycrypto-3d6bb",
    storageBucket: "easycrypto-3d6bb.firebasestorage.app",
    messagingSenderId: "498735794728",
    appId: "1:498735794728:web:5066d10f5d9454dc13431d",
    measurementId: "G-V98P8TMQW3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Error Handler
function logError(msg) {
    console.error("[EasyCrypto ERROR]", msg);
    const overlay = document.getElementById('error-overlay');
    const details = document.getElementById('error-details');
    if (overlay && details) {
        overlay.style.display = 'flex';
        details.innerText = msg;
    }
}

// Session Check Helper
async function checkSession(redirectIfNoSession = true, redirectUrl = 'login.html') {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user && redirectIfNoSession) {
                window.location.href = redirectUrl;
            }
            resolve(user);
        });
    });
}

function isKycCompleted(kycStatus) {
    const normalized = String(kycStatus || '').trim().toLowerCase();
    return normalized === 'pending'
        || normalized === 'verified'
        || normalized === 'approved'
        || normalized === 'completed'
        || normalized === 'pass'
        || normalized === 'success'
        || normalized === 'successful';
}

function getPageName(pathOrUrl) {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        const parts = (url.pathname || '').split('/').filter(Boolean);
        return (parts[parts.length - 1] || '').toLowerCase();
    } catch (e) {
        const raw = String(pathOrUrl || '');
        const parts = raw.split('/').filter(Boolean);
        return (parts[parts.length - 1] || '').toLowerCase();
    }
}

function isSamePage(pathOrUrl) {
    const current = getPageName(window.location.pathname);
    const target = getPageName(pathOrUrl);
    return !!current && !!target && current === target;
}

async function enforceKycAccess(options = {}) {
    const {
        requireAuth = true,
        unauthRedirect = 'login.html',
        kycRedirect = 'mobile.html',
        redirectOnPass = '',
        onErrorAllow = false
    } = options;

    const user = await checkSession(false);
    if (!user) {
        if (requireAuth && unauthRedirect && !isSamePage(unauthRedirect)) {
            window.location.href = unauthRedirect;
        }
        return {
            ok: !requireAuth,
            user: null,
            kycStatus: 'Not Verified',
            reason: 'unauthenticated'
        };
    }

    let kycStatus = 'Not Verified';
    try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
            kycStatus = userSnap.data().kyc_status || 'Not Verified';
        }
    } catch (err) {
        console.warn('[EasyCrypto] KYC status lookup failed:', err.message);
        if (!onErrorAllow) {
            if (kycRedirect && !isSamePage(kycRedirect)) {
                window.location.href = kycRedirect;
            }
            return {
                ok: false,
                user,
                kycStatus: 'Not Verified',
                reason: 'kyc_lookup_failed'
            };
        }
    }

    if (!isKycCompleted(kycStatus)) {
        if (kycRedirect && !isSamePage(kycRedirect)) {
            window.location.href = kycRedirect;
        }
        return {
            ok: false,
            user,
            kycStatus,
            reason: 'kyc_required'
        };
    }

    if (redirectOnPass && !isSamePage(redirectOnPass)) {
        window.location.href = redirectOnPass;
        return {
            ok: true,
            user,
            kycStatus,
            reason: 'redirect_on_pass'
        };
    }

    return {
        ok: true,
        user,
        kycStatus,
        reason: 'ok'
    };
}

// Auth Helper: Logout
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (err) {
        alert("Logout failed: " + err.message);
    }
}

window.handleLogout = handleLogout; // Expose for inline onclick handlers

export { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, sendPasswordResetEmail, collection, addDoc, getDocs, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, increment, checkSession, isKycCompleted, enforceKycAccess, logError };

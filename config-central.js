const CENTRAL_FIREBASE_CONFIG = {
  "apiKey": "AIzaSyCHkmWsSkmjOJBoNQcsa_U97iNchcgPwkw",
  "authDomain": "universal-contribution-manager.firebaseapp.com",
  "projectId": "universal-contribution-manager",
  "storageBucket": "universal-contribution-manager.firebasestorage.app",
  "messagingSenderId": "10877815438",
  "appId": "1:10877815438:web:7d4dac5b4c8a07063fd7df",
  "measurementId": "G-68KCQX8PN6"
};

// Central Firebase initialization
let centralApp = null;
let centralFirestore = null;
let centralAuth = null;

function initializeCentralFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded');
    }

    centralApp = firebase.initializeApp(CENTRAL_FIREBASE_CONFIG);
    centralFirestore = firebase.firestore(centralApp);

    // Initialize Auth using compat API
    // In compat version, firebase.auth() returns the default app's auth instance
    try {
      if (typeof firebase.auth === 'function') {
        centralAuth = firebase.auth();
      } else if (centralApp && centralApp.auth && typeof centralApp.auth === 'function') {
        centralAuth = centralApp.auth();
      } else {
        // Auth not available - this is OK, Firestore can still work
        centralAuth = null;
      }
    } catch (authError) {
      // Auth initialization failed - silently continue since it's optional
      centralAuth = null;
    }

    // Firebase initialized (even if auth failed, we have Firestore)
    return {
      app: centralApp,
      db: centralFirestore,
      auth: centralAuth
    };
  } catch (error) {
    console.error('Failed to initialize Central Firebase:', error);
    throw error;
  }
}

function getCentralFirestore() {
  return centralFirestore;
}

function getCentralAuth() {
  return centralAuth;
}

function getCentralApp() {
  return centralApp;
}

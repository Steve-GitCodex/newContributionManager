// Firebase Manager Module
// Owns the connection to the central project. All org data is scoped by OrgDb.

const FirebaseManager = (function () {
    if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
    }

    if (typeof CENTRAL_FIREBASE_CONFIG === 'undefined') {
        throw new Error('Central Firebase configuration not loaded');
    }

    let app;
    try {
        app = firebase.app();
    } catch (error) {
        app = firebase.initializeApp(CENTRAL_FIREBASE_CONFIG);
    }

    const firestore = firebase.firestore(app);
    const auth = firebase.auth(app);

    let lastSyncTime = null;

    return {
        getApp: () => app,
        getFirestore: () => firestore,
        getAuth: () => auth,
        getLastSyncTime: () => lastSyncTime,
        setLastSyncTime: (time) => { lastSyncTime = time; }
    };
})();

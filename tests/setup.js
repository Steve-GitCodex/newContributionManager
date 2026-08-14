import { vi } from 'vitest';

global.firebase = {
  auth: vi.fn(() => ({
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((callback) => callback(null))
  })),
  app: vi.fn(() => ({
    delete: vi.fn()
  })),
  firestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(),
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
          }))
        }))
      }))
    }))
  })),
  database: vi.fn(() => ({
    ref: vi.fn(() => ({
      set: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    }))
  })),
  initializeApp: vi.fn((config, name) => ({
    delete: vi.fn()
  })),
  firestore: {
    FieldValue: {
      arrayUnion: vi.fn((value) => ({ _type: 'arrayUnion', value }))
    },
    ServerValue: {
      TIMESTAMP: { _type: 'timestamp' }
    },
    FieldPath: {
      documentId: vi.fn(() => ({ _type: 'documentId' }))
    }
  }
};

// Helper to reset all mocks between tests
export function resetFirebaseMocks() {
  Object.values(global.firebase).forEach((mock) => {
    if (typeof mock === 'function' && mock.mockClear) {
      mock.mockClear();
    }
  });
}

// Helper to create a mock user
export function createMockUser(overrides = {}) {
  return {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    ...overrides
  };
}

// Helper to create a mock organization
export function createMockOrg(overrides = {}) {
  return {
    id: 'org_123456789',
    slug: 'test-org',
    name: 'Test Organization',
    firebaseConfig: {
      apiKey: 'test-api-key',
      authDomain: 'test-org.firebaseapp.com',
      projectId: 'test-org',
      storageBucket: 'test-org.appspot.com',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abcdef'
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// Helper to create a Firestore DocumentSnapshot mock
export function createMockDocSnapshot(data = null, exists = true) {
  return {
    exists,
    data: () => data,
    id: 'doc123',
    ref: { id: 'doc123' }
  };
}

// Helper to create a Firestore QuerySnapshot mock
export function createMockQuerySnapshot(docs = []) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs,
    forEach: (callback) => docs.forEach(callback)
  };
}

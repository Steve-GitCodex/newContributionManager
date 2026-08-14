import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const ORG = 'aic-isovya-praise';
const OTHER_ORG = 'kyuso-welfare';

const SUPERADMIN = 'superadmin-uid';
const ADMIN = 'admin-uid';
const STAFF = 'staff-uid';
const VIEWER = 'viewer-uid';
const OUTSIDER = 'outsider-uid';

let testEnv;

const ctx = uid => (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).firestore();

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'rules-test-contriflow',
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080
        }
    });
});

afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'superadminUsers', SUPERADMIN), { uid: SUPERADMIN, role: 'superadmin' });
        await setDoc(doc(db, 'organizations', ORG), { name: 'Aic Isovya Praise', slug: ORG, status: 'active' });
        await setDoc(doc(db, 'organizations', OTHER_ORG), { name: 'Kyuso Welfare', slug: OTHER_ORG, status: 'active' });
        await setDoc(doc(db, `organizations/${ORG}/users`, ADMIN), { role: 'admin', email: 'a@x.com' });
        await setDoc(doc(db, `organizations/${ORG}/users`, STAFF), { role: 'editor', email: 's@x.com' });
        await setDoc(doc(db, `organizations/${ORG}/users`, VIEWER), { role: 'viewer', email: 'v@x.com' });
        await setDoc(doc(db, `organizations/${ORG}/contributions`, '2026-01-jane'), { memberName: 'Jane', amount: 100, paid: true });
        await setDoc(doc(db, `organizations/${ORG}/blacklist`, 'old-member'), { memberName: 'Old Member' });
        await setDoc(doc(db, `organizations/${ORG}/budgets`, ADMIN), { expenses: {} });
        await setDoc(doc(db, `organizations/${ORG}/budgets`, VIEWER), { expenses: {} });
        await setDoc(doc(db, `organizations/${OTHER_ORG}/contributions`, 'secret'), { memberName: 'Secret', amount: 999 });
    });
});

describe('org metadata', () => {
    it('is publicly readable so the org picker can bootstrap', async () => {
        await assertSucceeds(getDoc(doc(ctx(null), 'organizations', ORG)));
    });

    it('cannot be modified by an org admin', async () => {
        await assertFails(setDoc(doc(ctx(ADMIN), 'organizations', ORG), { name: 'Hijacked' }));
    });

    it('can be modified by a superadmin', async () => {
        await assertSucceeds(setDoc(doc(ctx(SUPERADMIN), 'organizations', ORG), { name: 'Renamed' }));
    });
});

describe('contribution data is not publicly readable', () => {
    it('denies an unauthenticated read', async () => {
        await assertFails(getDoc(doc(ctx(null), `organizations/${ORG}/contributions`, '2026-01-jane')));
    });

    it('denies a signed-in non-member', async () => {
        await assertFails(getDoc(doc(ctx(OUTSIDER), `organizations/${ORG}/contributions`, '2026-01-jane')));
    });

    it('denies a member of a different org', async () => {
        await assertFails(getDoc(doc(ctx(ADMIN), `organizations/${OTHER_ORG}/contributions`, 'secret')));
    });
});

describe('org user (viewer)', () => {
    it('can read contributions', async () => {
        await assertSucceeds(getDoc(doc(ctx(VIEWER), `organizations/${ORG}/contributions`, '2026-01-jane')));
    });

    it('cannot write contributions', async () => {
        await assertFails(setDoc(doc(ctx(VIEWER), `organizations/${ORG}/contributions`, 'new'), { amount: 1 }));
    });

    it('can write its own budget', async () => {
        await assertSucceeds(setDoc(doc(ctx(VIEWER), `organizations/${ORG}/budgets`, VIEWER), { expenses: { a: 1 } }));
    });

    it('cannot write another member budget', async () => {
        await assertFails(setDoc(doc(ctx(VIEWER), `organizations/${ORG}/budgets`, ADMIN), { expenses: { a: 1 } }));
    });
});

describe('org staff (editor)', () => {
    it('can write contributions', async () => {
        await assertSucceeds(setDoc(doc(ctx(STAFF), `organizations/${ORG}/contributions`, 'new'), { amount: 5 }));
    });

    it('can write campaigns', async () => {
        await assertSucceeds(setDoc(doc(ctx(STAFF), `organizations/${ORG}/campaigns`, 'c1'), { purpose: 'Roof' }));
    });

    it('cannot write the blacklist', async () => {
        await assertFails(setDoc(doc(ctx(STAFF), `organizations/${ORG}/blacklist`, 'someone'), { memberName: 'X' }));
    });

    it('cannot write settings', async () => {
        await assertFails(setDoc(doc(ctx(STAFF), `organizations/${ORG}/settings`, 'migration'), { version: 'x' }));
    });

    it('cannot grant itself admin', async () => {
        await assertFails(setDoc(doc(ctx(STAFF), `organizations/${ORG}/users`, STAFF), { role: 'admin' }));
    });
});

describe('org admin', () => {
    it('can write the blacklist', async () => {
        await assertSucceeds(setDoc(doc(ctx(ADMIN), `organizations/${ORG}/blacklist`, 'someone'), { memberName: 'X' }));
    });

    it('can write settings', async () => {
        await assertSucceeds(setDoc(doc(ctx(ADMIN), `organizations/${ORG}/settings`, 'migration'), { version: 'x' }));
    });

    it('can add a member with a valid role', async () => {
        await assertSucceeds(setDoc(doc(ctx(ADMIN), `organizations/${ORG}/users`, 'new-uid'), { role: 'viewer' }));
    });

    it('cannot assign an unknown role', async () => {
        await assertFails(setDoc(doc(ctx(ADMIN), `organizations/${ORG}/users`, 'new-uid'), { role: 'superadmin' }));
    });

    it('can remove a member', async () => {
        await assertSucceeds(deleteDoc(doc(ctx(ADMIN), `organizations/${ORG}/users`, VIEWER)));
    });
});

describe('outsider cannot self-register into an org', () => {
    it('is denied creating its own membership', async () => {
        await assertFails(setDoc(doc(ctx(OUTSIDER), `organizations/${ORG}/users`, OUTSIDER), { role: 'viewer' }));
    });

    it('is denied creating an admin membership', async () => {
        await assertFails(setDoc(doc(ctx(OUTSIDER), `organizations/${ORG}/users`, OUTSIDER), { role: 'admin' }));
    });
});

describe('superadmin', () => {
    it('can read any org data without being a member', async () => {
        await assertSucceeds(getDoc(doc(ctx(SUPERADMIN), `organizations/${OTHER_ORG}/contributions`, 'secret')));
    });

    it('can write the blacklist of any org', async () => {
        await assertSucceeds(setDoc(doc(ctx(SUPERADMIN), `organizations/${ORG}/blacklist`, 'x'), { memberName: 'X' }));
    });
});

describe('superadminUsers', () => {
    it('is not publicly readable', async () => {
        await assertFails(getDoc(doc(ctx(null), 'superadminUsers', SUPERADMIN)));
    });

    it('is not readable by another signed-in user', async () => {
        await assertFails(getDoc(doc(ctx(OUTSIDER), 'superadminUsers', SUPERADMIN)));
    });

    it('is readable by its owner', async () => {
        await assertSucceeds(getDoc(doc(ctx(SUPERADMIN), 'superadminUsers', SUPERADMIN)));
    });

    it('cannot be self-created once setup is complete', async () => {
        await testEnv.withSecurityRulesDisabled(async c => {
            await setDoc(doc(c.firestore(), 'systemConfig', 'setup'), { setupComplete: true });
        });
        await assertFails(setDoc(doc(ctx(OUTSIDER), 'superadminUsers', OUTSIDER), { role: 'superadmin' }));
    });

    it('cannot be self-created even when the setup flag is false', async () => {
        await testEnv.withSecurityRulesDisabled(async c => {
            await setDoc(doc(c.firestore(), 'systemConfig', 'setup'), { setupComplete: false });
        });
        await assertFails(setDoc(doc(ctx(OUTSIDER), 'superadminUsers', OUTSIDER), { role: 'superadmin' }));
    });

    it('allows the very first superadmin to bootstrap before setup exists', async () => {
        await assertSucceeds(setDoc(doc(ctx(OUTSIDER), 'superadminUsers', OUTSIDER), { role: 'superadmin' }));
    });

    it('never lets a user create a superadmin record for someone else', async () => {
        await assertFails(setDoc(doc(ctx(OUTSIDER), 'superadminUsers', ADMIN), { role: 'superadmin' }));
    });

    it('cannot be deleted, even by its owner', async () => {
        await assertFails(deleteDoc(doc(ctx(SUPERADMIN), 'superadminUsers', SUPERADMIN)));
    });

    it('cannot be updated, even by its owner', async () => {
        await assertFails(setDoc(doc(ctx(SUPERADMIN), 'superadminUsers', SUPERADMIN), { role: 'superadmin', x: 1 }));
    });
});

describe('systemConfig/setup', () => {
    it('is publicly readable so first-run setup can check status', async () => {
        await assertSucceeds(getDoc(doc(ctx(null), 'systemConfig', 'setup')));
    });

    it('cannot be read at other document ids', async () => {
        await assertFails(getDoc(doc(ctx(null), 'systemConfig', 'other')));
    });

    it('cannot be updated by an ordinary signed-in user once it exists', async () => {
        await testEnv.withSecurityRulesDisabled(async c => {
            await setDoc(doc(c.firestore(), 'systemConfig', 'setup'), { setupComplete: true });
        });
        await assertFails(setDoc(doc(ctx(OUTSIDER), 'systemConfig', 'setup'), { setupComplete: false }));
    });
});

describe('undeclared collections fail closed', () => {
    it('denies reads of a collection with no rule', async () => {
        await assertFails(getDoc(doc(ctx(ADMIN), `organizations/${ORG}/auditLog`, 'x')));
    });

    it('denies writes to a collection with no rule', async () => {
        await assertFails(setDoc(doc(ctx(ADMIN), `organizations/${ORG}/auditLog`, 'x'), { a: 1 }));
    });
});

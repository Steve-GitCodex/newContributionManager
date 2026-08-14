// Adds a member to the current organization.
// The auth account is provisioned on a throwaway Firebase app so the admin's own
// session on the default app is never replaced.

const MemberInvite = (function () {
    const ROLES = {
        admin: 'Admin',
        editor: 'Staff',
        viewer: 'Member'
    };

    function validate(email, password, role) {
        if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
        if (!password || password.length < 8) throw new Error('The starter password must be at least 8 characters.');
        if (!Object.prototype.hasOwnProperty.call(ROLES, role)) throw new Error('Choose a role.');
    }

    async function provisionAccount(email, password) {
        const app = firebase.initializeApp(FirebaseManager.getApp().options, `invite_${Date.now()}`);

        try {
            const auth = firebase.auth(app);
            try {
                const created = await auth.createUserWithEmailAndPassword(email, password);
                return { uid: created.user.uid, created: true };
            } catch (error) {
                if (error.code !== 'auth/email-already-in-use') throw error;
                try {
                    const signedIn = await auth.signInWithEmailAndPassword(email, password);
                    return { uid: signedIn.user.uid, created: false };
                } catch {
                    throw new Error('That email already has an account. Enter its existing password to add it to this organization.');
                }
            }
        } finally {
            await app.delete();
        }
    }

    async function invite(email, password, role) {
        const trimmed = String(email || '').trim().toLowerCase();
        validate(trimmed, password, role);

        const existing = await OrgDb.getAll('users');
        for (const uid of Object.keys(existing)) {
            if (existing[uid] && String(existing[uid].email || '').toLowerCase() === trimmed) {
                throw new Error(`${trimmed} is already a member of this organization.`);
            }
        }

        const { uid, created } = await provisionAccount(trimmed, password);

        await OrgDb.setOne('users', uid, {
            email: trimmed,
            role,
            createdAt: new Date().toISOString()
        });

        return { uid, email: trimmed, role, accountCreated: created };
    }

    return { ROLES, invite, validate };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemberInvite;
}

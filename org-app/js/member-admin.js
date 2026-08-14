// Role changes and removals for the current organization's members.
// Removal revokes org access only — the Firebase Auth account itself survives,
// since deleting it needs the Admin SDK.

const MemberAdmin = (function () {
    const ROLES = {
        admin: 'Admin',
        editor: 'Staff',
        viewer: 'Member'
    };

    function adminUids(members) {
        return Object.keys(members).filter(uid => members[uid] && members[uid].role === 'admin');
    }

    function refuseRemoval(members, uid, currentUid) {
        if (uid === currentUid) return 'You cannot remove yourself from the organization.';

        const admins = adminUids(members);
        if (admins.length === 1 && admins[0] === uid) {
            return 'This is the only admin. Promote someone else first, or the organization is left with no one who can manage it.';
        }

        return null;
    }

    function refuseRoleChange(members, uid, newRole) {
        if (!Object.prototype.hasOwnProperty.call(ROLES, newRole)) return 'Choose a role.';

        const admins = adminUids(members);
        if (newRole !== 'admin' && admins.length === 1 && admins[0] === uid) {
            return 'This is the only admin. Promote someone else before changing this role.';
        }

        return null;
    }

    async function loadMembers() {
        return OrgDb.getAll('users');
    }

    async function changeRole(uid, newRole) {
        const members = await loadMembers();
        const refusal = refuseRoleChange(members, uid, newRole);
        if (refusal) throw new Error(refusal);

        await OrgDb.doc('users', uid).update({ role: newRole });
    }

    async function remove(uid, currentUid) {
        const members = await loadMembers();
        const refusal = refuseRemoval(members, uid, currentUid);
        if (refusal) throw new Error(refusal);

        await OrgDb.doc('users', uid).delete();
        return members[uid] || {};
    }

    return { ROLES, refuseRemoval, refuseRoleChange, loadMembers, changeRole, remove };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemberAdmin;
}

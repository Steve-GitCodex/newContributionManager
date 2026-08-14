// Lets a signed-in member replace the starter password an admin gave them.
// Firebase requires a recent login before a password change, so the current
// password is re-submitted as a credential rather than relying on session age.

const PasswordChange = (function () {
    const MIN_LENGTH = 8;

    function userFacing(message) {
        const error = new Error(message);
        error.userFacing = true;
        return error;
    }

    function validate(currentPassword, newPassword, confirmPassword) {
        if (!currentPassword) return 'Enter your current password.';
        if (!newPassword || newPassword.length < MIN_LENGTH) return `The new password must be at least ${MIN_LENGTH} characters.`;
        if (newPassword !== confirmPassword) return 'The new passwords do not match.';
        if (newPassword === currentPassword) return 'The new password must be different from the current one.';
        return null;
    }

    async function change(currentPassword, newPassword, confirmPassword) {
        const refusal = validate(currentPassword, newPassword, confirmPassword);
        if (refusal) throw userFacing(refusal);

        const user = FirebaseManager.getAuth().currentUser;
        if (!user) throw userFacing('Your session has expired. Sign in again to change your password.');

        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        try {
            await user.reauthenticateWithCredential(credential);
        } catch (error) {
            const code = error && error.code;
            if (code === 'auth/too-many-requests') throw userFacing('Too many attempts. Wait a few minutes and try again.');
            throw userFacing('Your current password is incorrect.');
        }

        await user.updatePassword(newPassword);
    }

    function init() {
        const form = document.getElementById('password-change-form');
        if (!form) return;

        form.addEventListener('submit', async event => {
            event.preventDefault();

            const current = document.getElementById('current-password');
            const next = document.getElementById('new-password');
            const confirm = document.getElementById('confirm-password');
            const button = form.querySelector('button[type="submit"]');

            if (button) button.disabled = true;

            try {
                await change(current.value, next.value, confirm.value);
                form.reset();
                Swal.fire({
                    icon: 'success',
                    title: 'Password changed',
                    text: 'Use your new password the next time you sign in.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    customClass: { container: 'swal-alert' }
                });
            } catch (error) {
                await ErrorHandler.showError(error, 'Password Not Changed');
            } finally {
                if (button) button.disabled = false;
            }
        });
    }

    return { MIN_LENGTH, validate, change, init };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordChange;
}

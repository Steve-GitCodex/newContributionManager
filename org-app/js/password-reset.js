// Firebase password-reset email, offered on the login screen and in Settings.
// An unknown address reports the same thing as a known one, so the screen never
// reveals whether an email is registered.

const PasswordReset = (function () {
    const SENT_MESSAGE = 'If that address has an account, a reset link is on its way. Check the spam folder too.';

    function userFacing(message) {
        const error = new Error(message);
        error.userFacing = true;
        return error;
    }

    async function send(email) {
        const address = String(email || '').trim().toLowerCase();
        if (!address || !address.includes('@')) throw userFacing('Enter a valid email address.');

        try {
            await FirebaseManager.getAuth().sendPasswordResetEmail(address);
        } catch (error) {
            const code = error && error.code;
            if (code === 'auth/user-not-found') return SENT_MESSAGE;
            if (code === 'auth/invalid-email') throw userFacing('Enter a valid email address.');
            if (code === 'auth/too-many-requests') throw userFacing('Too many attempts. Wait a few minutes and try again.');
            if (code === 'auth/network-request-failed') throw userFacing('No connection. Check your network and try again.');
            throw userFacing('Could not send the reset email. Try again in a moment.');
        }

        return SENT_MESSAGE;
    }

    async function announce(email) {
        try {
            const message = await send(email);
            await Swal.fire({
                icon: 'success',
                title: 'Check your email',
                text: message,
                customClass: { container: 'swal-alert' }
            });
        } catch (error) {
            await ErrorHandler.showError(error, 'Reset Not Sent');
        }
    }

    async function promptAndSend(prefill = '') {
        const { value: email } = await Swal.fire({
            title: 'Reset your password',
            input: 'email',
            inputValue: prefill,
            inputPlaceholder: 'your@email.com',
            text: 'We will email you a link to set a new password.',
            showCancelButton: true,
            confirmButtonText: 'Send link',
            cancelButtonText: 'Cancel',
            customClass: { container: 'swal-alert' }
        });

        if (!email) return;
        await announce(email);
    }

    function initLoginLink() {
        const link = document.getElementById('forgot-password-link');
        if (!link) return;

        link.addEventListener('click', event => {
            event.preventDefault();
            promptAndSend(document.getElementById('login-email')?.value || '');
        });
    }

    function initSettingsButton() {
        const button = document.getElementById('send-password-reset');
        if (!button) return;

        button.addEventListener('click', async () => {
            const user = FirebaseManager.getAuth().currentUser;
            if (!user) return;

            button.disabled = true;
            await announce(user.email);
            button.disabled = false;
        });
    }

    return { SENT_MESSAGE, send, promptAndSend, initLoginLink, initSettingsButton };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordReset;
}

// The SweetAlert shapes the handler modules share.

const Dialogs = (function () {
    const container = { container: 'swal-alert' };

    return {
        confirm(title, text, confirmText = 'Yes', icon = 'warning') {
            return Swal.fire({
                title,
                text,
                icon,
                showCancelButton: true,
                confirmButtonText: confirmText,
                cancelButtonText: 'Cancel',
                customClass: container
            });
        },

        success(title, text = '', timer = 2000) {
            return Swal.fire({
                icon: 'success',
                title,
                text,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer,
                customClass: container
            });
        },

        error(title, text, icon = 'error') {
            return Swal.fire({ icon, title, text, customClass: container });
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dialogs;
}

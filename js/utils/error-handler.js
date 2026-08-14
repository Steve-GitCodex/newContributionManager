/**
 * Error Handler Utility
 * Provides consistent error handling, user feedback, and error logging
 * Production-safe: No sensitive data logged, only relevant error context
 */

const ErrorHandler = (() => {
  const ERROR_MESSAGES = {
    // Auth errors
    'auth/email-already-in-use': 'This email is already registered. Please use a different email or try logging in.',
    'auth/weak-password': 'Password must be at least 6 characters long.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    // Deliberately identical to invalid-credential: a login must never reveal
    // whether an email is registered.
    'auth/user-not-found': 'Incorrect email or password. Please try again.',
    'auth/wrong-password': 'Incorrect email or password. Please try again.',
    // SDK 12.x emits invalid-credential, 9.x emits invalid-login-credentials.
    'auth/invalid-credential': 'Incorrect email or password. Please try again.',
    'auth/invalid-login-credentials': 'Incorrect email or password. Please try again.',
    'auth/missing-password': 'Please enter your password.',
    'auth/network-request-failed': 'Could not reach the server. Check your connection and try again.',
    'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',

    // Firebase errors
    'permission-denied': 'You do not have permission to perform this action.',
    'not-found': 'The requested resource was not found.',
    'already-exists': 'This resource already exists.',
    'unavailable': 'Service is temporarily unavailable. Please try again later.',
    'network-error': 'Network error. Please check your connection and try again.',

    // Generic fallbacks
    'default': 'An unexpected error occurred. Please try again or contact support if the problem persists.'
  };

  /**
   * Extract user-friendly message from error object
   * @param {Error|Object} error - The error object
   * @returns {string} User-friendly error message
   */
  function getUserMessage(error) {
    if (!error) return ERROR_MESSAGES.default;

    // Errors we raise ourselves and mean for the user; everything else is sanitized
    // so an internal message never reaches the screen.
    if (error.userFacing && error.message) return error.message;

    // Check Firebase auth error code
    if (error.code) {
      return ERROR_MESSAGES[error.code] || ERROR_MESSAGES.default;
    }

    // Check for common error patterns
    if (error.message) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('connection')) {
        return ERROR_MESSAGES['network-error'];
      }
      if (message.includes('permission')) {
        return ERROR_MESSAGES['permission-denied'];
      }
    }

    return ERROR_MESSAGES.default;
  }

  /**
   * Show error to user with SweetAlert
   * @param {Error|Object} error - The error object
   * @param {string} title - Optional custom title
   * @param {Object} options - Optional SweetAlert options
   */
  async function showError(error, title = null, options = {}) {
    const message = getUserMessage(error);
    const defaultTitle = title || 'Error';

    return Swal.fire({
      icon: 'error',
      title: defaultTitle,
      text: message,
      confirmButtonText: 'OK',
      allowOutsideClick: false,
      ...options
    });
  }

  /**
   * Show error toast (brief notification)
   * @param {Error|Object} error - The error object
   * @param {string} title - Optional custom title
   */
  async function showErrorToast(error, title = 'Error') {
    const message = getUserMessage(error);

    return Swal.fire({
      icon: 'error',
      title: title,
      text: message,
      toast: true,
      position: 'top-end',
      timer: 4000,
      timerProgressBar: true,
      showConfirmButton: false
    });
  }

  /**
   * Handle async operation with error management
   * @param {Function} operation - Async function to execute
   * @param {string} context - Description of what operation is doing (for logging)
   * @param {Object} options - { showUI: true, onError: null }
   * @returns {Promise} Result of operation or null if error
   */
  async function handle(operation, context = 'Operation', options = {}) {
    const { showUI = true, onError = null } = options;

    try {
      return await operation();
    } catch (error) {
      // Log for debugging (production environment should disable this)
      if (window.DEBUG_MODE) {
        console.error(`[${context}] Error:`, error);
      }

      // Call custom error handler if provided
      if (typeof onError === 'function') {
        onError(error);
      }

      // Show user feedback if requested
      if (showUI) {
        await showErrorToast(error, context);
      }

      return null;
    }
  }

  /**
   * Validate required parameters
   * @param {Object} params - Object with param names as keys
   * @param {Array} required - Array of required param names
   * @throws {Error} If required params are missing
   */
  function validateRequired(params, required) {
    for (const param of required) {
      if (params[param] === undefined || params[param] === null || params[param] === '') {
        throw new Error(`Required parameter missing: ${param}`);
      }
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {boolean} True if password is at least 6 characters
   */
  function isValidPassword(password) {
    return password && password.length >= 6;
  }

  return {
    getUserMessage,
    showError,
    showErrorToast,
    handle,
    validateRequired,
    isValidEmail,
    isValidPassword
  };
})();

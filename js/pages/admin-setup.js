/**
 * Admin Setup Page
 * One-time initialization of the first super admin account
 */

class AdminSetupPage {
  constructor() {
    this.firebaseService = null;
  }

  async init(firebaseService) {
    this.firebaseService = firebaseService;

    // Check if setup is needed
    const setupNeeded = await this.checkIfSetupNeeded();
    
    if (!setupNeeded) {
      // Setup already completed, redirect to login
      console.log('Setup already completed, redirecting to login');
      Swal.fire({
        icon: 'info',
        title: 'Setup Already Complete',
        text: 'Redirecting to login page...',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        window.location.href = '/pages/superadmin/login.html';
      });
      return;
    }

    this.setupEventListeners();
  }

  async checkIfSetupNeeded() {
    try {
      const setupStatus = await this.firebaseService.centralGet('systemConfig', 'setup');
      const setupNeeded = !setupStatus || !setupStatus.exists || !setupStatus.data?.setupComplete;
      console.log('Setup needed:', setupNeeded);
      return setupNeeded;
    } catch (error) {
      console.error('Failed to check setup status:', error);
      
      // If permission error, assume setup is needed
      if (error.code === 'permission-denied') {
        console.warn('Permission denied - assuming setup is needed');
        return true;
      }
      
      // For other errors, also assume setup is needed
      console.warn('Error checking setup status - assuming setup is needed');
      return true;
    }
  }

  setupEventListeners() {
    const form = document.querySelector('#setupForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const confirmPassword = document.querySelector('#confirmPassword').value;

    if (!this.validateInputs(email, password, confirmPassword)) {
      return;
    }

    try {
      const button = document.querySelector('#setupForm button[type="submit"]');
      button.disabled = true;

      Swal.fire({
        title: 'Creating Admin Account...',
        didOpen: () => { Swal.showLoading(); },
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false
      });

      // Create user in Firebase Auth
      const result = await this.firebaseService.createUserWithEmailAndPassword(email, password);
      const uid = result.user.uid;

      // Create superadmin user document in Firestore
      await this.firebaseService.centralSet('superadminUsers', uid, {
        uid: uid,
        email: email,
        role: 'superadmin',
        createdAt: new Date().toISOString(),
        setupCompletedAt: new Date().toISOString()
      });

      // Create user document in Firestore
      await this.firebaseService.centralSet('users', uid, {
        uid: uid,
        email: email,
        role: 'superadmin',
        createdAt: new Date().toISOString()
      });

      // Mark setup as complete in public systemConfig document
      await this.firebaseService.centralSet('systemConfig', 'setup', {
        setupComplete: true,
        completedAt: new Date().toISOString()
      });

      console.log('Super admin account created:', email);

      Swal.fire({
        icon: 'success',
        title: 'Setup Complete!',
        text: 'Your admin account has been created. Redirecting to login...',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        window.location.href = '/pages/superadmin/login.html';
      });
    } catch (error) {
      console.error('Setup error:', error);

      let errorMessage = 'Setup failed. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 8 characters with uppercase, lowercase, and numbers.';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Setup has already been completed for this deployment.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Setup Failed',
        text: errorMessage,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000
      });

      const button = document.querySelector('#setupForm button[type="submit"]');
      if (button) button.disabled = false;
    }
  }

  validateInputs(email, password, confirmPassword) {
    // Email validation
    if (!email || !email.includes('@')) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Email',
        text: 'Please enter a valid email address.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      return false;
    }

    // Password validation
    if (!password || password.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Weak Password',
        text: 'Password must be at least 8 characters long.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      return false;
    }

    // Password match validation
    if (password !== confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Password Mismatch',
        text: 'Passwords do not match. Please try again.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
      return false;
    }

    return true;
  }
}

// Initialize setup page with robust timing handling
async function initializeSetupPage() {
  try {
    // Check if services are already available
    let services = window.appServices;
    
    if (!services) {
      // Services not ready yet, wait for appReady event
      services = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('App initialization timeout'));
        }, 10000);
        
        const handler = (event) => {
          clearTimeout(timeout);
          window.removeEventListener('appReady', handler);
          resolve(event.detail.services);
        };
        
        window.addEventListener('appReady', handler);
      });
    }
    
    const { firebaseService } = services;
    
    const setupPage = new AdminSetupPage();
    await setupPage.init(firebaseService);
  } catch (error) {
    console.error('Failed to initialize setup page:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Initialization Error',
        text: error.message
      });
    }
  }
}

// Start initialization when DOM is ready or services are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSetupPage);
} else {
  initializeSetupPage();
}

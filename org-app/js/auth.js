let userauth;
let currentUser = null;
let authSection;
let onAuthStateChangedCallback = () => {};

/**
 * Initialize authentication module
 * @param {Object} firebaseAuth - Firebase Auth instance
 * @param {string} authContainerSelector - CSS selector for auth container
 * @returns {Promise} Resolves when auth state is first determined
 */
function initAuth(firebaseAuth, authContainerSelector) {
    return new Promise((resolve) => {
        if (!firebaseAuth) {
            throw new Error('Firebase Auth instance is required');
        }

        userauth = firebaseAuth;
        authSection = document.querySelector(authContainerSelector);
        
        // Create auth section if not found in DOM
        if (!authSection) {
            const container = document.querySelector('.container');
            const mainElement = container?.querySelector('main');
            
            authSection = document.createElement('section');
            authSection.className = 'auth-section';
            
            if (container && mainElement) {
                container.insertBefore(authSection, mainElement);
            }
        }
        
        // Set up auth state change listener
        userauth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in - load user data
                await setupUserData(user);
                showAuthenticatedUI(user);
                onAuthStateChangedCallback(user);
            } else {
                // User is signed out
                currentUser = null;
                showLoginUI();
                onAuthStateChangedCallback(null);
            }
            
            resolve();
        });
    });
}

// The rules already grant a super admin access to every organization; this lets the
// UI match, so a super admin is not locked out of an org they did not join.
async function isSuperadmin(uid) {
    try {
        const snapshot = await FirebaseManager.getFirestore().collection('superadminUsers').doc(uid).get();
        return snapshot.exists;
    } catch {
        return false;
    }
}

/**
 * Set up user data from database
 * @param {Object} user - Firebase auth user
 */
// The rules deny the membership read itself to a non-member, so a removed member and
// a superadmin who never joined both arrive here as permission-denied, not as null.
async function readMembership(uid) {
    try {
        return await OrgDb.getOne('users', uid);
    } catch (error) {
        if (error && error.code === 'permission-denied') return null;
        throw error;
    }
}

async function setupUserData(user) {
    try {
        const membership = await readMembership(user.uid);

        if (membership) {
            user.role = membership.role || 'viewer';
        } else if (await isSuperadmin(user.uid)) {
            user.role = 'admin';
        } else {
            const refusal = new Error(`You are not a member of ${window.orgName || 'this organization'}. Ask an administrator to invite you.`);
            refusal.userFacing = true;
            throw refusal;
        }

        currentUser = user;
    } catch (error) {
        await ErrorHandler.showError(error, 'Authentication Error');
        logoutUser();
    }
}

/**
 * Set callback for auth state changes
 * @param {Function} callback - Function to call when auth state changes
 */
function setAuthStateChangedCallback(callback) {
    if (typeof callback === 'function') {
        onAuthStateChangedCallback = callback;
    }
}

/**
 * Display the login form
 */
function showLoginUI() {
    const homeLink = document.querySelector('.home-link');
    if (homeLink) {
        homeLink.style.display = 'flex';
    }

    removeLoadingSpinner();

    if (!authSection) return;
    
    const orgName = window.orgName || 'ContriFlow';
    const orgInitial = orgName.charAt(0).toUpperCase();
    
    authSection.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <div class="org-logo">${orgInitial}</div>
                    <h1>${InputValidator.sanitizeHTML(orgName)}</h1>
                    <p class="auth-subtitle">Manage your group contributions with ease</p>
                </div>

                <form id="login-form" class="auth-form active-form">
                    <div class="form-group">
                        <label for="login-email">Email Address</label>
                        <div class="input-wrapper">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="login-email" placeholder="your@email.com" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="login-password" placeholder="Enter your password" required autocomplete="current-password">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                </form>

                <p class="auth-note">Accounts are created by your organization's administrator.</p>
            </div>
        </div>
    `;
    
    attachFormHandlers();
}

function attachFormHandlers() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

/**
 * Remove loading spinner from DOM
 */
function removeLoadingSpinner() {
    const spinner = document.getElementById('initial-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
        setTimeout(() => {
            if (spinner.parentNode) {
                spinner.remove();
            }
        }, 300);
    }
}

/**
 * Display authenticated user UI
 * @param {Object} user - Firebase auth user object
 */
function showAuthenticatedUI(user) {
    if (!user || !currentUser) return;

    const homeLink = document.querySelector('.home-link');
    if (homeLink) {
        homeLink.style.display = 'none';
    }

    removeLoadingSpinner();

    if (!authSection) return;

    const adminButton = user.role === 'admin' 
        ? '<button id="admin-dashboard-btn" class="btn btn-small"><i class="fas fa-user-shield"></i> Admin</button>'
        : '';
    
    authSection.innerHTML = `
        <div class="user-info">
            <div class="user-details">
                <i class="fas fa-user-circle"></i>
                <span class="user-email">${InputValidator.sanitizeHTML(user.email)}</span>
                <span class="user-role-badge">${InputValidator.sanitizeHTML(user.role)}</span>
            </div>
            <div class="user-actions">
                ${adminButton}
                <button id="logout-btn" class="btn btn-small"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
        </div>
    `;
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }

    if (user.role === 'admin') {
        const adminBtn = document.getElementById('admin-dashboard-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', showAdminDashboard);
        }
    }
}

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    // Validate inputs
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    if (!emailInput || !passwordInput) {
        await ErrorHandler.showErrorToast(new Error('Form elements not found'), 'Form Error');
        return;
    }

    const emailValidation = InputValidator.validateEmail(emailInput.value);
    const passwordValidation = InputValidator.validatePassword(passwordInput.value);

    if (!emailValidation.valid || !passwordValidation.valid) {
        const errorMessage = emailValidation.error || passwordValidation.error;
        await ErrorHandler.showErrorToast(new Error(errorMessage), 'Validation Error');
        return;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    Swal.fire({
        title: 'Logging In...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });

    let failure = null;
    try {
        await userauth.signInWithEmailAndPassword(emailValidation.value, passwordInput.value);
    } catch (error) {
        failure = error;
    }

    Swal.close();
    if (submitButton) submitButton.disabled = false;

    if (failure) await ErrorHandler.showErrorToast(failure, 'Login Failed');
}

/**
 * Log out the current user
 */
async function logoutUser() {
    await ErrorHandler.handle(
        async () => userauth.signOut(),
        'Logout',
        { showUI: false }
    );
}

/**
 * Navigate to admin dashboard
 */
function showAdminDashboard() {
    window.location.href = 'admin-dashboard.html';
}

/**
 * Check if current user is authenticated
 * @returns {boolean}
 */
function isUserAuthenticated() {
    return currentUser !== null;
}

/**
 * Get current authenticated user object
 * @returns {Object|null} Firebase user object or null
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Get current user's role
 * @returns {string} User role (admin, editor, or viewer)
 */
function getUserRole() {
    return currentUser?.role || 'viewer';
}

// Export functions for use in app.js
window.AuthModule = {
    initAuth,
    setAuthStateChangedCallback,
    isUserAuthenticated,
    getCurrentUser,
    getUserRole,
    logoutUser
};

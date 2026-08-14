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
async function setupUserData(user) {
    try {
        const membership = await OrgDb.getOne('users', user.uid);

        if (membership) {
            user.role = membership.role || 'viewer';
        } else if (await isSuperadmin(user.uid)) {
            user.role = 'admin';
        } else {
            throw new Error(`You are not a member of ${window.orgName || 'this organization'}. Ask an administrator to invite you.`);
        }

        currentUser = user;
    } catch (error) {
        await ErrorHandler.showError(error, 'Authentication Error', {
            text: 'Failed to load user data. Please try again.'
        });
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
 * Display login and signup forms
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

                <div class="auth-tabs">
                    <button type="button" class="auth-tab active" id="login-tab-btn" data-tab="login">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                    <button type="button" class="auth-tab" id="signup-tab-btn" data-tab="signup">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
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
                
                <form id="signup-form" class="auth-form">
                    <div class="form-group">
                        <label for="signup-email">Email Address</label>
                        <div class="input-wrapper">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="signup-email" placeholder="your@email.com" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="signup-password">Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="signup-password" placeholder="Create a password (min. 6 characters)" required autocomplete="new-password">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="signup-confirm">Confirm Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="signup-confirm" placeholder="Confirm your password" required autocomplete="new-password">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
                </form>
            </div>
        </div>
    `;
    
    attachFormHandlers();
}

/**
 * Attach event listeners to login/signup forms
 */
function attachFormHandlers() {
    const loginTab = document.getElementById('login-tab-btn');
    const signupTab = document.getElementById('signup-tab-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // Tab switching
    if (loginTab) {
        loginTab.addEventListener('click', () => switchAuthTab('login'));
    }
    if (signupTab) {
        signupTab.addEventListener('click', () => switchAuthTab('signup'));
    }

    // Form submission
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}

/**
 * Switch between login and signup tabs
 * @param {string} tab - Tab name: 'login' or 'signup'
 */
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab-btn');
    const signupTab = document.getElementById('signup-tab-btn');

    if (tab === 'login') {
        loginForm?.classList.add('active-form');
        signupForm?.classList.remove('active-form');
        loginTab?.classList.add('active');
        signupTab?.classList.remove('active');
    } else {
        signupForm?.classList.add('active-form');
        loginForm?.classList.remove('active-form');
        signupTab?.classList.add('active');
        loginTab?.classList.remove('active');
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

    await ErrorHandler.handle(
        async () => {
            Swal.fire({
                title: 'Logging In...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            await userauth.signInWithEmailAndPassword(emailValidation.value, passwordInput.value);
            Swal.close();
        },
        'Login',
        { showUI: false }
    );
}

/**
 * Handle signup form submission
 * @param {Event} e - Form submit event
 */
async function handleSignup(e) {
    e.preventDefault();
    
    // Validate inputs
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm');
    
    if (!emailInput || !passwordInput || !confirmInput) {
        await ErrorHandler.showErrorToast(new Error('Form elements not found'), 'Form Error');
        return;
    }

    const emailValidation = InputValidator.validateEmail(emailInput.value);
    const passwordValidation = InputValidator.validatePassword(passwordInput.value);
    const matchValidation = InputValidator.validatePasswordMatch(passwordInput.value, confirmInput.value);

    if (!emailValidation.valid || !passwordValidation.valid || !matchValidation.valid) {
        const errorMessage = emailValidation.error || passwordValidation.error || matchValidation.error;
        await ErrorHandler.showErrorToast(new Error(errorMessage), 'Validation Error');
        return;
    }

    await ErrorHandler.handle(
        async () => {
            Swal.fire({
                title: 'Creating Account...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            await userauth.createUserWithEmailAndPassword(emailValidation.value, passwordInput.value);
            Swal.close();
        },
        'Account Creation',
        { showUI: false }
    );
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
 * Load and display user list for admin management
 */
async function loadUserList() {
    const userListElement = document.getElementById('user-list');
    if (!userListElement) return;

    const result = await ErrorHandler.handle(
        async () => {
            return await OrgDb.getAll('users');
        },
        'Load Users',
        { showUI: false }
    );

    if (!result) {
        userListElement.innerHTML = '<p>Unable to load user list. Please try again.</p>';
        return;
    }

    if (Object.keys(result).length === 0) {
        userListElement.innerHTML = '<p>No users found</p>';
        return;    }

    let userTable = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const [uid, user] of Object.entries(result)) {
        if (!user || !user.email) continue;
        
        userTable += `
            <tr>
                <td>${InputValidator.sanitizeHTML(user.email)}</td>
                <td>
                    <select class="role-select" data-uid="${InputValidator.sanitizeHTML(uid)}">
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Member</option>
                        <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Staff</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-small save-role" data-uid="${InputValidator.sanitizeHTML(uid)}">Save</button>
                </td>
            </tr>
        `;
    }
    
    userTable += `
            </tbody>
        </table>
    `;
    
    userListElement.innerHTML = userTable;
    
    // Attach event listeners
    document.querySelectorAll('.save-role').forEach(btn => {
        btn.addEventListener('click', updateUserRole);
    });
}

/**
 * Update user role in database
 * @param {Event} e - Click event from save button
 */
async function updateUserRole(e) {
    const uid = e.target.dataset.uid;
    const roleSelect = document.querySelector(`.role-select[data-uid="${uid}"]`);
    
    if (!roleSelect) return;

    const newRole = roleSelect.value;
    const result = await ErrorHandler.handle(
        async () => {
            await OrgDb.doc('users', uid).update({ role: newRole });
            return true;
        },
        'Update User Role',
        { showUI: true }
    );

    if (result) {
        await ErrorHandler.showErrorToast(
            { message: 'User role updated successfully' },
            'Success'
        );
    }
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
    logoutUser,
    loadUserList
};

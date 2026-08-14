/**
 * State Manager
 * Centralized state management for App 1
 * Single source of truth for authentication and organization context
 */

class StateManager {
  constructor() {
    this.state = {
      // Auth state
      currentUser: null,
      currentUserRole: null,
      isSuperAdmin: false,

      // Organization state
      userOrganizations: [],
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,

      // Application state
      appInitialized: false,
      isLoading: false,
      error: null,

      // Metadata
      lastUpdated: null
    };

    /**
     * Listeners for state changes
     * Format: { [changeType]: [{ callback, context }] }
     */
    this.listeners = {};

    /**
     * History for undo/redo capability
     * Starts empty, first state is saved on first mutation
     */
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;

    Object.freeze(this.state);
  }

  /**
   * Get current state (returns frozen copy to prevent mutations)
   */
  getState() {
    return Object.freeze({ ...this.state });
  }

  /**
   * Get specific state value
   */
  getValue(path) {
    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }

  /**
   * Set user after authentication
   */
  setCurrentUser(user) {
    if (!user || !user.uid || !user.email) {
      throw new Error('User object is required with uid and email');
    }

    this.state = {
      ...this.state,
      currentUser: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null
      },
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('userChanged', { user: this.state.currentUser });
  }

  /**
   * Set user role
   */
  setUserRole(role) {
    if (!role) {
      throw new Error('Role is required');
    }

    const isSuperAdmin = role === 'superadmin';

    this.state = {
      ...this.state,
      currentUserRole: role,
      isSuperAdmin: isSuperAdmin,
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('roleChanged', { role, isSuperAdmin });
  }

  /**
   * Set user's organizations
   */
  setUserOrganizations(organizations) {
    if (!Array.isArray(organizations)) {
      throw new Error('Organizations must be an array');
    }

    this.state = {
      ...this.state,
      userOrganizations: [...organizations],
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('organizationsChanged', { organizations: this.state.userOrganizations });
  }

  /**
   * Add organization to user's list
   */
  addUserOrganization(organization) {
    if (!organization || !organization.slug) {
      throw new Error('Valid organization object with slug is required');
    }

    const exists = this.state.userOrganizations.some(org => org.slug === organization.slug);
    if (exists) {
      return; // Already exists
    }

    this.state = {
      ...this.state,
      userOrganizations: [...this.state.userOrganizations, organization],
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('organizationAdded', { organization });
  }

  /**
   * Remove organization from user's list
   */
  removeUserOrganization(slug) {
    if (!slug) {
      throw new Error('Organization slug is required');
    }

    const filtered = this.state.userOrganizations.filter(org => org.slug !== slug);

    if (filtered.length === this.state.userOrganizations.length) {
      return; // Didn't exist
    }

    this.state = {
      ...this.state,
      userOrganizations: filtered,
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('organizationRemoved', { slug });
  }

  /**
   * Set current organization context
   */
  setCurrentOrganization(organization) {
    if (!organization) {
      throw new Error('Organization object is required');
    }

    if (!organization.slug) {
      throw new Error('Organization must have a slug');
    }

    this.state = {
      ...this.state,
      currentOrganization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        status: organization.status,
        createdAt: organization.createdAt
      },
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('currentOrgChanged', { org: this.state.currentOrganization });
  }

  /**
   * Clear current organization (on logout or switch)
   */
  clearCurrentOrganization() {
    this.state = {
      ...this.state,
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('currentOrgCleared');
  }

  /**
   * Set organization Firebase app instance
   */
  setOrgFirebaseApp(app) {
    this.state = {
      ...this.state,
      currentOrgFirebaseApp: app,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Set organization Firebase database instance
   */
  setOrgDatabase(database) {
    this.state = {
      ...this.state,
      currentOrgDatabase: database,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Set app initialization status
   */
  setAppInitialized(initialized) {
    this.state = {
      ...this.state,
      appInitialized: initialized,
      lastUpdated: new Date().toISOString()
    };

    this.notify('appInitStatus', { initialized });
  }

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    this.state = {
      ...this.state,
      isLoading: isLoading,
      lastUpdated: new Date().toISOString()
    };

    this.notify('loadingChanged', { isLoading });
  }

  /**
   * Set error state
   */
  setError(error) {
    this.state = {
      ...this.state,
      error: error ? { message: error.message, timestamp: new Date().toISOString() } : null,
      lastUpdated: new Date().toISOString()
    };

    this.notify('errorChanged', { error: this.state.error });
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setError(null);
  }

  /**
   * Clear all user data (logout)
   */
  clearUserData() {
    this.state = {
      currentUser: null,
      currentUserRole: null,
      isSuperAdmin: false,
      userOrganizations: [],
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,
      appInitialized: false,
      isLoading: false,
      error: null,
      lastUpdated: new Date().toISOString()
    };

    this.saveSnapshot();
    this.notify('userLoggedOut');
  }

  /**
   * Subscribe to state changes
   * changeType: 'userChanged', 'roleChanged', 'organizationsChanged', etc. or '*' for all
   */
  subscribe(changeType, callback, context = null) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners[changeType]) {
      this.listeners[changeType] = [];
    }

    const listener = { callback, context };
    this.listeners[changeType].push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners[changeType] = this.listeners[changeType].filter(
        l => l !== listener
      );
    };
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(changeType, callback) {
    if (!this.listeners[changeType]) return;

    this.listeners[changeType] = this.listeners[changeType].filter(
      l => l.callback !== callback
    );
  }

  /**
   * Notify listeners of state changes
   */
  notify(changeType, data = {}) {
    // Notify specific listeners
    if (this.listeners[changeType]) {
      this.listeners[changeType].forEach(({ callback, context }) => {
        try {
          callback.call(context, data, this.getState());
        } catch (error) {
          console.error(`Error in state listener for ${changeType}:`, error);
        }
      });
    }

    // Notify wildcard listeners
    if (this.listeners['*']) {
      this.listeners['*'].forEach(({ callback, context }) => {
        try {
          callback.call(context, changeType, data, this.getState());
        } catch (error) {
          console.error(`Error in wildcard state listener:`, error);
        }
      });
    }
  }

  /**
   * Save snapshot for undo/redo
   */
  saveSnapshot() {
    // Remove any redo history when new change is made
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Save current state snapshot AFTER mutation
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Undo last change
   */
  undo() {
    if (this.historyIndex <= 0) return false;

    this.historyIndex--;
    this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.notify('stateReverted', { action: 'undo' });
    return true;
  }

  /**
   * Redo last undone change
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;

    this.historyIndex++;
    this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.notify('stateReverted', { action: 'redo' });
    return true;
  }

  /**
   * Get undo/redo status
   */
  getHistoryStatus() {
    return {
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
      historySize: this.history.length
    };
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Reset instance (useful for testing)
   */
  static resetInstance() {
    StateManager.instance = null;
  }
}

const stateManager = StateManager.getInstance();

export default StateManager;

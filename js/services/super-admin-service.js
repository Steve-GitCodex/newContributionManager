import FirebaseService from './firebase-service.js';

/**
 * Super Admin Service
 * Handles organization creation and management
 * Depends on FirebaseService for central database operations
 * 
 * TODO: Integrate with actual app initialization code to provide Firebase instances
 * Services currently use dependency injection but are instantiated without parameters
 */

class SuperAdminService {
  constructor(firebaseService = null) {
    // Dependency injection with default
    this.firebaseService = firebaseService || FirebaseService.getInstance();
  }

  async initialize() {
    // FirebaseService initialization is handled independently
    return true;
  }

  async createOrganization(orgName, adminEmail, adminPassword) {
    if (!orgName || !orgName.trim()) {
      throw new Error('Organization name is required');
    }
    if (!adminEmail || !adminEmail.trim()) {
      throw new Error('Administrator email is required');
    }
    if (!adminPassword || adminPassword.length < 8) {
      throw new Error('Administrator password must be at least 8 characters');
    }

    const slug = this.generateSlug(orgName);
    const existingOrgResult = await this.firebaseService.centralGet('organizations', slug);

    if (existingOrgResult.exists) {
      throw new Error(`Organization slug already exists: ${slug}`);
    }

    const adminUid = await this.provisionAdminAccount(adminEmail.trim(), adminPassword);
    const createdAt = new Date().toISOString();

    const orgData = {
      id: this.generateId(),
      name: orgName.trim(),
      slug: slug,
      status: 'active',
      createdAt: createdAt
    };

    await this.firebaseService.centralSet('organizations', slug, orgData);
    await this.firebaseService.centralCreateNested('organizations', slug, 'users', adminUid, {
      email: adminEmail.trim(),
      role: 'admin',
      createdAt: createdAt
    });

    return {
      ...orgData,
      adminUser: { uid: adminUid, email: adminEmail.trim() }
    };
  }

  // Runs on a throwaway Firebase app so creating the account does not replace
  // the super admin's own session on the default app.
  async provisionAdminAccount(email, password) {
    const appName = `provision_${Date.now()}`;
    const provisioningApp = firebase.initializeApp(firebase.app().options, appName);

    try {
      const auth = firebase.auth(provisioningApp);

      try {
        const created = await auth.createUserWithEmailAndPassword(email, password);
        return created.user.uid;
      } catch (authError) {
        if (authError.code !== 'auth/email-already-in-use') {
          throw authError;
        }
        try {
          const signedIn = await auth.signInWithEmailAndPassword(email, password);
          return signedIn.user.uid;
        } catch {
          throw new Error('That email already has an account and the password does not match. Use a different email, or the existing password.');
        }
      }
    } finally {
      await provisioningApp.delete();
    }
  }

  async getAllOrganizations() {
    try {
      // Get all organizations from central Firestore using FirebaseService
      const organizations = await this.firebaseService.centralGetAll('organizations');
      
      return organizations;
    } catch (error) {
      throw error;
    }
  }

  async updateOrgStatus(slug, status) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      // If status is 'deleted', completely remove from Firestore using FirebaseService
      if (status === 'deleted') {
        await this.firebaseService.centralDelete('organizations', slug);
      } else {
        // For other statuses, just update the status field using FirebaseService
        await this.firebaseService.centralUpdate('organizations', slug, {
          status: status,
          updatedAt: new Date().toISOString()
        });
      }

      return { slug, status };
    } catch (error) {
      throw error;
    }
  }

  async updateOrganization(slug, updates) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      // Update organization fields in Firestore using FirebaseService
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.firebaseService.centralUpdate('organizations', slug, updateData);
      return { slug, ...updates };
    } catch (error) {
      throw error;
    }
  }

  generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  generateId() {
    return `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getInstance() {
    if (!SuperAdminService.instance) {
      SuperAdminService.instance = new SuperAdminService();
    }
    return SuperAdminService.instance;
  }
}

const superAdminService = SuperAdminService.getInstance();

export default SuperAdminService;

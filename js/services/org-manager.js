import FirebaseService from './firebase-service.js';

/**
 * Organization Manager Service
 * Manages current organization context and multi-tenant operations
 * Merged functionality from OrgLoader - handles both org context AND Firebase initialization
 * 
 * Depends on FirebaseService for database operations
 * Optionally updates StateManager with organization state
 */

class OrgManager {
  constructor(firebaseService = null, stateManager = null) {
    // Dependency injection with defaults
    this.firebaseService = firebaseService || FirebaseService.getInstance();
    this.stateManager = stateManager || null; // Optional StateManager for state updates

    this.currentOrg = null;
    this.userOrganizations = [];
    this.orgDatabase = null;
    this.orgFirebaseApp = null;
    
    // Firebase instance caching (merged from OrgLoader)
    this.loadedInstances = {};
  }

  async initialize() {
    // FirebaseService initialization is handled independently
    return true;
  }

  async loadUserOrganizations(userId) {
    try {
      // Get user organizations from Firestore using FirebaseService
      const userOrgResult = await this.firebaseService.centralGet('userOrganizations', userId);
      
      const orgSlugs = userOrgResult.exists ? (userOrgResult.data?.organizations || []) : [];
      const organizations = [];

      for (const slug of orgSlugs) {
        const orgResult = await this.firebaseService.centralGet('organizations', slug);
        
        if (orgResult.exists) {
          organizations.push({
            slug: orgResult.id,
            ...orgResult.data
          });
        }
      }

      this.userOrganizations = organizations;

      // Update StateManager if available
      if (this.stateManager) {
        this.stateManager.setUserOrganizations(this.userOrganizations);
      }

      return organizations;
    } catch (error) {
      if (this.stateManager) {
        this.stateManager.setError('Failed to load organizations: ' + error.message);
      }
      throw error;
    }
  }

  async loadOrganization(slug) {
    try {
      const orgResult = await this.firebaseService.centralGet('organizations', slug);
      
      if (!orgResult.exists) {
        throw new Error(`Organization not found: ${slug}`);
      }

      this.currentOrg = {
        slug: orgResult.id,
        ...orgResult.data
      };

      // Update StateManager if available
      if (this.stateManager) {
        this.stateManager.setCurrentOrganization(this.currentOrg);
      }
      
      return this.currentOrg;
    } catch (error) {
      if (this.stateManager) {
        this.stateManager.setError('Failed to load organization: ' + error.message);
      }
      throw error;
    }
  }

  getCurrentOrg() {
    return this.currentOrg;
  }

  getOrgSlug() {
    if (!this.currentOrg) return null;
    return this.currentOrg.slug;
  }

  async addMember(userId, email, role = 'viewer') {
    try {
      if (!this.currentOrg) throw new Error('No organization loaded');

      // Add member to organization using FirebaseService (nested document)
      await this.firebaseService.centralCreateNested(
        'organizations',
        this.currentOrg.slug,
        'members',
        userId,
        {
          email: email,
          role: role,
          addedAt: new Date().toISOString()
        }
      );

      // Add organization to user's organization list
      const userOrgResult = await this.firebaseService.centralGet('userOrganizations', userId);
      
      if (userOrgResult.exists) {
        const currentOrgs = userOrgResult.data?.organizations || [];
        if (!currentOrgs.includes(this.currentOrg.slug)) {
          await this.firebaseService.centralUpdate('userOrganizations', userId, {
            organizations: [...currentOrgs, this.currentOrg.slug]
          });
        }
      } else {
        // Document doesn't exist, create it
        await this.firebaseService.centralSet('userOrganizations', userId, {
          organizations: [this.currentOrg.slug]
        });
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  async updateMemberRole(userId, newRole) {
    try {
      if (!this.currentOrg) throw new Error('No organization loaded');

      await this.firebaseService.centralUpdateNested(
        'organizations',
        this.currentOrg.slug,
        'members',
        userId,
        { role: newRole }
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  async removeMember(userId) {
    try {
      if (!this.currentOrg) throw new Error('No organization loaded');

      // Remove member from organization using FirebaseService
      await this.firebaseService.centralDeleteNested(
        'organizations',
        this.currentOrg.slug,
        'members',
        userId
      );

      // Remove organization from user's organization list
      const userOrgResult = await this.firebaseService.centralGet('userOrganizations', userId);
      
      if (userOrgResult.exists) {
        const currentOrgs = userOrgResult.data?.organizations || [];
        const updatedOrgs = currentOrgs.filter(org => org !== this.currentOrg.slug);
        
        if (updatedOrgs.length > 0) {
          await this.firebaseService.centralUpdate('userOrganizations', userId, {
            organizations: updatedOrgs
          });
        } else {
          // If no organizations left, delete the document
          await this.firebaseService.centralDelete('userOrganizations', userId);
        }
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  clearCurrentOrg() {
    this.currentOrg = null;
    this.orgDatabase = null;
    this.orgFirebaseApp = null;
  }

  async disconnectFromOrg() {
    this.clearCurrentOrg();
  }

  static getInstance() {
    if (!OrgManager.instance) {
      OrgManager.instance = new OrgManager();
    }
    return OrgManager.instance;
  }
}

const orgManager = OrgManager.getInstance();

export default OrgManager;

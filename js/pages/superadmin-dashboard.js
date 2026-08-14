/**
 * Super Admin Dashboard Page
 */

import SuperAdminRouter from '../core/superadmin-router.js';

class SuperAdminDashboard {
  constructor() {
    this.auth = null;
    this.firebaseService = null;
    this.orgManager = null;
    this.superAdminService = null;
    this.router = null;
    this.organizations = [];
    this.editingOrgSlug = null;
  }

  async init(firebaseService, orgManager, superAdminService, router) {
    this.firebaseService = firebaseService;
    this.orgManager = orgManager;
    this.superAdminService = superAdminService;
    this.router = router;

    this.setupEventListeners();
    await this.loadOrganizations();
  }

  setupEventListeners() {
    // Create organization form
    const form = document.querySelector('#createOrgForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCreateOrg(e));
    }

    // Logout button
    const logoutBtn = document.querySelector('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  async handleCreateOrg(e) {
    e.preventDefault();

    const orgName = document.querySelector('#orgName').value;
    const orgStatus = document.querySelector('#orgStatus').value;
    const adminEmail = document.querySelector('#adminEmail').value;
    const adminPassword = document.querySelector('#adminPassword').value;

    try {
      this.clearMessages();

      // Check if we're in edit mode
      if (this.editingOrgSlug) {
        // Edit mode - update all provided fields
        const updates = {};

        if (orgName.trim()) {
          updates.name = orgName.trim();
        }

        if (orgStatus) {
          updates.status = orgStatus;
        }

        if (adminEmail.trim()) {
          updates.adminEmail = adminEmail.trim();
        }

        if (adminPassword.trim()) {
          updates.adminPassword = adminPassword;
        }

        if (Object.keys(updates).length === 0) {
          throw new Error('Please make at least one change');
        }

        this.showLoading(true);

        // Update the organization
        await this.superAdminService.updateOrganization(this.editingOrgSlug, updates);

        this.showSuccess(`Organization saved successfully`);
        this.cancelEditOrg();
        await this.loadOrganizations();
      } else {
        // Create mode
        if (!orgName.trim()) {
          throw new Error('Organization name is required');
        }

        if (!adminEmail.trim()) {
          throw new Error('Administrator email is required');
        }

        if (adminPassword.length < 8) {
          throw new Error('Administrator password must be at least 8 characters');
        }

        this.showLoading(true);

        const org = await this.superAdminService.createOrganization(
          orgName,
          adminEmail.trim(),
          adminPassword
        );

        this.showSuccess(`Organization "${org.name}" created with ${org.adminUser.email} as administrator.`);
        document.querySelector('#createOrgForm').reset();
        document.querySelector('#orgStatus').value = 'active';
        await this.loadOrganizations();
      }
    } catch (error) {
      console.error('Create organization error:', error);
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }


  async loadOrganizations() {
    try {
      document.querySelector('[data-section="orgs-loading"]').classList.add('show');
      document.querySelector('[data-section="orgs-list"]').innerHTML = '';

      this.organizations = await this.superAdminService.getAllOrganizations();

      if (this.organizations.length === 0) {
        document.querySelector('[data-section="orgs-list"]').innerHTML = `
          <p class="text-center text-muted" style="padding: 40px;">No organizations yet</p>
        `;
      } else {
        this.renderOrganizations();
      }
    } catch (error) {
      console.error('Load organizations error:', error);
      this.showError('Failed to load organizations: ' + error.message);
    } finally {
      document.querySelector('[data-section="orgs-loading"]').classList.remove('show');
    }
  }

  renderOrganizations() {
    const container = document.querySelector('[data-section="orgs-list"]');
    
    container.innerHTML = this.organizations.map(org => `
      <div class="org-card">
        <h3>${org.name}</h3>
        <p><strong>Slug:</strong> ${org.slug}</p>
        <p><strong>Status:</strong> <span class="badge ${org.status === 'active' ? 'badge-success' : 'badge-warning'}">${org.status}</span></p>
        <p><strong>URL:</strong> <a href="/pages/organization.html?slug=${org.slug}" style="color: #3498db; text-decoration: none;"><code>/org/${org.slug}</code></a></p>
        <div class="org-actions">
          <button class="btn-primary btn-sm" onclick="superAdminDashboard.editOrg('${org.slug}')">Edit</button>
          <button class="btn-secondary btn-sm" onclick="superAdminDashboard.copyUrl('${org.slug}')">Copy URL</button>
          <button class="btn-danger btn-sm" onclick="superAdminDashboard.deleteOrg('${org.slug}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  copyUrl(slug) {
    const url = `${window.location.origin}/pages/organization.html?slug=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showSuccess('Organization URL copied to clipboard!');
    }).catch(err => {
      this.showError('Failed to copy URL');
    });
  }

  async deleteOrg(slug) {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Delete Organization',
      text: `Are you sure you want to delete "${slug}"? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancel'
    });

    if (!isConfirmed) {
      return;
    }

    try {
      await this.superAdminService.updateOrgStatus(slug, 'deleted');
      this.showSuccess(`Organization "${slug}" deleted`);
      await this.loadOrganizations();
    } catch (error) {
      console.error('Delete organization error:', error);
      this.showError('Failed to delete organization: ' + error.message);
    }
  }

  async editOrg(slug) {
    try {
      // Find the organization in the current list
      const org = this.organizations.find(o => o.slug === slug);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Set editing mode
      this.editingOrgSlug = slug;

      // Populate form with organization data
      document.querySelector('#orgName').value = org.name || '';
      document.querySelector('#orgStatus').value = org.status || 'active';

      // Clear email and password fields (these are not editable in this form)
      document.querySelector('#adminEmail').value = '';
      document.querySelector('#adminPassword').value = '';

      // Update form and section title
      const section = document.querySelector('.section');
      const sectionTitle = section.querySelector('h2');
      sectionTitle.textContent = `Edit Organization: ${org.slug}`;

      const submitBtn = document.querySelector('#createOrgForm button[type="submit"]');
      submitBtn.textContent = 'Save Changes';

      // Add cancel button if it doesn't exist
      if (!document.querySelector('#cancelEditBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginRight = '10px';
        cancelBtn.addEventListener('click', () => this.cancelEditOrg());
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn);
      } else {
        document.querySelector('#cancelEditBtn').style.display = 'block';
      }

      // Scroll to form
      document.querySelector('#createOrgForm').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Edit organization error:', error);
      this.showError('Failed to edit organization: ' + error.message);
    }
  }

  cancelEditOrg() {
    // Reset editing mode
    this.editingOrgSlug = null;

    // Reset form
    document.querySelector('#createOrgForm').reset();

    // Reset section title and button
    const section = document.querySelector('.section');
    const sectionTitle = section.querySelector('h2');
    sectionTitle.textContent = 'Create New Organization';

    const submitBtn = document.querySelector('#createOrgForm button[type="submit"]');
    submitBtn.textContent = 'Create Organization';

    // Hide cancel button
    const cancelBtn = document.querySelector('#cancelEditBtn');
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    this.clearMessages();
  }

  async handleLogout() {
    try {
      await this.router.logout();
    } catch (error) {
      this.showError('Logout failed: ' + error.message);
    }
  }

  clearMessages() {
    // No longer needed with toast notifications
  }

  showError(message) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 4000
    });
  }

  showSuccess(message) {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  showLoading(show) {
    const form = document.querySelector('#createOrgForm');
    const button = form?.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = show;
      button.textContent = show ? 'Creating...' : 'Create Organization';
    }
  }
}

// Initialize dashboard when app is ready
// Use a more robust approach: either event or already-initialized
async function initializeDashboard() {
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
    
    const { firebaseService, orgManager, superAdminService, centralAuth, centralFirestore } = services;
    
    // Create and initialize router
    const router = new SuperAdminRouter();
    router.initialize(centralAuth, centralFirestore);
    
    const dashboard = new SuperAdminDashboard();
    await dashboard.init(firebaseService, orgManager, superAdminService, router);
    
    // Expose globally for inline onclick handlers
    window.superAdminDashboard = dashboard;
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
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
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  initializeDashboard();
}

// Export for testing
export default SuperAdminDashboard;

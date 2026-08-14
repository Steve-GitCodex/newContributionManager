// Organizations page - Load and display organizations with search and pagination

const ITEMS_PER_PAGE = 12;
let allOrganizations = [];
let filteredOrganizations = [];
let currentPage = 1;

async function loadOrganizations() {
    const container = document.getElementById('orgs-container');

    try {
        // Get firebaseService from app initialization
        if (!window.appServices || !window.appServices.firebaseService) {
            throw new Error('Application not initialized. FirebaseService unavailable.');
        }

        const firebaseService = window.appServices.firebaseService;

        // Fetch organizations from central database using FirebaseService
        // centralGetAll returns an array of documents with data already spread
        const organizations = await firebaseService.centralGetAll('organizations');
        
        // organizations is already in the format: [{ id, name, slug, description, ... }, ...]
        allOrganizations = organizations || [];

        // Sort by name
        allOrganizations.sort((a, b) => a.name.localeCompare(b.name));
        filteredOrganizations = [...allOrganizations];

        // Setup search functionality
        setupSearch();

        // Initial render
        if (allOrganizations.length === 0) {
            showEmptyState('No Organizations Found', 'There are currently no organizations available to access.', true);
        } else {
            renderPage();
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
        showEmptyState('Error Loading Organizations', error.message, false);
    }
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        currentPage = 1;
        const query = e.target.value.toLowerCase();
        
        if (query.trim() === '') {
            filteredOrganizations = [...allOrganizations];
        } else {
            filteredOrganizations = allOrganizations.filter(org => 
                org.name.toLowerCase().includes(query) ||
                (org.description && org.description.toLowerCase().includes(query))
            );
        }
        
        updateSearchCount();
        renderPage();
    });
}

function updateSearchCount() {
    const countEl = document.getElementById('search-count');
    if (!countEl) return;
    
    const searchInput = document.getElementById('search-input');
    const query = searchInput.value.toLowerCase();
    
    if (query.trim() === '') {
        countEl.textContent = '';
    } else {
        countEl.textContent = `${filteredOrganizations.length} result${filteredOrganizations.length !== 1 ? 's' : ''}`;
    }
}

function renderPage() {
    const container = document.getElementById('orgs-container');
    const paginationControls = document.getElementById('pagination-controls');

    if (filteredOrganizations.length === 0) {
        const searchInput = document.getElementById('search-input');
        const query = searchInput.value.toLowerCase();
        showEmptyState('No Results', `No organizations found matching "${query}"`, false);
        paginationControls.style.display = 'none';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrganizations.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageOrgs = filteredOrganizations.slice(startIdx, endIdx);

    // Render grid
    container.className = 'orgs-grid';
    container.innerHTML = pageOrgs.map(org => `
        <a href="/pages/organization.html?slug=${encodeURIComponent(org.slug)}" class="org-card">
            <div class="org-header">
                <div class="org-avatar">${sanitizeHTML(org.name.charAt(0).toUpperCase())}</div>
                <div class="org-info">
                    <h3>${sanitizeHTML(org.name)}</h3>
                    <p>Organization</p>
                </div>
            </div>
            <div class="org-description">
                ${sanitizeHTML(org.description || 'Manage your group contributions, track member activity, and generate reports.')}
            </div>
            <div class="org-footer">
                <span class="org-status">Ready to access</span>
                <i class="fas fa-arrow-right org-arrow"></i>
            </div>
        </a>
    `).join('');

    // Update pagination controls
    if (totalPages > 1) {
        paginationControls.style.display = 'flex';
        document.getElementById('prev-btn').disabled = currentPage === 1;
        document.getElementById('next-btn').disabled = currentPage === totalPages;
        document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;

        document.getElementById('prev-btn').onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        document.getElementById('next-btn').onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
    } else {
        paginationControls.style.display = 'none';
    }
}

function showEmptyState(title, message, isContact = false) {
    const container = document.getElementById('orgs-container');
    const icon = isContact ? 'fa-inbox' : (title === 'No Results' ? 'fa-search' : 'fa-exclamation-circle');
    const color = title === 'Error Loading Organizations' ? 'var(--danger-color)' : 'var(--primary-color)';
    const btnColor = title === 'Error Loading Organizations' ? 'var(--danger-color)' : 'var(--primary-color)';
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas ${icon}" style="color: ${color};"></i>
            <h2>${title}</h2>
            <p>${sanitizeHTML(message)}</p>
            ${isContact ? '<p style="font-size: 12px; margin: 12px 0 24px;">Contact an administrator to set up an organization.</p>' : ''}
            <a href="/" class="btn-home" style="background: ${btnColor};">Back to Home</a>
        </div>
    `;
}

function sanitizeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when app is ready
function initializeOrganizationsPage() {
    // Check if app is ready
    if (!window.appServices) {
        // App not ready yet, wait for appReady event
        window.addEventListener('appReady', () => {
            initializeOrganizationsPage();
        }, { once: true });
        return;
    }

    console.log('[Organizations] App services loaded, loading organizations');
    loadOrganizations();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOrganizationsPage);
} else {
    initializeOrganizationsPage();
}

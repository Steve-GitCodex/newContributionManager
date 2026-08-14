// Expected Members Manager Module
// Handles CRUD operations for the expected members list

const ExpectedMembersManager = (function() {
    const STORAGE_KEY = 'expectedMembers';

    return {
        // Get all expected members from localStorage
        getExpectedMembers() {
            try {
                const members = localStorage.getItem(STORAGE_KEY);
                return members ? JSON.parse(members) : [];
            } catch (error) {
                console.error('Error loading expected members:', error);
                return [];
            }
        },

        // Save expected members to localStorage
        saveExpectedMembers(members) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
                return true;
            } catch (error) {
                console.error('Error saving expected members:', error);
                showToast('error', 'Save Failed', 'Could not save expected members list');
                return false;
            }
        },

        // Add a new expected member
        addExpectedMember(memberName, monthlyAmount) {
            if (!memberName || !memberName.trim()) {
                showToast('warning', 'Invalid Name', 'Please enter a member name');
                return false;
            }

            if (!monthlyAmount || monthlyAmount <= 0) {
                showToast('warning', 'Invalid Amount', 'Please enter a valid expected monthly amount');
                return false;
            }

            const trimmedName = memberName.trim();
            const members = this.getExpectedMembers();

            // Check for duplicates
            if (members.find(m => m.name === trimmedName)) {
                showToast('warning', 'Duplicate Member', 'This member is already in the expected list');
                return false;
            }

            members.push({
                name: trimmedName,
                monthlyAmount: parseFloat(monthlyAmount)
            });
            
            if (this.saveExpectedMembers(members)) {
                showToast('success', 'Member Added', `${trimmedName} has been added with ${monthlyAmount}/= per month`);
                return true;
            }
            return false;
        },

        // Remove an expected member
        removeExpectedMember(memberName) {
            const members = this.getExpectedMembers();
            const index = members.findIndex(m => m.name === memberName);
            
            if (index > -1) {
                members.splice(index, 1);
                if (this.saveExpectedMembers(members)) {
                    showToast('success', 'Member Removed', `${memberName} has been removed from the expected list`);
                    return true;
                }
            }
            return false;
        },

        // Edit an expected member
        editExpectedMember(oldName, newName, newMonthlyAmount) {
            const members = this.getExpectedMembers();
            const index = members.findIndex(m => m.name === oldName);
            
            if (index === -1) return false;

            // Check if new name already exists (if name is being changed)
            if (oldName !== newName && members.find(m => m.name === newName)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Name',
                    text: 'A member with this name already exists'
                });
                return false;
            }

            members[index] = {
                name: newName.trim(),
                monthlyAmount: parseFloat(newMonthlyAmount)
            };

            if (this.saveExpectedMembers(members)) {
                Swal.fire({
                    icon: 'success',
                    title: 'Member Updated',
                    text: `${newName} has been updated successfully`,
                    timer: 2000,
                    showConfirmButton: false
                });
                return true;
            }
            return false;
        },

        // Render the expected members list
        renderExpectedMembers(listElement) {
            if (!listElement) return;

            const members = this.getExpectedMembers();
            
            if (members.length === 0) {
                listElement.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No expected members added yet</td></tr>';
                return;
            }

            listElement.innerHTML = members.map((member, index) => {
                const memberName = typeof member === 'string' ? member : member.name;
                const monthlyAmount = typeof member === 'string' ? 0 : member.monthlyAmount;
                
                return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${Utils.sanitizeHTML(memberName)}</strong></td>
                    <td>${monthlyAmount.toLocaleString()}/= per month</td>
                    <td>
                        <button class="btn btn-primary btn-sm edit-expected-member" data-member="${Utils.sanitizeHTML(memberName)}" data-amount="${monthlyAmount}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm remove-expected-member" data-member="${Utils.sanitizeHTML(memberName)}">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </td>
                </tr>
            `}).join('');

            // Add event listeners to edit buttons
            const self = this;
            listElement.querySelectorAll('.edit-expected-member').forEach(btn => {
                btn.addEventListener('click', function() {
                    const memberName = this.getAttribute('data-member');
                    const currentAmount = this.getAttribute('data-amount');
                    
                    Swal.fire({
                        title: 'Edit Member',
                        html: `
                            <div style="text-align: left;">
                                <label style="display: block; margin-bottom: 8px; font-weight: bold;">Member Name:</label>
                                <input id="swal-edit-name" class="swal2-input" value="${Utils.sanitizeHTML(memberName)}" style="width: 90%; margin: 0 0 16px 0;">
                                <label style="display: block; margin-bottom: 8px; font-weight: bold;">Expected Monthly Amount:</label>
                                <input id="swal-edit-amount" class="swal2-input" type="number" value="${currentAmount}" min="0" style="width: 90%; margin: 0;">
                            </div>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Update',
                        cancelButtonText: 'Cancel',
                        preConfirm: () => {
                            const newName = document.getElementById('swal-edit-name').value;
                            const newAmount = document.getElementById('swal-edit-amount').value;
                            
                            if (!newName || !newName.trim()) {
                                Swal.showValidationMessage('Please enter a member name');
                                return false;
                            }
                            if (!newAmount || newAmount <= 0) {
                                Swal.showValidationMessage('Please enter a valid amount');
                                return false;
                            }
                            
                            return { name: newName, amount: newAmount };
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            if (self.editExpectedMember(memberName, result.value.name, result.value.amount)) {
                                self.renderExpectedMembers(listElement);
                            }
                        }
                    });
                });
            });

            // Add event listeners to remove buttons
            listElement.querySelectorAll('.remove-expected-member').forEach(btn => {
                btn.addEventListener('click', function() {
                    const memberName = this.getAttribute('data-member');
                    
                    Swal.fire({
                        title: 'Remove Member?',
                        text: `Remove ${memberName} from expected members list?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, remove',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#d33'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            if (self.removeExpectedMember(memberName)) {
                                self.renderExpectedMembers(listElement);
                            }
                        }
                    });
                });
            });
        },

        // Initialize expected members management
        init() {
            // Directly fetch DOM elements to avoid caching issues
            const addExpectedMemberBtn = document.getElementById('add-expected-member');
            const expectedMembersList = document.getElementById('expected-members-list');
            const expectedMemberNameInput = document.getElementById('expected-member-name');
            const expectedMemberAmountInput = document.getElementById('expected-member-amount');
            
            if (!addExpectedMemberBtn || !expectedMembersList) {
                return;
            }

            // Initial render
            this.renderExpectedMembers(expectedMembersList);

            // Add member button click
            addExpectedMemberBtn.addEventListener('click', () => {
                const memberName = expectedMemberNameInput.value;
                const monthlyAmount = expectedMemberAmountInput.value;
                if (this.addExpectedMember(memberName, monthlyAmount)) {
                    expectedMemberNameInput.value = '';
                    expectedMemberAmountInput.value = '';
                    this.renderExpectedMembers(expectedMembersList);
                }
            });

            // Enter key on inputs
            if (expectedMemberNameInput) {
                expectedMemberNameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        addExpectedMemberBtn.click();
                    }
                });
            }
            
            if (expectedMemberAmountInput) {
                expectedMemberAmountInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        addExpectedMemberBtn.click();
                    }
                });
            }
        }
    };
})();

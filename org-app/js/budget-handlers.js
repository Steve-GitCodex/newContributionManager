// Budget tab. Controls are re-attached on every render because renderBudgetUI
// regenerates the whole form, which drops any listener already on it.

const BudgetHandlers = (function () {
    let state = {};
    let _saveCallback = null;

    return {
        init(stateObj, saveCallback) {
            state = stateObj;
            _saveCallback = saveCallback;
        },

        refreshBudgetTable() {
            const budgetDom = { budgetContent: document.getElementById('budget-content') };
            const totalIncome = BudgetManager.calculateBudgetFromIncome(state.contributionsData || {});
            BudgetManager.renderBudgetUI(budgetDom, state.budgetData, totalIncome);

            // Add expense button - re-attach after every render since the form markup is fully regenerated
            const addExpenseBtn = document.getElementById('add-expense-btn');
            if (addExpenseBtn) {
                const newAddBtn = addExpenseBtn.cloneNode(true);
                addExpenseBtn.parentNode.replaceChild(newAddBtn, addExpenseBtn);

                newAddBtn.addEventListener('click', async () => {
                    const amountInput = document.getElementById('expense-amount');
                    const categorySelect = document.getElementById('expense-category');
                    const dateInput = document.getElementById('expense-date');
                    const descriptionInput = document.getElementById('expense-description');

                    // Clear previous field errors
                    [amountInput, categorySelect, dateInput].forEach(el => {
                        el.classList.remove('input-error');
                        const existing = el.parentElement.querySelector('.field-error');
                        if (existing) existing.remove();
                    });

                    const amount = parseFloat(amountInput.value);
                    const category = categorySelect.value;
                    const date = dateInput.value;
                    let isValid = true;

                    const markFieldError = (input, message) => {
                        input.classList.add('input-error');
                        const errorSpan = document.createElement('span');
                        errorSpan.className = 'field-error';
                        errorSpan.textContent = message;
                        input.parentElement.appendChild(errorSpan);
                        isValid = false;
                    };

                    if (isNaN(amount) || amount <= 0) markFieldError(amountInput, 'Enter an amount greater than 0');
                    if (!category) markFieldError(categorySelect, 'Please select a category');
                    if (!date) markFieldError(dateInput, 'Please select a date');

                    if (!isValid) return;

                    newAddBtn.disabled = true;
                    newAddBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

                    try {
                        const expenseId = await BudgetManager.addExpense(
                            state.budgetData,
                            amount,
                            category,
                            date,
                            descriptionInput.value
                        );

                        if (expenseId) {
                            Dialogs.success('Expense Added', `Added ${amount.toLocaleString()} to ${category}`);
                            amountInput.value = '';
                            descriptionInput.value = '';
                            categorySelect.value = '';
                            _saveCallback();
                            this.refreshBudgetTable();
                        } else {
                            newAddBtn.disabled = false;
                            newAddBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
                            Dialogs.error('Add Failed', 'Could not add expense. Please try again.');
                        }
                    } catch (error) {
                        newAddBtn.disabled = false;
                        newAddBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
                        Dialogs.error('Add Failed', 'An unexpected error occurred. Please try again.');
                    }
                });
            }

            // Set today\'s date as default (form is fully re-rendered on each call)
            const expenseDateInput = document.getElementById('expense-date');
            if (expenseDateInput) {
                expenseDateInput.value = moment().format('YYYY-MM-DD');
            }

            // Delete expense buttons - clone to remove stale listeners
            document.querySelectorAll('.delete-expense').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', async (e) => {
                    const expenseId = e.currentTarget.dataset.expenseId;

                    const result = await Dialogs.confirm(
                        'Delete Expense?',
                        'Are you sure you want to delete this expense?',
                        'Delete'
                    );

                    if (result.isConfirmed) {
                        try {
                            const success = await BudgetManager.removeExpense(state.budgetData, expenseId);
                            if (success) {
                                Dialogs.success('Expense Deleted');
                                _saveCallback();
                                this.refreshBudgetTable();
                            }
                        } catch (error) {
                            Dialogs.error('Delete Failed', 'Failed to delete expense');
                        }
                    }
                });
            });

            // Edit expense buttons - clone to remove stale listeners
            document.querySelectorAll('.edit-expense').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', async (e) => {
                    const expenseId = e.currentTarget.dataset.expenseId;
                    const expense = BudgetManager.getExpenseById(state.budgetData, expenseId);

                    if (!expense) {
                        Dialogs.error('Error', 'Expense not found');
                        return;
                    }

                    const expenseDate = moment(expense.date).format('YYYY-MM-DD');

                    const { value: formValues } = await Swal.fire({
                        title: 'Edit Expense',
                        width: '500px',
                        customClass: { container: 'swal-modal' },
                        html: `
                            <form style="text-align: left; padding: 20px 0;">
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Amount</label>
                                    <input type="number" id="edit-amount" 
                                           value="${expense.amount}" min="0" step="0.01" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Category</label>
                                    <select id="edit-category" 
                                            style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); cursor: pointer; transition: border-color 0.3s ease;">
                                        <option value="Food" ${expense.category === 'Food' ? 'selected' : ''}>Food</option>
                                        <option value="Transport" ${expense.category === 'Transport' ? 'selected' : ''}>Transport</option>
                                        <option value="Utilities" ${expense.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
                                        <option value="Entertainment" ${expense.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
                                        <option value="Healthcare" ${expense.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
                                        <option value="Other" ${expense.category === 'Other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Date</label>
                                    <input type="date" id="edit-date" 
                                           value="${expenseDate}" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                                <div style="margin-bottom: 0;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Description (Optional)</label>
                                    <input type="text" id="edit-description" 
                                           value="${expense.description || ''}" placeholder="Enter description" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                            </form>
                        `,
                        didOpen: (modal) => {
                            modal.querySelector('#edit-amount').focus();
                        },
                        showCancelButton: true,
                        confirmButtonText: 'Update',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        cancelButtonText: 'Cancel',
                        preConfirm: () => {
                            const amount = document.getElementById('edit-amount').value;
                            const category = document.getElementById('edit-category').value;
                            const date = document.getElementById('edit-date').value;
                            const description = document.getElementById('edit-description').value;

                            if (!amount || !category || !date) {
                                Swal.showValidationMessage('Please fill in all required fields');
                                return false;
                            }

                            return { amount, category, date, description };
                        }
                    });

                    if (formValues) {
                        try {
                            const success = await BudgetManager.updateExpense(
                                state.budgetData,
                                expenseId,
                                formValues.amount,
                                formValues.category,
                                formValues.date,
                                formValues.description
                            );

                            if (success) {
                                Dialogs.success('Expense Updated');
                                _saveCallback();
                                this.refreshBudgetTable();
                            }
                        } catch (error) {
                            Dialogs.error('Update Failed', 'Failed to update expense');
                        }
                    }
                });
            });
        },

        setup() {
            // Render the budget UI and attach all listeners (add, edit, delete) via refreshBudgetTable
            this.refreshBudgetTable();
        }
    };
})();

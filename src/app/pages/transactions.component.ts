import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerService, NewTransaction, Transaction } from '../ledger.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.component.html',
})
export class TransactionsComponent {
  protected readonly ledger = inject(LedgerService);

  protected readonly editingExpenseId = signal<number | null>(null);
  protected readonly editingExpense = signal<NewTransaction | null>(null);

  protected startEditingExpense(transaction: Transaction): void {
    if (transaction.savings) return;
    this.editingExpenseId.set(transaction.id);
    this.editingExpense.set({
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      subcategory: transaction.subcategory,
      type: 'Expense',
      amount: transaction.amount,
      savings: false,
    });
  }

  protected updateExpenseEdit(field: keyof NewTransaction, value: string | number | null): void {
    this.editingExpense.update((expense) => expense ? { ...expense, [field]: value } : expense);
  }

  protected cancelEditingExpense(): void {
    this.editingExpenseId.set(null);
    this.editingExpense.set(null);
  }

  protected saveEditingExpense(): void {
    const id = this.editingExpenseId();
    const expense = this.editingExpense();
    if (id === null || !expense || !expense.description?.trim() || !expense.date || !expense.category || !expense.amount || Number(expense.amount) <= 0) return;
    this.ledger.updateExpense(id, expense);
    this.cancelEditingExpense();
  }

  protected removeTransaction(id: number): void {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      this.ledger.removeTransaction(id);
    }
  }
}

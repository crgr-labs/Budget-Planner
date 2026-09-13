import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExpectedBill, LedgerService } from '../ledger.service';

@Component({
  selector: 'app-expected-bills',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expected-bills.component.html',
})
export class ExpectedBillsComponent {
  protected readonly ledger = inject(LedgerService);

  protected readonly newBillName = signal('');
  protected readonly newBillCategory = signal('Expected Bills');
  protected readonly newBillSubcategory = signal('Globe');
  protected readonly newBillAmount = signal<number | null>(null);

  protected readonly editingBillId = signal<number | null>(null);
  protected readonly editingBill = signal<ExpectedBill | null>(null);

  protected updateBillCategory(category: string): void {
    this.newBillCategory.set(category);
    this.newBillSubcategory.set(this.ledger.subcategoriesFor(category)[0] || '');
  }

  protected addExpectedBill(): void {
    const name = this.newBillName().trim();
    const amount = Number(this.newBillAmount());
    if (!name || !this.newBillCategory() || !this.newBillSubcategory() || !Number.isFinite(amount) || amount <= 0) return;
    this.ledger.addExpectedBill({
      name,
      category: this.newBillCategory(),
      subcategory: this.newBillSubcategory(),
      amount,
    });
    this.newBillName.set('');
    this.newBillSubcategory.set(this.ledger.subcategoriesFor(this.newBillCategory())[0] || '');
    this.newBillAmount.set(null);
  }

  protected removeExpectedBill(id: number): void {
    this.ledger.removeExpectedBill(id);
  }

  protected startEditingBill(bill: ExpectedBill): void {
    this.editingBillId.set(bill.id);
    this.editingBill.set({ ...bill });
  }

  protected updateBillEdit(field: keyof ExpectedBill, value: string | number | boolean): void {
    this.editingBill.update((bill) => bill ? { ...bill, [field]: value } : bill);
  }

  protected updateEditingBillCategory(category: string): void {
    this.editingBill.update((bill) => bill ? {
      ...bill,
      category,
      subcategory: this.ledger.subcategoriesFor(category)[0] || '',
    } : bill);
  }

  protected cancelEditingBill(): void {
    this.editingBillId.set(null);
    this.editingBill.set(null);
  }

  protected saveEditingBill(): void {
    const id = this.editingBillId();
    const bill = this.editingBill();
    if (id === null || !bill) return;
    this.ledger.updateExpectedBill(id, bill);
    this.cancelEditingBill();
  }
}

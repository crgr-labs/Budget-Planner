import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerService, NewTransaction, SavingsPlanBill, TransactionType } from '../ledger.service';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './savings.component.html',
})
export class SavingsComponent {
  protected readonly ledger = inject(LedgerService);

  protected readonly savingsSubPage = signal<'Plan' | 'AddTransaction'>('Plan');
  protected readonly savingsActionTab = signal<'Transaction' | 'Target'>('Transaction');
  protected readonly savingsDetailsOpen = signal(false);
  protected readonly editingPlanParameters = signal(false);

  protected readonly editingSavingsBillId = signal<number | null>(null);
  protected readonly editingSavingsBill = signal<{ name: string; monthly: number } | null>(null);
  protected readonly newSavingsBillName = signal('');
  protected readonly newSavingsBillAmount = signal<number | null>(null);

  protected readonly newSavingsTransaction = signal<NewTransaction>(this.ledger.emptySavingsTransaction());
  protected readonly recentlyAddedSavings = signal(false);
  private savingsAddedTimer: ReturnType<typeof setTimeout> | null = null;

  private draggedTile: HTMLElement | null = null;

  protected selectSavingsSubPage(page: 'Plan' | 'AddTransaction'): void {
    this.savingsSubPage.set(page);
  }

  protected toggleSavingsDetails(): void {
    this.savingsDetailsOpen.update((open) => !open);
  }

  protected toggleEditingPlanParameters(): void {
    this.editingPlanParameters.update((open) => !open);
  }

  protected updateSavingsField(field: keyof NewTransaction, value: string | number | null): void {
    this.newSavingsTransaction.update((form) => {
      if (field === 'category') {
        const category = String(value);
        return { ...form, category, subcategory: this.ledger.savingsSubcategoriesFor(category)[0] || '' };
      }
      if (field === 'type') {
        return { ...form, type: value as TransactionType, fundType: value === 'Expense' ? 'Withdrawal' : 'Contribution' };
      }
      return { ...form, [field]: value };
    });
  }

  protected setSavingsAmount(amount: number): void {
    this.updateSavingsField('amount', Math.round(amount));
  }

  protected addSavingsTransaction(): void {
    const entry = this.newSavingsTransaction();
    if (!entry.amount || entry.amount <= 0) return;
    this.ledger.addTransaction(entry);
    if (this.savingsAddedTimer) clearTimeout(this.savingsAddedTimer);
    this.recentlyAddedSavings.set(true);
    this.savingsAddedTimer = setTimeout(() => this.recentlyAddedSavings.set(false), 1600);
    this.newSavingsTransaction.set(this.ledger.emptySavingsTransaction());
  }

  protected updateTargetSavingsGoal(value: string | number | null): void {
    if (value === null || value === undefined) return;
    const amount = Number(String(value).trim());
    this.ledger.updateTargetSavingsGoal(amount);
  }

  protected updateSavingsPlanSalary(value: string | number | null): void {
    this.ledger.updateSavingsPlanSalary(value);
  }

  protected updateSavingsPlanRate(value: string | number | null): void {
    this.ledger.updateSavingsPlanRate(value);
  }

  protected updateSavingsPlanInvestment(value: string | number | null): void {
    this.ledger.updateSavingsPlanInvestment(value);
  }

  protected resetSavingsPlanToDefaults(): void {
    this.ledger.resetSavingsPlanToDefaults();
  }

  protected startEditingSavingsBill(bill: SavingsPlanBill): void {
    this.editingSavingsBillId.set(bill.id);
    this.editingSavingsBill.set({ name: bill.name, monthly: bill.monthly });
  }

  protected cancelEditingSavingsBill(): void {
    this.editingSavingsBillId.set(null);
    this.editingSavingsBill.set(null);
  }

  protected updateEditingSavingsBill(field: 'name' | 'monthly', value: string | number): void {
    this.editingSavingsBill.update((b) => b ? { ...b, [field]: value } : b);
  }

  protected saveEditingSavingsBill(): void {
    const id = this.editingSavingsBillId();
    const bill = this.editingSavingsBill();
    if (id === null || !bill || !bill.name.trim()) return;
    this.ledger.updateSavingsPlanBill(id, bill);
    this.cancelEditingSavingsBill();
  }

  protected removeSavingsPlanBill(id: number): void {
    this.ledger.removeSavingsPlanBill(id);
  }

  protected addSavingsPlanBill(): void {
    const name = this.newSavingsBillName().trim();
    const monthly = Number(this.newSavingsBillAmount());
    if (!name || !Number.isFinite(monthly) || monthly <= 0) return;
    this.ledger.addSavingsPlanBill({ name, monthly });
    this.newSavingsBillName.set('');
    this.newSavingsBillAmount.set(null);
  }

  protected removeTransaction(id: number): void {
    if (window.confirm('Are you sure you want to delete this savings transaction?')) {
      this.ledger.removeTransaction(id);
    }
  }

  protected startTileDrag(event: DragEvent): void {
    const tile = event.currentTarget as HTMLElement;
    this.draggedTile = tile;
    tile.classList.add('tile-dragging');
    event.dataTransfer?.setData('text/plain', 'dashboard-tile');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected allowTileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  protected dropTile(event: DragEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const parent = target.parentElement;
    if (!this.draggedTile || !parent || this.draggedTile === target || this.draggedTile.parentElement !== parent) return;
    const tiles = [...parent.children];
    const draggedIndex = tiles.indexOf(this.draggedTile);
    const targetIndex = tiles.indexOf(target);
    parent.insertBefore(this.draggedTile, draggedIndex < targetIndex ? target.nextSibling : target);
  }

  protected endTileDrag(): void {
    this.draggedTile?.classList.remove('tile-dragging');
    this.draggedTile = null;
  }
}

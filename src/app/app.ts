import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LedgerService, NewTransaction } from './ledger.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './app.css',
  templateUrl: './app.html',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  protected readonly ledger = inject(LedgerService);
  private readonly router = inject(Router);

  protected readonly mobileMenuOpen = signal(false);
  protected readonly addTransactionModalOpen = signal(false);
  protected readonly currentUrl = signal('/overview');
  protected readonly newTransaction = signal<NewTransaction>(this.ledger.emptyTransaction());
  protected readonly recentlyAdded = signal(false);
  private addedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly currentSectionTitle = computed(() => {
    const url = this.currentUrl();
    if (url.includes('/transactions')) return 'Regular spending';
    if (url.includes('/bills')) return 'Expected bills';
    if (url.includes('/savings')) return 'Savings';
    if (url.includes('/reports')) return 'Reports';
    if (url.includes('/categories')) return 'Categories';
    return 'Overview';
  });

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.mobileMenuOpen.set(false);
    });
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected openAddTransactionModal(): void {
    this.newTransaction.set(this.ledger.emptyTransaction());
    this.addTransactionModalOpen.set(true);
  }

  protected closeAddTransactionModal(): void {
    this.addTransactionModalOpen.set(false);
  }

  protected selectTransactionMode(mode: 'Expense' | 'Savings'): void {
    this.newTransaction.update((form) => mode === 'Savings'
      ? {
          ...form,
          type: 'Income',
          savings: true,
          category: this.ledger.savingsCategories[0] || 'Emergency Fund',
          subcategory: this.ledger.savingsSubcategoriesFor(this.ledger.savingsCategories[0] || 'Emergency Fund')[0] || '',
        }
      : {
          ...form,
          type: 'Expense',
          savings: false,
          category: form.savings ? (this.ledger.categories[0] || 'Food') : form.category,
          subcategory: form.savings ? (this.ledger.subcategoriesFor(this.ledger.categories[0] || 'Food')[0] || '') : form.subcategory,
        });
  }

  protected updateField(field: keyof NewTransaction, value: string | number | null): void {
    this.newTransaction.update((form) => {
      if (field === 'category') {
        const cat = String(value);
        return form.savings
          ? { ...form, category: cat, subcategory: this.ledger.savingsSubcategoriesFor(cat)[0] || '' }
          : { ...form, category: cat, subcategory: this.ledger.subcategoriesFor(cat)[0] || '' };
      }
      return { ...form, [field]: value };
    });
  }

  protected addTransaction(): void {
    const entry = this.newTransaction();
    if (!entry.amount || Number(entry.amount) <= 0) return;
    this.ledger.addTransaction(entry);
    if (this.addedTimer) clearTimeout(this.addedTimer);
    this.recentlyAdded.set(true);
    this.addedTimer = setTimeout(() => {
      this.recentlyAdded.set(false);
      this.closeAddTransactionModal();
    }, 900);
  }

  protected selectMonth(month: string): void {
    this.ledger.selectMonth(month);
  }

  protected importWorkbook(event: Event): void {
    this.ledger.importWorkbook(event);
  }

  protected exportWorkbook(): void {
    this.ledger.exportWorkbook();
  }

  protected retryCloudData(): void {
    this.ledger.retryCloudData();
  }
}

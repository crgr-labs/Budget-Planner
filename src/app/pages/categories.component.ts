import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerService } from '../ledger.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent {
  protected readonly ledger = inject(LedgerService);

  protected readonly newCategoryName = signal('');
  protected readonly newCategorySubcategory = signal('');
  protected readonly selectedExpenseCategoryForSubcategory = signal('');
  protected readonly newExpenseSubcategoryName = signal('');
  protected readonly selectedCategoryForSubcategory = signal('');
  protected readonly newSubcategoryName = signal('');

  protected createCategory(): void {
    this.ledger.addCategory(this.newCategoryName(), this.newCategorySubcategory());
    this.newCategoryName.set('');
    this.newCategorySubcategory.set('');
  }

  protected createExpenseSubcategory(): void {
    this.ledger.addExpenseSubcategory(this.selectedExpenseCategoryForSubcategory(), this.newExpenseSubcategoryName());
    this.newExpenseSubcategoryName.set('');
  }

  protected createSavingsCategory(): void {
    this.ledger.addSavingsCategory(this.newCategoryName(), this.newCategorySubcategory());
    this.newCategoryName.set('');
    this.newCategorySubcategory.set('');
  }

  protected createSavingsSubcategory(): void {
    this.ledger.addSavingsSubcategory(this.selectedCategoryForSubcategory(), this.newSubcategoryName());
    this.newSubcategoryName.set('');
  }

  protected editCategory(name: string, savings: boolean): void {
    this.ledger.editCategory(name, savings);
  }

  protected editSubcategory(category: string, subcategory: string, savings: boolean): void {
    this.ledger.editSubcategory(category, subcategory, savings);
  }

  protected deleteCategory(name: string, savings: boolean): void {
    this.ledger.deleteCategory(name, savings);
  }

  protected deleteSubcategory(category: string, subcategory: string, savings: boolean): void {
    this.ledger.deleteSubcategory(category, subcategory, savings);
  }

  protected addExpenseSubcategory(category: string, subcategory: string): void {
    this.ledger.addExpenseSubcategory(category, subcategory);
  }

  protected addSavingsSubcategory(category: string, subcategory: string): void {
    this.ledger.addSavingsSubcategory(category, subcategory);
  }
}

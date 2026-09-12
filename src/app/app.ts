import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

type TransactionType = 'Income' | 'Expense';

interface Transaction {
  id: number;
  date: string;
  description: string;
  category: string;
  subcategory: string;
  type: TransactionType;
  amount: number;
  savings?: boolean;
  fundType?: string;
  account?: string;
}

interface NewTransaction {
  date: string;
  description: string;
  category: string;
  subcategory: string;
  type: TransactionType;
  amount: number | null;
  fundType?: string;
  account?: string;
  savings?: boolean;
}

interface SavingsMonthlySummary {
  month: string;
  contributions: number;
  withdrawals: number;
  netSavings: number;
  runningBalance: number;
}

interface CategoryGroup {
  name: string;
  subcategories: string[];
}

interface ExpectedBill {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  amount: number;
  dueDay: number;
  active: boolean;
}

interface SubcategoryTrend {
  name: string;
  total: number;
  points: number[];
}

interface SavingsPlanAllocation {
  name: string;
  paycheckOne: number;
  paycheckTwo: number;
  monthly: number;
}

interface SavingsPlanBucket {
  name: string;
  perPayday: number;
  monthly: number;
  purpose: string;
}

interface SavingsPlanBill {
  name: string;
  monthly: number;
  paycheckOne: number;
  paycheckTwo: number;
}

interface SavingsPlanRoadmap {
  milestone: string;
  target: number;
  monthlyContribution: number;
  estimatedMonths: number;
}

interface SavingsTrendPoint {
  month: string;
  amount: number;
  height: number;
}

interface CloudData {
  transactions: Transaction[];
  settings?: { monthlyBudget?: number; targetSavingsGoal?: number };
  expectedBills?: ExpectedBill[];
  categories?: CategoryGroup[];
  sharedSubcategories?: string[];
  savingsCategories?: CategoryGroup[];
}

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly builtInCategories = new Set(['Housing', 'Food', 'Transport', 'Lifestyle', 'Bills', 'Expected Bills', 'Health']);
  private readonly builtInCategorySubcategories = new Map([
    ['Housing', ['Rent', 'Utilities', 'Repairs']],
    ['Food', ['Groceries', 'Restaurants', 'Coffee']],
    ['Transport', ['Commute', 'Fuel', 'Parking']],
    ['Lifestyle', ['Entertainment', 'Shopping', 'Subscriptions']],
    ['Bills', ['Phone', 'Internet', 'Insurance']],
    ['Expected Bills', ['Globe', 'Condo']],
    ['Health', ['Medicine', 'Appointments', 'Fitness']],
  ]);
  private readonly builtInSavingsCategories = new Set(['Emergency Fund', 'General Savings', 'Investment Fund', 'Travel Fund', 'Other']);
  private draggedTile: HTMLElement | null = null;
  private readonly googleSheetsUrl = 'https://script.google.com/macros/s/AKfycbwEoC7gfYgAP8BXiyZtlS_QNyrGMEKX9tqkzhXeMCJJXSqrbUFsdUGBNF6RWgaEe9rq/exec?token=budget-planner-private-92sadf31s81sa2a255';
  private readonly apiUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000/api/transactions'
    : this.googleSheetsUrl;
  private readonly isHosted = this.apiUrl === this.googleSheetsUrl;
  protected readonly activeSection = signal('Overview');
  protected readonly transactionFormOpen = signal(false);
  protected readonly savingsSubPage = signal<'Plan' | 'AddTransaction'>('Plan');
  protected readonly mobileMenuOpen = signal(false);
  private readonly categoryColorSeed = Math.random() * 360;
  protected readonly selectedMonth = signal('2026-09');
  protected readonly monthOptions = computed(() => [...new Set(this.transactions().map((item) => item.date.slice(0, 7)))].sort().reverse());
  protected readonly monthLabel = computed(() => this.formatMonth(this.selectedMonth()));
  protected readonly categoryGroups = signal<CategoryGroup[]>([
    { name: 'Housing', subcategories: ['Rent', 'Utilities', 'Repairs'] },
    { name: 'Food', subcategories: ['Groceries', 'Restaurants', 'Coffee'] },
    { name: 'Transport', subcategories: ['Commute', 'Fuel', 'Parking'] },
    { name: 'Lifestyle', subcategories: ['Entertainment', 'Shopping', 'Subscriptions'] },
    { name: 'Bills', subcategories: ['Phone', 'Internet', 'Insurance'] },
    { name: 'Expected Bills', subcategories: ['Globe', 'Condo'] },
    { name: 'Health', subcategories: ['Medicine', 'Appointments', 'Fitness'] },
  ]);
  protected readonly sharedSubcategories = signal<string[]>([]);
  protected readonly savingsCategoryGroups = signal<CategoryGroup[]>([
    { name: 'Emergency Fund', subcategories: ['Short-term buffer', 'Medical reserve'] },
    { name: 'General Savings', subcategories: ['Monthly savings', 'Long-term savings'] },
    { name: 'Investment Fund', subcategories: ['Stocks', 'Bonds'] },
    { name: 'Travel Fund', subcategories: ['Flights', 'Accommodation'] },
    { name: 'Other', subcategories: [] },
  ]);
  protected readonly savingsPlan = {
    salary: 192000,
    fixedNeeds: 82358,
    availableAfterFixedNeeds: 109642,
    savingsGoal: 76800,
    spendingCap: 115200,
    variableAllowance: 32842,
    threeMonthFund: 247074,
    sixMonthFund: 494148,
  };
  protected readonly savingsPlanAllocations: SavingsPlanAllocation[] = [
    { name: 'Combined salary received', paycheckOne: 96000, paycheckTwo: 96000, monthly: 192000 },
    { name: 'Save first - 40%', paycheckOne: 38400, paycheckTwo: 38400, monthly: 76800 },
    { name: 'Minimum investment', paycheckOne: 9100, paycheckTwo: 9100, monthly: 18200 },
    { name: 'Emergency / savings reserve', paycheckOne: 29300, paycheckTwo: 29300, monthly: 58600 },
    { name: 'Reserve for fixed needs', paycheckOne: 41179, paycheckTwo: 41179, monthly: 82358 },
    { name: 'Variable spending allowance', paycheckOne: 16421, paycheckTwo: 16421, monthly: 32842 },
    { name: 'Total spending cap', paycheckOne: 57600, paycheckTwo: 57600, monthly: 115200 },
  ];
  protected readonly savingsPlanBuckets: SavingsPlanBucket[] = [
    { name: 'Minimum Investment', perPayday: 9100, monthly: 18200, purpose: 'Build long-term income-replacement assets.' },
    { name: 'Emergency Fund', perPayday: 29300, monthly: 58600, purpose: 'Build the 3-6 month safety net first.' },
    { name: 'Total Savings', perPayday: 38400, monthly: 76800, purpose: 'Automatic transfer immediately after payday.' },
  ];
  protected readonly savingsPlanBills: SavingsPlanBill[] = [
    { name: 'Condo Amortization', monthly: 6000, paycheckOne: 3000, paycheckTwo: 3000 },
    { name: 'Car Insurance', monthly: 2482, paycheckOne: 1241, paycheckTwo: 1241 },
    { name: 'Easycash (Car)', monthly: 13403, paycheckOne: 6701.5, paycheckTwo: 6701.5 },
    { name: 'Avida Investment', monthly: 11173, paycheckOne: 5586.5, paycheckTwo: 5586.5 },
    { name: 'Parking Rent', monthly: 4000, paycheckOne: 2000, paycheckTwo: 2000 },
    { name: 'Condo Dues', monthly: 5100, paycheckOne: 2550, paycheckTwo: 2550 },
    { name: 'Grocery', monthly: 15000, paycheckOne: 7500, paycheckTwo: 7500 },
    { name: 'Allowance (Shei)', monthly: 8000, paycheckOne: 4000, paycheckTwo: 4000 },
    { name: 'Gas', monthly: 5000, paycheckOne: 2500, paycheckTwo: 2500 },
    { name: 'Internet', monthly: 1800, paycheckOne: 900, paycheckTwo: 900 },
    { name: 'Electricity', monthly: 8000, paycheckOne: 4000, paycheckTwo: 4000 },
    { name: 'Anytime Fitness', monthly: 2400, paycheckOne: 1200, paycheckTwo: 1200 },
  ];
  protected readonly savingsPlanRoadmap: SavingsPlanRoadmap[] = [
    { milestone: '3-month safety net', target: 247074, monthlyContribution: 58600, estimatedMonths: 2 },
    { milestone: '6-month safety net', target: 494148, monthlyContribution: 58600, estimatedMonths: 6 },
  ];
  protected get categories(): string[] { return this.categoryGroups().map((group) => group.name); }
  protected get savingsCategories(): string[] { return this.savingsCategoryGroups().map((group) => group.name); }
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly cloudDataReady = signal(!this.isHosted);
  protected readonly cloudDataError = signal(false);
  protected readonly regularTransactions = computed(() => this.transactions().filter((item) => !item.savings));
  protected readonly newTransaction = signal<NewTransaction>(this.emptyTransaction());
  protected readonly budget = signal(3800);
  protected readonly selectedTransactions = computed(() => this.regularTransactions().filter((item) => item.date.startsWith(this.selectedMonth())));
  protected readonly expectedBills = signal<ExpectedBill[]>([]);
  protected readonly newBillName = signal('');
  protected readonly newBillCategory = signal('Expected Bills');
  protected readonly newBillSubcategory = signal('Globe');
  protected readonly newBillAmount = signal<number | null>(null);
  protected readonly newBillDueDay = signal(1);
  protected readonly editingBillId = signal<number | null>(null);
  protected readonly editingBill = signal<ExpectedBill | null>(null);
  protected readonly activeExpectedBills = computed(() => this.expectedBills().filter((bill) => bill.active));
  protected readonly billTracking = computed(() => this.activeExpectedBills().map((bill) => {
    const spent = this.selectedTransactions()
      .filter((item) => item.type === 'Expense' && item.category === bill.category && item.subcategory === bill.subcategory)
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...bill, spent, remaining: bill.amount - spent, overspent: spent > bill.amount };
  }));
  protected readonly billsExpectedTotal = computed(() => this.billTracking().reduce((sum, bill) => sum + bill.amount, 0));
  protected readonly billsSpentTotal = computed(() => this.billTracking().reduce((sum, bill) => sum + bill.spent, 0));
  protected readonly billsOverspentCount = computed(() => this.billTracking().filter((bill) => bill.overspent).length);
  protected readonly totalIncome = computed(() => this.selectedTransactions().filter((item) => item.type === 'Income').reduce((sum, item) => sum + item.amount, 0));
  protected readonly totalSpent = computed(() => this.selectedTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0));
  protected readonly regularExpenseCount = computed(() => this.selectedTransactions().filter((item) => item.type === 'Expense').length);
  protected readonly regularIncomeCount = computed(() => this.selectedTransactions().filter((item) => item.type === 'Income').length);
  protected readonly balance = computed(() => this.totalIncome() - this.totalSpent());
  protected readonly availableBalance = computed(() => {
    const monthlyRegularSpending = this.selectedTransactions().filter((item) => item.type === 'Expense' && !item.savings).reduce((sum, item) => sum + item.amount, 0);
    return this.budget() - monthlyRegularSpending;
  });
  protected readonly budgetProgress = computed(() => {
    const budgetAmount = this.budget();
    if (budgetAmount <= 0) return this.totalSpent() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.totalSpent() / budgetAmount) * 100));
  });
  protected readonly budgetCategories = computed(() => this.categories
    .map((category) => ({ category, total: this.categoryTotal(category) }))
    .filter((item) => item.total > 0)
    .sort((first, second) => second.total - first.total));
  protected readonly reportCategories = computed(() => this.categories
    .map((category) => ({ category, total: this.categoryTotal(category) }))
    .filter((item) => item.total > 0)
    .sort((first, second) => second.total - first.total));
  protected readonly reportTransactions = computed(() => this.selectedTransactions().filter((item) => !item.savings));
  protected readonly reportTotalIncome = computed(() => this.reportTransactions().filter((item) => item.type === 'Income').reduce((sum, item) => sum + item.amount, 0));
  protected readonly reportTotalSpent = computed(() => this.reportTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0));
  protected readonly reportBalance = computed(() => this.reportTotalIncome() - this.reportTotalSpent());
  protected readonly reportBudgetProgress = computed(() => {
    const budgetAmount = this.budget();
    if (budgetAmount <= 0) return this.reportTotalSpent() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.reportTotalSpent() / budgetAmount) * 100));
  });
  protected readonly reportExpenseCount = computed(() => this.reportTransactions().filter((item) => item.type === 'Expense').length);
  protected readonly reportSavingsRate = computed(() => this.reportTotalIncome() > 0 ? (this.reportBalance() / this.reportTotalIncome()) * 100 : 0);
  protected readonly budgetLeft = computed(() => Math.max(0, this.budget() - this.reportTotalSpent()));
  protected readonly savingsProgress = computed(() => Math.min(100, this.reportSavingsRate()));
  protected readonly targetSavingsGoal = signal(10000);
  protected readonly targetSavingsProgress = computed(() => {
    const goal = this.targetSavingsGoal();
    if (goal <= 0) return this.savingsBalance() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.savingsBalance() / goal) * 100));
  });
  protected readonly savingsTransactions = computed(() => this.transactions().filter((item) => item.savings));
  protected readonly savingsBalance = computed(() => this.savingsTransactions().reduce((sum, item) => sum + (item.type === 'Income' ? item.amount : -item.amount), 0));
  protected readonly savingsGoalProgress = computed(() => {
    const goal = this.targetSavingsGoal();
    if (goal <= 0) return this.savingsBalance() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.savingsBalance() / goal) * 100));
  });
  protected readonly amountRemaining = computed(() => Math.max(0, this.targetSavingsGoal() - this.savingsBalance()));
  protected readonly savingsSummary = computed<SavingsMonthlySummary[]>(() => {
    const months = [...new Set(this.savingsTransactions().map((item) => item.date.slice(0, 7)))].sort();
    let runningBalance = 0;
    return months.map((month) => {
      const monthTransactions = this.savingsTransactions().filter((item) => item.date.startsWith(month));
      const contributions = monthTransactions.filter((item) => item.type === 'Income').reduce((sum, item) => sum + item.amount, 0);
      const withdrawals = monthTransactions.filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0);
      const netSavings = contributions - withdrawals;
      runningBalance += netSavings;
      return { month, contributions, withdrawals, netSavings, runningBalance };
    }).reverse();
  });
  protected readonly currentSavingsSummary = computed(() => this.savingsSummary().find((item) => item.month === this.selectedMonth()) ?? {
    month: this.selectedMonth(), contributions: 0, withdrawals: 0, netSavings: 0, runningBalance: this.savingsBalance(),
  });
  protected readonly monthlyContribution = computed(() => this.savingsSummary().find((item) => item.month === this.selectedMonth())?.contributions ?? 0);
  protected readonly targetDate = computed(() => {
    if (this.amountRemaining() === 0) return 'Goal reached';
    if (this.monthlyContribution() === 0) return 'Add monthly savings';
    const target = new Date();
    target.setMonth(target.getMonth() + Math.ceil(this.amountRemaining() / this.monthlyContribution()));
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(target);
  });
  protected readonly recentSavingsTransactions = computed(() => this.transactions()
    .filter((item) => item.savings)
    .slice(0, 5));
  protected readonly savingsBalances = computed(() => [
    { name: 'Target savings', amount: Math.min(Math.max(this.savingsBalance(), 0), this.targetSavingsGoal()) },
    { name: 'Additional savings', amount: Math.max(this.savingsBalance() - this.targetSavingsGoal(), 0) },
  ]);
  protected readonly savingsTrendData = computed<SavingsTrendPoint[]>(() => {
    const months = this.monthOptions().slice(0, 6).reverse();
    const amounts = months.map((month) => this.savingsTransactions()
      .filter((item) => item.date.startsWith(month))
      .reduce((sum, item) => sum + (item.type === 'Income' ? item.amount : -item.amount), 0));
    const maximum = Math.max(...amounts, 1);
    return months.map((month, index) => ({
      month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
      amount: amounts[index],
      height: amounts[index] > 0 ? Math.max(8, (amounts[index] / maximum) * 100) : 4,
    }));
  });
  protected readonly trendData = computed(() => this.monthOptions().slice(0, 6).reverse().map((month) => ({
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
    amount: this.transactions().filter((item) => item.type === 'Expense' && item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0),
  })));
  protected readonly subcategoryTrends = computed<SubcategoryTrend[]>(() => {
    const months = this.monthOptions().slice(0, 6).reverse();
    const totals = new Map<string, number[]>();
    this.transactions().filter((item) => item.type === 'Expense' && item.subcategory).forEach((item) => {
      const points = totals.get(item.subcategory) ?? months.map(() => 0);
      const monthIndex = months.indexOf(item.date.slice(0, 7));
      if (monthIndex >= 0) points[monthIndex] += item.amount;
      totals.set(item.subcategory, points);
    });
    return [...totals.entries()]
      .map(([name, points]) => ({ name, total: points.reduce((sum, amount) => sum + amount, 0), points }))
      .sort((first, second) => second.total - first.total)
      .slice(0, 2)
      .map((trend) => {
        const maximum = Math.max(...trend.points, 1);
        return { ...trend, points: trend.points.map((point) => point ? Math.max(12, (point / maximum) * 100) : 4) };
      });
  });
  protected readonly newCategoryName = signal('');
  protected readonly newCategorySubcategory = signal('');
  protected readonly selectedCategoryForSubcategory = signal('');
  protected readonly newSubcategoryName = signal('');
  protected readonly categorySearch = signal('');
  protected readonly filteredCategories = computed(() => this.filterCategoryGroups(this.categoryGroups()));
  protected readonly filteredSavingsCategories = computed(() => this.filterCategoryGroups(this.savingsCategoryGroups()));
  protected readonly newSavingsTransaction = signal<NewTransaction>(this.emptySavingsTransaction());
  protected readonly editingExpenseId = signal<number | null>(null);
  protected readonly editingExpense = signal<NewTransaction | null>(null);

  constructor() {
    if (!this.isHosted) {
      const saved = localStorage.getItem('ledger-transactions');
      if (saved) {
        try { this.transactions.set(JSON.parse(saved)); } catch { localStorage.removeItem('ledger-transactions'); }
      }
      const savedBudget = localStorage.getItem('ledger-budget');
      if (savedBudget !== null) {
        const parsed = Number(savedBudget);
        if (!Number.isNaN(parsed) && parsed >= 0) this.budget.set(parsed);
      }
      const savedTargetSavings = localStorage.getItem('ledger-target-savings');
      if (savedTargetSavings !== null) {
        const parsed = Number(savedTargetSavings);
        if (!Number.isNaN(parsed) && parsed >= 0) this.targetSavingsGoal.set(parsed);
      }
    }
    if (!this.isHosted) {
      const savedCategories = localStorage.getItem('ledger-categories');
      if (savedCategories) {
        try { this.categoryGroups.set(JSON.parse(savedCategories)); } catch { localStorage.removeItem('ledger-categories'); }
      }
      const savedSharedSubcategories = localStorage.getItem('ledger-shared-subcategories');
      if (savedSharedSubcategories) {
        try { this.sharedSubcategories.set(JSON.parse(savedSharedSubcategories)); } catch { localStorage.removeItem('ledger-shared-subcategories'); }
      }
    }
    this.ensureExpectedBillsCategory();
    if (!this.isHosted) {
      const savedSavingsCategories = localStorage.getItem('ledger-savings-categories');
      if (savedSavingsCategories) {
        try { this.savingsCategoryGroups.set(JSON.parse(savedSavingsCategories)); } catch { localStorage.removeItem('ledger-savings-categories'); }
      }
    }
    if (!this.isHosted) {
      const savedBills = localStorage.getItem('ledger-expected-bills');
      if (savedBills) {
        try { this.expectedBills.set(JSON.parse(savedBills)); } catch { localStorage.removeItem('ledger-expected-bills'); }
      }
    }
    this.loadFromApi();
  }

  protected updateBudget(value: string | number): void {
    if (value === null || value === undefined) return;
    const trimmed = String(value).trim();
    if (!trimmed) return;
    const amount = Number(trimmed);
    if (!Number.isNaN(amount) && amount >= 0) {
      this.budget.set(amount);
      if (!this.isHosted) localStorage.setItem('ledger-budget', String(amount));
      this.syncToApi();
    }
  }

  protected updateTargetSavingsGoal(value: string | number): void {
    if (value === null || value === undefined) return;
    const trimmed = String(value).trim();
    if (!trimmed) return;
    const amount = Number(trimmed);
    if (!Number.isNaN(amount) && amount >= 0) {
      this.targetSavingsGoal.set(amount);
      if (!this.isHosted) localStorage.setItem('ledger-target-savings', String(amount));
      this.syncToApi();
    }
  }

  protected editBudget(): void {
    const value = window.prompt('Enter your monthly budget', String(this.budget()));
    if (value !== null) this.updateBudget(value);
  }

  protected updateField(field: keyof NewTransaction, value: string | number | null): void {
    this.newTransaction.update((form) => {
      if (field === 'type' && value === 'Income') return { ...form, type: 'Income', category: 'Income' };
      if (field === 'type' && value === 'Expense') return { ...form, type: 'Expense', category: form.category === 'Income' ? this.categories[0] : form.category, subcategory: form.subcategory || this.subcategoriesFor(form.category === 'Income' ? this.categories[0] : form.category)[0] || '' };
      if (field === 'category') return form.savings
        ? { ...form, category: String(value), subcategory: this.savingsSubcategoriesFor(String(value))[0] || '' }
        : { ...form, category: String(value), subcategory: this.subcategoriesFor(String(value))[0] || '' };
      return { ...form, [field]: value };
    });
  }

  protected selectTransactionMode(mode: 'Expense' | 'Savings'): void {
    this.newTransaction.update((form) => mode === 'Savings'
      ? { ...form, type: 'Income', savings: true, category: this.savingsCategories[0], subcategory: 'Contribution' }
      : { ...form, type: 'Expense', savings: false, category: form.savings ? this.categories[0] : form.category, subcategory: form.savings ? this.subcategoriesFor(this.categories[0])[0] || '' : form.subcategory });
  }

  protected updateSavingsField(field: keyof NewTransaction, value: string | number | null): void {
    this.newSavingsTransaction.update((form) => {
      if (field === 'category') {
        const category = String(value);
        return { ...form, category, subcategory: this.savingsSubcategoriesFor(category)[0] || '' };
      }
      if (field === 'fundType') {
        const type: TransactionType = value === 'Withdrawal' ? 'Expense' : 'Income';
        const subcategory = value === 'Withdrawal' ? 'Withdrawal' : 'Contribution';
        return { ...form, fundType: String(value), type, subcategory };
      }
      if (field === 'type') {
        const fundType = value === 'Expense' ? 'Withdrawal' : 'Contribution';
        const subcategory = value === 'Expense' ? 'Withdrawal' : 'Contribution';
        return { ...form, type: value as TransactionType, fundType, subcategory };
      }
      return { ...form, [field]: value };
    });
  }

  protected subcategoriesFor(category: string): string[] {
    const categorySubcategories = this.categoryGroups().find((group) => group.name === category)?.subcategories ?? [];
    const allCategorySubcategories = this.categoryGroups().flatMap((group) => group.subcategories);
    return [...new Set([...categorySubcategories, ...this.sharedSubcategories(), ...allCategorySubcategories])];
  }

  protected savingsSubcategoriesFor(category: string): string[] {
    return this.savingsCategoryGroups().find((group) => group.name === category)?.subcategories ?? [];
  }

  protected addCategory(name: string, subcategory: string): void {
    const categoryName = name.trim();
    const subcategoryName = subcategory.trim();
    if (!categoryName || this.categories.some((category) => category.toLowerCase() === categoryName.toLowerCase())) return;
    this.categoryGroups.update((groups) => [...groups, { name: categoryName, subcategories: subcategoryName ? [subcategoryName] : [] }]);
    this.persistCategories();
    this.syncToApi();
  }

  protected addSubcategory(subcategory: string): void {
    const subcategoryName = subcategory.trim();
    if (!subcategoryName || this.sharedSubcategories().some((item) => item.toLowerCase() === subcategoryName.toLowerCase())) return;
    this.sharedSubcategories.update((items) => [...items, subcategoryName]);
    this.categoryGroups.update((groups) => groups.map((group) => group.subcategories.some((item) => item.toLowerCase() === subcategoryName.toLowerCase())
      ? group
      : { ...group, subcategories: [...group.subcategories, subcategoryName] }));
    this.persistCategories();
    this.persistSharedSubcategories();
    this.syncToApi();
  }

  protected addSavingsCategory(name: string, subcategory: string): void {
    const categoryName = name.trim();
    const subcategoryName = subcategory.trim();
    if (!categoryName || this.savingsCategories.some((category) => category.toLowerCase() === categoryName.toLowerCase())) return;
    this.savingsCategoryGroups.update((groups) => [...groups, { name: categoryName, subcategories: subcategoryName ? [subcategoryName] : [] }]);
    this.persistSavingsCategories();
    this.syncToApi();
  }

  protected addSavingsSubcategory(category: string, subcategory: string): void {
    const subcategoryName = subcategory.trim();
    if (!category || !subcategoryName) return;
    this.savingsCategoryGroups.update((groups) => groups.map((group) => group.name === category && !group.subcategories.some((item) => item.toLowerCase() === subcategoryName.toLowerCase()) ? { ...group, subcategories: [...group.subcategories, subcategoryName] } : group));
    this.persistSavingsCategories();
    this.syncToApi();
  }

  protected createCategory(): void {
    this.addCategory(this.newCategoryName(), this.newCategorySubcategory());
    this.newCategoryName.set('');
    this.newCategorySubcategory.set('');
  }

  protected createSubcategory(): void {
    this.addSubcategory(this.newSubcategoryName());
    this.newSubcategoryName.set('');
  }

  protected createSavingsCategory(): void {
    this.addSavingsCategory(this.newCategoryName(), this.newCategorySubcategory());
    this.newCategoryName.set('');
    this.newCategorySubcategory.set('');
  }

  protected createSavingsSubcategory(): void {
    this.addSavingsSubcategory(this.selectedCategoryForSubcategory(), this.newSubcategoryName());
    this.newSubcategoryName.set('');
  }

  private filterCategoryGroups(groups: CategoryGroup[]): CategoryGroup[] {
    const query = this.categorySearch().trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        subcategories: group.subcategories.filter((subcategory) => `${group.name} ${subcategory}`.toLowerCase().includes(query)),
      }))
      .filter((group) => group.name.toLowerCase().includes(query) || group.subcategories.length > 0);
  }

  protected isUserCategory(name: string, savings: boolean): boolean {
    return !(savings ? this.builtInSavingsCategories : this.builtInCategories).has(name);
  }

  protected isUserSubcategory(category: string, subcategory: string, savings: boolean): boolean {
    if (savings) return this.isUserCategory(category, true);
    return !(this.builtInCategorySubcategories.get(category) ?? []).includes(subcategory);
  }

  protected editCategory(name: string, savings: boolean): void {
    const updatedName = window.prompt('Edit category name', name)?.trim();
    if (!updatedName || updatedName === name) return;
    const groups = savings ? this.savingsCategoryGroups() : this.categoryGroups();
    if (groups.some((group) => group.name !== name && group.name.toLowerCase() === updatedName.toLowerCase())) return;
    if (savings) {
      this.savingsCategoryGroups.update((items) => items.map((group) => group.name === name ? { ...group, name: updatedName } : group));
      this.persistSavingsCategories();
      this.syncToApi();
    } else {
      this.categoryGroups.update((items) => items.map((group) => group.name === name ? { ...group, name: updatedName } : group));
      this.transactions.update((items) => items.map((item) => item.category === name ? { ...item, category: updatedName } : item));
      this.expectedBills.update((items) => items.map((bill) => bill.category === name ? { ...bill, category: updatedName } : bill));
      this.persistCategories();
      this.persist();
      this.persistExpectedBills();
      this.syncToApi();
    }
  }

  protected editSubcategory(category: string, subcategory: string, savings: boolean): void {
    const updatedName = window.prompt('Edit sub-category name', subcategory)?.trim();
    if (!updatedName || updatedName === subcategory) return;
    const groups = savings ? this.savingsCategoryGroups() : this.categoryGroups();
    const group = groups.find((item) => item.name === category);
    if (!group || group.subcategories.some((item) => item !== subcategory && item.toLowerCase() === updatedName.toLowerCase())) return;
    if (savings) {
      this.savingsCategoryGroups.update((items) => items.map((item) => item.name === category ? { ...item, subcategories: item.subcategories.map((entry) => entry === subcategory ? updatedName : entry) } : item));
      this.persistSavingsCategories();
      this.syncToApi();
    } else {
      this.categoryGroups.update((items) => items.map((item) => item.name === category ? { ...item, subcategories: item.subcategories.map((entry) => entry === subcategory ? updatedName : entry) } : item));
      this.transactions.update((items) => items.map((item) => item.category === category && item.subcategory === subcategory ? { ...item, subcategory: updatedName } : item));
      this.expectedBills.update((items) => items.map((bill) => bill.category === category && bill.subcategory === subcategory ? { ...bill, subcategory: updatedName } : bill));
      this.persistCategories();
      this.persist();
      this.persistExpectedBills();
      this.syncToApi();
    }
  }

  protected deleteCategory(name: string, savings: boolean): void {
    if (savings) {
      this.savingsCategoryGroups.update((items) => items.filter((group) => group.name !== name));
      this.persistSavingsCategories();
      this.syncToApi();
      return;
    }
    this.categoryGroups.update((items) => items.filter((group) => group.name !== name));
    this.expectedBills.update((items) => items.filter((bill) => bill.category !== name));
    this.persistCategories();
    this.persistExpectedBills();
    this.syncToApi();
  }

  protected deleteSubcategory(category: string, subcategory: string, savings: boolean): void {
    if (savings) {
      this.savingsCategoryGroups.update((items) => items.map((group) => group.name === category
        ? { ...group, subcategories: group.subcategories.filter((item) => item !== subcategory) }
        : group));
      this.persistSavingsCategories();
      this.syncToApi();
      return;
    }
    this.categoryGroups.update((items) => items.map((group) => group.name === category
      ? { ...group, subcategories: group.subcategories.filter((item) => item !== subcategory) }
      : group));
    this.transactions.update((items) => items.map((item) => item.category === category && item.subcategory === subcategory
      ? { ...item, subcategory: '' }
      : item));
    this.expectedBills.update((items) => items.filter((bill) => !(bill.category === category && bill.subcategory === subcategory)));
    this.persistCategories();
    this.persist();
    this.persistExpectedBills();
    this.syncToApi();
  }

  protected addExpectedBill(): void {
    const name = this.newBillName().trim();
    const amount = Number(this.newBillAmount());
    const dueDay = Math.max(1, Math.min(31, Number(this.newBillDueDay()) || 1));
    if (!name || !this.newBillCategory() || !this.newBillSubcategory() || !Number.isFinite(amount) || amount <= 0) return;
    this.expectedBills.update((bills) => [...bills, {
      id: Date.now(), name, category: this.newBillCategory(), subcategory: this.newBillSubcategory(), amount, dueDay, active: true,
    }]);
    this.persistExpectedBills();
    this.syncToApi();
    this.newBillName.set('');
    this.newBillSubcategory.set(this.subcategoriesFor(this.newBillCategory())[0] || '');
    this.newBillAmount.set(null);
    this.newBillDueDay.set(1);
  }

  protected removeExpectedBill(id: number): void {
    this.expectedBills.update((bills) => bills.filter((bill) => bill.id !== id));
    this.persistExpectedBills();
    this.syncToApi();
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
      subcategory: this.subcategoriesFor(category)[0] || '',
    } : bill);
  }

  protected cancelEditingBill(): void {
    this.editingBillId.set(null);
    this.editingBill.set(null);
  }

  protected saveEditingBill(): void {
    const id = this.editingBillId();
    const bill = this.editingBill();
    const amount = Number(bill?.amount);
    const dueDay = Math.max(1, Math.min(31, Number(bill?.dueDay) || 1));
    if (id === null || !bill || !bill.name.trim() || !bill.category || !bill.subcategory || !Number.isFinite(amount) || amount <= 0) return;
    this.expectedBills.update((items) => items.map((item) => item.id === id ? {
      ...item,
      name: bill.name.trim(),
      category: bill.category,
      subcategory: bill.subcategory,
      amount,
      dueDay,
    } : item));
    this.persistExpectedBills();
    this.syncToApi();
    this.cancelEditingBill();
  }

  protected updateBillCategory(category: string): void {
    this.newBillCategory.set(category);
    this.newBillSubcategory.set(this.subcategoriesFor(category)[0] || '');
  }

  private ensureExpectedBillsCategory(): void {
    const expectedBillsCategory = this.categoryGroups().find((group) => group.name === 'Expected Bills');
    if (!expectedBillsCategory) {
      this.categoryGroups.update((groups) => [...groups, { name: 'Expected Bills', subcategories: ['Globe', 'Condo'] }]);
      this.persistCategories();
      return;
    }
    const subcategories = [...new Set([...expectedBillsCategory.subcategories, 'Globe', 'Condo'])];
    if (subcategories.length !== expectedBillsCategory.subcategories.length) {
      this.categoryGroups.update((groups) => groups.map((group) => group.name === 'Expected Bills' ? { ...group, subcategories } : group));
      this.persistCategories();
    }
  }

  protected billProgress(spent: number, amount: number): number {
    return Math.min(100, (spent / amount) * 100);
  }

  protected billStatus(spent: number, amount: number, overspent: boolean): string {
    const difference = Math.abs(amount - spent).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
    return overspent ? `Overspending by ${difference}` : `${difference} remaining`;
  }

  protected selectSection(section: string): void {
    this.activeSection.set(section);
    this.mobileMenuOpen.set(false);
  }

  protected selectSavingsSubPage(page: 'Plan' | 'AddTransaction'): void {
    this.savingsSubPage.set(page);
  }

  protected toggleTransactionForm(): void {
    this.transactionFormOpen.update((isOpen) => !isOpen);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((isOpen) => !isOpen);
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

  protected selectMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  protected addTransaction(): void {
    const entry = this.newTransaction();
    if (!entry.description.trim() || !entry.date || !entry.category || !entry.amount || entry.amount <= 0) return;
    this.transactions.update((items) => [{ ...entry, id: Date.now(), savings: entry.savings ?? false, description: entry.description.trim(), amount: Number(entry.amount) }, ...items]);
    this.persist();
    this.syncToApi();
    this.newTransaction.set(this.emptyTransaction());
  }

  protected addSavingsTransaction(): void {
    const entry = this.newSavingsTransaction();
    const fundType = entry.fundType?.trim() ?? '';
    const account = entry.account?.trim() ?? '';
    if (!entry.description.trim() || !entry.date || !entry.amount || entry.amount <= 0 || !fundType || !account) return;
    this.transactions.update((items) => [{
      ...entry,
      id: Date.now(),
      fundType,
      account,
      savings: true,
      description: entry.description.trim(),
      amount: Number(entry.amount),
    }, ...items]);
    this.persist();
    this.syncToApi();
    this.newSavingsTransaction.set(this.emptySavingsTransaction());
  }

  protected removeTransaction(id: number): void {
    this.transactions.update((items) => items.filter((item) => item.id !== id));
    this.persist();
    if (this.apiUrl) void fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => undefined);
  }

  protected startEditingExpense(transaction: Transaction): void {
    if (transaction.type !== 'Expense' || transaction.savings) return;
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
    if (id === null || !expense || !expense.description?.trim() || !expense.date || !expense.category || !expense.amount || expense.amount <= 0) return;
    this.transactions.update((items) => items.map((item) => item.id === id ? {
      ...item,
      date: expense.date,
      description: expense.description.trim(),
      category: expense.category,
      subcategory: expense.subcategory,
      amount: Number(expense.amount),
    } : item));
    this.persist();
    this.syncToApi();
    this.cancelEditingExpense();
  }

  protected importWorkbook(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
      const imported: Transaction[] = rows.map((row, index) => ({
        id: Date.now() + index,
        date: String(row['Date'] ?? new Date().toISOString().slice(0, 10)),
        description: String(row['Description'] ?? 'Imported transaction'),
        category: String(row['Category'] ?? 'Other'),
        type: String(row['Type'] ?? 'Expense') === 'Income' ? 'Income' as TransactionType : 'Expense' as TransactionType,
        subcategory: String(row['Subcategory'] ?? ''),
        amount: Number(row['Amount'] ?? 0),
        savings: false,
      })).filter((item) => item.amount > 0);
      this.transactions.set([...imported, ...this.transactions()]);
      this.persist();
      this.syncToApi();
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  protected exportWorkbook(): void {
    const rows = this.transactions().map(({ id, ...item }) => ({ Date: item.date, Description: item.description, Category: item.category, Subcategory: item.subcategory, Type: item.type, Amount: item.amount }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
    XLSX.writeFile(workbook, 'ledger-transactions.xlsx');
  }

  protected categoryTotal(category: string): number {
    return this.selectedTransactions().filter((item) => item.category === category && item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0);
  }

  protected formatMonth(month: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  }

  protected categoryColor(index: number): string {
    const hue = (this.categoryColorSeed + (index * 137.508)) % 360;
    return `hsl(${hue} 65% 45%)`;
  }

  protected get hosted(): boolean {
    return this.isHosted;
  }

  protected retryCloudData(): void {
    this.cloudDataError.set(false);
    this.cloudDataReady.set(false);
    this.loadFromApi();
  }

  private persist(): void { if (!this.isHosted) localStorage.setItem('ledger-transactions', JSON.stringify(this.transactions())); }
  private persistCategories(): void { if (!this.isHosted) localStorage.setItem('ledger-categories', JSON.stringify(this.categoryGroups())); }
  private persistSavingsCategories(): void { if (!this.isHosted) localStorage.setItem('ledger-savings-categories', JSON.stringify(this.savingsCategoryGroups())); }
  private loadFromApi(): void {
    if (!this.apiUrl) return;
    const requestUrl = this.isHosted ? `${this.apiUrl}&cacheBust=${Date.now()}` : this.apiUrl;
    void fetch(requestUrl, { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: Transaction[] | CloudData) => {
      const cloudData = Array.isArray(data) ? { transactions: data } : data;
      this.transactions.set(cloudData.transactions);
      const monthlyBudget = cloudData.settings?.monthlyBudget;
      if (typeof monthlyBudget === 'number' && monthlyBudget >= 0) {
        this.budget.set(monthlyBudget);
        if (!this.isHosted) localStorage.setItem('ledger-budget', String(monthlyBudget));
      }
      const targetSavingsGoal = cloudData.settings?.targetSavingsGoal;
      if (typeof targetSavingsGoal === 'number' && targetSavingsGoal >= 0) {
        this.targetSavingsGoal.set(targetSavingsGoal);
        if (!this.isHosted) localStorage.setItem('ledger-target-savings', String(targetSavingsGoal));
      }
      if (Array.isArray(cloudData.expectedBills)) {
        this.expectedBills.set(cloudData.expectedBills.map((bill) => ({ ...bill, subcategory: String(bill.subcategory || '') })));
        if (!this.isHosted) this.persistExpectedBills();
      }
      if (Array.isArray(cloudData.categories)) {
        this.categoryGroups.set(cloudData.categories);
        if (!this.isHosted) this.persistCategories();
      }
      if (Array.isArray(cloudData.sharedSubcategories)) {
        this.sharedSubcategories.set(cloudData.sharedSubcategories);
        if (!this.isHosted) this.persistSharedSubcategories();
      }
      if (Array.isArray(cloudData.savingsCategories)) {
        this.savingsCategoryGroups.set(cloudData.savingsCategories);
        if (!this.isHosted) this.persistSavingsCategories();
      }
      this.persist();
      this.cloudDataReady.set(true);
    }).catch(() => this.cloudDataError.set(true));
  }
  private syncToApi(): void {
    if (!this.apiUrl) return;
    const isGoogleSheets = this.apiUrl === this.googleSheetsUrl;
    void fetch(this.apiUrl, {
      method: isGoogleSheets ? 'POST' : 'PUT',
      headers: { 'Content-Type': isGoogleSheets ? 'text/plain;charset=utf-8' : 'application/json' },
      body: JSON.stringify(isGoogleSheets ? {
        action: 'replace',
        transactions: this.transactions(),
        expectedBills: this.expectedBills(),
        categories: this.categoryGroups(),
        sharedSubcategories: this.sharedSubcategories(),
        savingsCategories: this.savingsCategoryGroups(),
        settings: { monthlyBudget: this.budget(), targetSavingsGoal: this.targetSavingsGoal() },
      } : this.transactions()),
    }).catch(() => undefined);
  }
  private persistExpectedBills(): void { if (!this.isHosted) localStorage.setItem('ledger-expected-bills', JSON.stringify(this.expectedBills())); }
  private persistSharedSubcategories(): void { if (!this.isHosted) localStorage.setItem('ledger-shared-subcategories', JSON.stringify(this.sharedSubcategories())); }
  private emptyTransaction(): NewTransaction { return { date: new Date().toISOString().slice(0, 10), description: '', category: 'Food', subcategory: 'Groceries', type: 'Expense', amount: null, savings: false }; }
  private emptySavingsTransaction(): NewTransaction { return { date: new Date().toISOString().slice(0, 10), description: '', category: 'Savings', subcategory: 'Contribution', type: 'Income', amount: null, fundType: 'Contribution', account: '' }; }
}

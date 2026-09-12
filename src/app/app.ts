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
  id: number;
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
  settings?: {
    monthlyBudget?: number;
    targetSavingsGoal?: number;
    savingsPlan?: {
      salary?: number;
      savingsRate?: number;
      investment?: number;
      bills?: SavingsPlanBill[];
    };
  };
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
  protected readonly savingsDetailsOpen = signal(false);
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
  private readonly defaultSavingsPlanBills: SavingsPlanBill[] = [
    { id: 1, name: 'Condo Amortization', monthly: 6000, paycheckOne: 3000, paycheckTwo: 3000 },
    { id: 2, name: 'Car Insurance', monthly: 2482, paycheckOne: 1241, paycheckTwo: 1241 },
    { id: 3, name: 'Easycash (Car)', monthly: 13403, paycheckOne: 6701.5, paycheckTwo: 6701.5 },
    { id: 4, name: 'Avida Investment', monthly: 11173, paycheckOne: 5586.5, paycheckTwo: 5586.5 },
    { id: 5, name: 'Parking Rent', monthly: 4000, paycheckOne: 2000, paycheckTwo: 2000 },
    { id: 6, name: 'Condo Dues', monthly: 5100, paycheckOne: 2550, paycheckTwo: 2550 },
    { id: 7, name: 'Grocery', monthly: 15000, paycheckOne: 7500, paycheckTwo: 7500 },
    { id: 8, name: 'Allowance (Shei)', monthly: 8000, paycheckOne: 4000, paycheckTwo: 4000 },
    { id: 9, name: 'Gas', monthly: 5000, paycheckOne: 2500, paycheckTwo: 2500 },
    { id: 10, name: 'Internet', monthly: 1800, paycheckOne: 900, paycheckTwo: 900 },
    { id: 11, name: 'Electricity', monthly: 8000, paycheckOne: 4000, paycheckTwo: 4000 },
    { id: 12, name: 'Anytime Fitness', monthly: 2400, paycheckOne: 1200, paycheckTwo: 1200 },
  ];

  protected readonly savingsPlanSalary = signal(192000);
  protected readonly savingsPlanSavingsRate = signal(40);
  protected readonly savingsPlanInvestment = signal(18200);
  protected readonly savingsPlanBills = signal<SavingsPlanBill[]>(this.defaultSavingsPlanBills);
  protected readonly editingPlanParameters = signal(false);
  protected readonly editingSavingsBillId = signal<number | null>(null);
  protected readonly editingSavingsBill = signal<{ name: string; monthly: number } | null>(null);
  protected readonly newSavingsBillName = signal('');
  protected readonly newSavingsBillAmount = signal<number | null>(null);

  protected readonly savingsPlanFixedNeeds = computed(() =>
    this.savingsPlanBills().reduce((sum, bill) => sum + bill.monthly, 0)
  );
  protected readonly savingsPlanGoal = computed(() =>
    Math.round(this.savingsPlanSalary() * (this.savingsPlanSavingsRate() / 100))
  );
  protected readonly savingsPlanEmergencyReserve = computed(() =>
    Math.max(0, this.savingsPlanGoal() - this.savingsPlanInvestment())
  );
  protected readonly savingsPlanAvailableAfterFixed = computed(() =>
    this.savingsPlanSalary() - this.savingsPlanFixedNeeds()
  );
  protected readonly savingsPlanVariableAllowance = computed(() =>
    this.savingsPlanSalary() - this.savingsPlanFixedNeeds() - this.savingsPlanGoal()
  );
  protected readonly savingsPlanSpendingCap = computed(() =>
    this.savingsPlanFixedNeeds() + this.savingsPlanVariableAllowance()
  );

  protected readonly savingsPlan = computed(() => ({
    salary: this.savingsPlanSalary(),
    fixedNeeds: this.savingsPlanFixedNeeds(),
    availableAfterFixedNeeds: this.savingsPlanAvailableAfterFixed(),
    savingsGoal: this.savingsPlanGoal(),
    spendingCap: this.savingsPlanSpendingCap(),
    variableAllowance: this.savingsPlanVariableAllowance(),
    threeMonthFund: this.savingsPlanFixedNeeds() * 3,
    sixMonthFund: this.savingsPlanFixedNeeds() * 6,
  }));

  protected readonly savingsPlanAllocations = computed<SavingsPlanAllocation[]>(() => {
    const salary = this.savingsPlanSalary();
    const savingsGoal = this.savingsPlanGoal();
    const investment = this.savingsPlanInvestment();
    const emergency = this.savingsPlanEmergencyReserve();
    const fixedNeeds = this.savingsPlanFixedNeeds();
    const variableAllowance = this.savingsPlanVariableAllowance();
    const spendingCap = this.savingsPlanSpendingCap();
    return [
      { name: 'Combined salary received', paycheckOne: salary / 2, paycheckTwo: salary / 2, monthly: salary },
      { name: `Save first - ${this.savingsPlanSavingsRate()}%`, paycheckOne: savingsGoal / 2, paycheckTwo: savingsGoal / 2, monthly: savingsGoal },
      { name: 'Minimum investment', paycheckOne: investment / 2, paycheckTwo: investment / 2, monthly: investment },
      { name: 'Emergency / savings reserve', paycheckOne: emergency / 2, paycheckTwo: emergency / 2, monthly: emergency },
      { name: 'Reserve for fixed needs', paycheckOne: fixedNeeds / 2, paycheckTwo: fixedNeeds / 2, monthly: fixedNeeds },
      { name: 'Variable spending allowance', paycheckOne: variableAllowance / 2, paycheckTwo: variableAllowance / 2, monthly: variableAllowance },
      { name: 'Total spending cap', paycheckOne: spendingCap / 2, paycheckTwo: spendingCap / 2, monthly: spendingCap },
    ];
  });

  protected readonly savingsPlanBuckets = computed<SavingsPlanBucket[]>(() => {
    const investment = this.savingsPlanInvestment();
    const emergency = this.savingsPlanEmergencyReserve();
    const total = this.savingsPlanGoal();
    return [
      { name: 'Minimum Investment', perPayday: investment / 2, monthly: investment, purpose: 'Build long-term income-replacement assets.' },
      { name: 'Emergency Fund', perPayday: emergency / 2, monthly: emergency, purpose: 'Build the 3-6 month safety net first.' },
      { name: 'Total Savings', perPayday: total / 2, monthly: total, purpose: 'Automatic transfer immediately after payday.' },
    ];
  });

  protected readonly savingsPlanRoadmap = computed<SavingsPlanRoadmap[]>(() => {
    const fixed = this.savingsPlanFixedNeeds();
    const monthlyContribution = this.savingsPlanEmergencyReserve();
    const threeMonth = fixed * 3;
    const sixMonth = fixed * 6;
    const current = this.savingsBalance();
    const estThree = monthlyContribution > 0 ? Math.max(1, Math.ceil(Math.max(0, threeMonth - current) / monthlyContribution)) : 0;
    const estSix = monthlyContribution > 0 ? Math.max(1, Math.ceil(Math.max(0, sixMonth - current) / monthlyContribution)) : 0;
    return [
      { milestone: '3-month safety net', target: threeMonth, monthlyContribution, estimatedMonths: estThree },
      { milestone: '6-month safety net', target: sixMonth, monthlyContribution, estimatedMonths: estSix },
    ];
  });
  protected get categories(): string[] { return this.categoryGroups().map((group) => group.name); }
  protected get savingsCategories(): string[] { return this.savingsCategoryGroups().map((group) => group.name); }
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly cloudDataReady = signal(!this.isHosted);
  protected readonly cloudDataError = signal(false);
  protected readonly syncPending = signal(false);
  protected readonly syncError = signal(false);
  protected readonly regularTransactions = computed(() => this.transactions().filter((item) => !item.savings));
  private getInitialBudget(): number {
    try {
      const saved = localStorage.getItem('ledger-budget');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {}
    return 32842;
  }

  private getInitialTargetSavings(): number {
    try {
      const saved = localStorage.getItem('ledger-target-savings');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {}
    return 76800;
  }

  protected readonly budget = signal(this.getInitialBudget());
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
  protected readonly totalSpent = computed(() => this.selectedTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0));
  protected readonly regularExpenseCount = computed(() => this.selectedTransactions().filter((item) => item.type === 'Expense').length);
  protected readonly availableBalance = computed(() => {
    const monthlyRegularSpending = this.selectedTransactions().filter((item) => item.type === 'Expense' && !item.savings).reduce((sum, item) => sum + item.amount, 0);
    return this.budget() - monthlyRegularSpending;
  });
  protected readonly monthlyExpenses = computed(() =>
    this.selectedTransactions().filter((item) => item.type === 'Expense' && !item.savings).reduce((sum, item) => sum + item.amount, 0)
  );
  protected readonly monthlySavingsContributions = computed(() =>
    this.savingsTransactions().filter((item) => item.type === 'Income' && item.date.startsWith(this.selectedMonth())).reduce((sum, item) => sum + item.amount, 0)
  );
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
  protected readonly reportTotalSpent = computed(() => this.reportTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0));
  protected readonly reportBudgetProgress = computed(() => {
    const budgetAmount = this.budget();
    if (budgetAmount <= 0) return this.reportTotalSpent() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.reportTotalSpent() / budgetAmount) * 100));
  });
  protected readonly reportExpenseCount = computed(() => this.reportTransactions().filter((item) => item.type === 'Expense').length);
  protected readonly budgetLeft = computed(() => Math.max(0, this.budget() - this.reportTotalSpent()));
  protected readonly targetSavingsGoal = signal(this.getInitialTargetSavings());
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
  protected readonly recentlyAddedRegular = signal(false);
  protected readonly recentlyAddedSavings = signal(false);
  protected readonly editingBudget = signal(false);
  protected readonly budgetDraft = signal<number | null>(null);
  private regularAddedTimer: ReturnType<typeof setTimeout> | null = null;
  private savingsAddedTimer: ReturnType<typeof setTimeout> | null = null;

  protected setSavingsAmount(amount: number): void {
    this.updateSavingsField('amount', Math.round(amount));
  }

  protected startEditingBudget(): void {
    this.budgetDraft.set(this.budget());
    this.editingBudget.set(true);
  }

  protected cancelEditingBudget(): void {
    this.editingBudget.set(false);
  }

  protected saveBudget(): void {
    const draft = this.budgetDraft();
    if (draft !== null && !Number.isNaN(draft) && draft >= 0) {
      this.updateBudget(draft);
    }
    this.editingBudget.set(false);
  }

  protected useAllowanceAsBudget(): void {
    const allowance = this.savingsPlan().variableAllowance;
    if (allowance > 0) {
      this.updateBudget(allowance);
      this.editingBudget.set(false);
    }
  }

  constructor() {
    try {
      const saved = localStorage.getItem('ledger-transactions');
      if (saved) {
        this.transactions.set(JSON.parse(saved));
      }
    } catch {
      try { localStorage.removeItem('ledger-transactions'); } catch {}
    }

    try {
      const savedBudget = localStorage.getItem('ledger-budget');
      if (savedBudget !== null) {
        const parsed = Number(savedBudget);
        if (!Number.isNaN(parsed) && parsed >= 0) this.budget.set(parsed);
      }
    } catch {}

    try {
      const savedTargetSavings = localStorage.getItem('ledger-target-savings');
      if (savedTargetSavings !== null) {
        const parsed = Number(savedTargetSavings);
        if (!Number.isNaN(parsed) && parsed >= 0) this.targetSavingsGoal.set(parsed);
      }
    } catch {}

    try {
      const savedCategories = localStorage.getItem('ledger-categories');
      if (savedCategories) {
        this.categoryGroups.set(JSON.parse(savedCategories));
      }
    } catch {
      try { localStorage.removeItem('ledger-categories'); } catch {}
    }

    try {
      const savedSharedSubcategories = localStorage.getItem('ledger-shared-subcategories');
      if (savedSharedSubcategories) {
        this.sharedSubcategories.set(JSON.parse(savedSharedSubcategories));
      }
    } catch {
      try { localStorage.removeItem('ledger-shared-subcategories'); } catch {}
    }

    this.ensureExpectedBillsCategory();

    try {
      const savedSavingsCategories = localStorage.getItem('ledger-savings-categories');
      if (savedSavingsCategories) {
        this.savingsCategoryGroups.set(JSON.parse(savedSavingsCategories));
      }
    } catch {
      try { localStorage.removeItem('ledger-savings-categories'); } catch {}
    }

    try {
      const savedBills = localStorage.getItem('ledger-expected-bills');
      if (savedBills) {
        this.expectedBills.set(JSON.parse(savedBills));
      }
    } catch {
      try { localStorage.removeItem('ledger-expected-bills'); } catch {}
    }

    try {
      const savedPlanSalary = localStorage.getItem('ledger-plan-salary');
      if (savedPlanSalary !== null) {
        const parsed = Number(savedPlanSalary);
        if (!Number.isNaN(parsed) && parsed >= 0) this.savingsPlanSalary.set(parsed);
      }
      const savedPlanRate = localStorage.getItem('ledger-plan-rate');
      if (savedPlanRate !== null) {
        const parsed = Number(savedPlanRate);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) this.savingsPlanSavingsRate.set(parsed);
      }
      const savedPlanInv = localStorage.getItem('ledger-plan-investment');
      if (savedPlanInv !== null) {
        const parsed = Number(savedPlanInv);
        if (!Number.isNaN(parsed) && parsed >= 0) this.savingsPlanInvestment.set(parsed);
      }
      const savedPlanBills = localStorage.getItem('ledger-plan-bills');
      if (savedPlanBills) {
        const parsed = JSON.parse(savedPlanBills);
        if (Array.isArray(parsed) && parsed.length) this.savingsPlanBills.set(parsed);
      }
    } catch {}

    this.loadFromApi();
  }

  protected updateBudget(value: string | number): void {
    if (value === null || value === undefined) return;
    const trimmed = String(value).trim();
    if (!trimmed) return;
    const amount = Number(trimmed);
    if (!Number.isNaN(amount) && amount >= 0) {
      this.budget.set(amount);
      try { localStorage.setItem('ledger-budget', String(amount)); } catch {}
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
      try { localStorage.setItem('ledger-target-savings', String(amount)); } catch {}
      this.syncToApi();
    }
  }

  protected editBudget(): void {
    this.startEditingBudget();
  }

  protected updateField(field: keyof NewTransaction, value: string | number | null): void {
    this.newTransaction.update((form) => {
      if (field === 'category') return form.savings
        ? { ...form, category: String(value), subcategory: this.savingsSubcategoriesFor(String(value))[0] || '' }
        : { ...form, category: String(value), subcategory: this.subcategoriesFor(String(value))[0] || '' };
      return { ...form, [field]: value };
    });
  }

  protected selectTransactionMode(mode: 'Expense' | 'Savings'): void {
    this.newTransaction.update((form) => mode === 'Savings'
      ? { ...form, type: 'Income', savings: true, category: this.savingsCategories[0] || 'Emergency Fund', subcategory: this.savingsSubcategoriesFor(this.savingsCategories[0] || 'Emergency Fund')[0] || '' }
      : { ...form, type: 'Expense', savings: false, category: form.savings ? (this.categories[0] || 'Food') : form.category, subcategory: form.savings ? (this.subcategoriesFor(this.categories[0] || 'Food')[0] || '') : form.subcategory });
  }

  protected updateSavingsField(field: keyof NewTransaction, value: string | number | null): void {
    this.newSavingsTransaction.update((form) => {
      if (field === 'category') {
        const category = String(value);
        return { ...form, category, subcategory: this.savingsSubcategoriesFor(category)[0] || '' };
      }
      if (field === 'type') {
        return { ...form, type: value as TransactionType, fundType: value === 'Expense' ? 'Withdrawal' : 'Contribution' };
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

  protected toggleSavingsDetails(): void {
    this.savingsDetailsOpen.update((isOpen) => !isOpen);
  }

  protected toggleEditingPlanParameters(): void {
    this.editingPlanParameters.update((isOpen) => !isOpen);
  }

  protected updateSavingsPlanSalary(value: string | number | null): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingsPlanSalary.set(amount);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  protected updateSavingsPlanRate(value: string | number | null): void {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
    this.savingsPlanSavingsRate.set(rate);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  protected updateSavingsPlanInvestment(value: string | number | null): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingsPlanInvestment.set(amount);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  protected resetSavingsPlanToDefaults(): void {
    this.savingsPlanSalary.set(192000);
    this.savingsPlanSavingsRate.set(40);
    this.savingsPlanInvestment.set(18200);
    this.savingsPlanBills.set(this.defaultSavingsPlanBills);
    this.persistSavingsPlan();
    this.syncToApi();
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
    const monthly = Number(bill.monthly);
    if (!Number.isFinite(monthly) || monthly < 0) return;
    this.savingsPlanBills.update((bills) => bills.map((b) => b.id === id ? {
      ...b,
      name: bill.name.trim(),
      monthly,
      paycheckOne: monthly / 2,
      paycheckTwo: monthly / 2,
    } : b));
    this.persistSavingsPlan();
    this.syncToApi();
    this.cancelEditingSavingsBill();
  }

  protected removeSavingsPlanBill(id: number): void {
    this.savingsPlanBills.update((bills) => bills.filter((b) => b.id !== id));
    this.persistSavingsPlan();
    this.syncToApi();
  }

  protected addSavingsPlanBill(): void {
    const name = this.newSavingsBillName().trim();
    const monthly = Number(this.newSavingsBillAmount());
    if (!name || !Number.isFinite(monthly) || monthly <= 0) return;
    const newBill: SavingsPlanBill = {
      id: Date.now(),
      name,
      monthly,
      paycheckOne: monthly / 2,
      paycheckTwo: monthly / 2,
    };
    this.savingsPlanBills.update((bills) => [...bills, newBill]);
    this.newSavingsBillName.set('');
    this.newSavingsBillAmount.set(null);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  protected toggleTransactionForm(): void {
    this.transactionFormOpen.update((isOpen) => !isOpen);
  }

  protected openTransactionForm(): void {
    this.transactionFormOpen.set(true);
    requestAnimationFrame(() => document.getElementById('transaction-entry-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const category = entry.category || (entry.savings ? (this.savingsCategories[0] || 'Emergency Fund') : (this.categories[0] || 'Food'));
    const description = entry.description?.trim() || entry.subcategory || category;
    const date = entry.date || new Date().toISOString().slice(0, 10);
    this.transactions.update((items) => [{
      ...entry,
      id: Date.now(),
      type: entry.savings ? 'Income' : 'Expense',
      fundType: entry.savings ? 'Contribution' : undefined,
      savings: entry.savings ?? false,
      description,
      category,
      date,
      amount,
    }, ...items]);
    this.persist();
    if (this.regularAddedTimer) clearTimeout(this.regularAddedTimer);
    this.recentlyAddedRegular.set(true);
    this.regularAddedTimer = setTimeout(() => this.recentlyAddedRegular.set(false), 1600);
    this.syncToApi();
    this.newTransaction.set(this.emptyTransaction());
  }

  protected addSavingsTransaction(): void {
    const entry = this.newSavingsTransaction();
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const category = entry.category || this.savingsCategories[0] || 'Emergency Fund';
    const account = entry.account?.trim() ?? '';
    const description = entry.description?.trim() || entry.subcategory || category;
    const date = entry.date || new Date().toISOString().slice(0, 10);
    if (account) {
      try { localStorage.setItem('ledger-last-savings-account', account); } catch {}
    }
    this.transactions.update((items) => [{
      ...entry,
      id: Date.now(),
      fundType: entry.type === 'Expense' ? 'Withdrawal' : 'Contribution',
      account,
      savings: true,
      description,
      category,
      date,
      amount,
    }, ...items]);
    this.persist();
    if (this.savingsAddedTimer) clearTimeout(this.savingsAddedTimer);
    this.recentlyAddedSavings.set(true);
    this.savingsAddedTimer = setTimeout(() => this.recentlyAddedSavings.set(false), 1600);
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
        type: 'Expense' as TransactionType,
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
    this.syncError.set(false);
    if (!this.cloudDataReady()) {
      this.cloudDataReady.set(false);
      this.loadFromApi();
    } else {
      this.syncToApi();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem('ledger-transactions', JSON.stringify(this.transactions()));
    } catch {
      // quota or private browsing mode
    }
  }
  private persistCategories(): void {
    try { localStorage.setItem('ledger-categories', JSON.stringify(this.categoryGroups())); } catch {}
  }
  private persistSavingsCategories(): void {
    try { localStorage.setItem('ledger-savings-categories', JSON.stringify(this.savingsCategoryGroups())); } catch {}
  }
  private persistSavingsPlan(): void {
    try {
      localStorage.setItem('ledger-plan-salary', String(this.savingsPlanSalary()));
      localStorage.setItem('ledger-plan-rate', String(this.savingsPlanSavingsRate()));
      localStorage.setItem('ledger-plan-investment', String(this.savingsPlanInvestment()));
      localStorage.setItem('ledger-plan-bills', JSON.stringify(this.savingsPlanBills()));
    } catch {}
  }
  private loadFromApi(): void {
    if (!this.apiUrl) return;
    const requestUrl = this.isHosted ? `${this.apiUrl}&cacheBust=${Date.now()}` : this.apiUrl;
    void fetch(requestUrl, { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: Transaction[] | CloudData) => {
      const cloudData = Array.isArray(data) ? { transactions: data } : data;
      this.transactions.set(cloudData.transactions);
      const monthlyBudget = cloudData.settings?.monthlyBudget;
      if (typeof monthlyBudget === 'number' && monthlyBudget >= 0) {
        this.budget.set(monthlyBudget);
        try { localStorage.setItem('ledger-budget', String(monthlyBudget)); } catch {}
      }
      const targetSavingsGoal = cloudData.settings?.targetSavingsGoal;
      if (typeof targetSavingsGoal === 'number' && targetSavingsGoal >= 0) {
        this.targetSavingsGoal.set(targetSavingsGoal);
        try { localStorage.setItem('ledger-target-savings', String(targetSavingsGoal)); } catch {}
      }
      const plan = cloudData.settings?.savingsPlan;
      if (plan) {
        if (typeof plan.salary === 'number' && plan.salary >= 0) this.savingsPlanSalary.set(plan.salary);
        if (typeof plan.savingsRate === 'number' && plan.savingsRate >= 0 && plan.savingsRate <= 100) this.savingsPlanSavingsRate.set(plan.savingsRate);
        if (typeof plan.investment === 'number' && plan.investment >= 0) this.savingsPlanInvestment.set(plan.investment);
        if (Array.isArray(plan.bills) && plan.bills.length) this.savingsPlanBills.set(plan.bills);
        this.persistSavingsPlan();
      }
      if (Array.isArray(cloudData.expectedBills)) {
        this.expectedBills.set(cloudData.expectedBills.map((bill) => ({ ...bill, subcategory: String(bill.subcategory || '') })));
        this.persistExpectedBills();
      }
      if (Array.isArray(cloudData.categories)) {
        this.categoryGroups.set(cloudData.categories);
        this.persistCategories();
      }
      if (Array.isArray(cloudData.sharedSubcategories)) {
        this.sharedSubcategories.set(cloudData.sharedSubcategories);
        this.persistSharedSubcategories();
      }
      if (Array.isArray(cloudData.savingsCategories)) {
        this.savingsCategoryGroups.set(cloudData.savingsCategories);
        this.persistSavingsCategories();
      }
      this.persist();
      this.cloudDataReady.set(true);
    }).catch(() => {
      try {
        const saved = localStorage.getItem('ledger-transactions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            this.transactions.set(parsed);
            this.cloudDataReady.set(true);
          }
        }
      } catch {}
      this.cloudDataError.set(true);
    });
  }
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private syncInProgress = false;
  private syncQueued = false;

  private syncToApi(immediate = false): void {
    if (!this.apiUrl) return;
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    if (immediate) {
      this.executeSyncToApi();
      return;
    }
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      this.executeSyncToApi();
    }, 400);
  }

  private executeSyncToApi(): void {
    if (!this.apiUrl) return;
    if (this.syncInProgress) {
      this.syncQueued = true;
      return;
    }
    this.syncInProgress = true;
    this.syncPending.set(true);
    this.syncError.set(false);
    const isGoogleSheets = this.apiUrl === this.googleSheetsUrl;
    const payload = JSON.stringify(isGoogleSheets ? {
      action: 'replace',
      transactions: this.transactions(),
      expectedBills: this.expectedBills(),
      categories: this.categoryGroups(),
      sharedSubcategories: this.sharedSubcategories(),
      savingsCategories: this.savingsCategoryGroups(),
      settings: {
        monthlyBudget: this.budget(),
        targetSavingsGoal: this.targetSavingsGoal(),
        savingsPlan: {
          salary: this.savingsPlanSalary(),
          savingsRate: this.savingsPlanSavingsRate(),
          investment: this.savingsPlanInvestment(),
          bills: this.savingsPlanBills(),
        },
      },
    } : this.transactions());
    void fetch(this.apiUrl, {
      method: isGoogleSheets ? 'POST' : 'PUT',
      headers: { 'Content-Type': isGoogleSheets ? 'text/plain;charset=utf-8' : 'application/json' },
      body: payload,
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json().catch(() => ({}));
      })
      .then(() => {
        this.syncInProgress = false;
        if (this.syncQueued) {
          this.syncQueued = false;
          this.executeSyncToApi();
        } else {
          this.syncPending.set(false);
        }
      })
      .catch((error) => {
        console.error('Failed to sync with API:', error);
        this.syncInProgress = false;
        this.syncPending.set(false);
        this.syncError.set(true);
        if (this.syncQueued) {
          this.syncQueued = false;
        }
      });
  }
  private persistExpectedBills(): void { try { localStorage.setItem('ledger-expected-bills', JSON.stringify(this.expectedBills())); } catch {} }
  private persistSharedSubcategories(): void { try { localStorage.setItem('ledger-shared-subcategories', JSON.stringify(this.sharedSubcategories())); } catch {} }
  private emptyTransaction(): NewTransaction { return { date: new Date().toISOString().slice(0, 10), description: '', category: 'Food', subcategory: 'Groceries', type: 'Expense', amount: null, savings: false }; }
  private emptySavingsTransaction(): NewTransaction {
    const firstCategory = this.savingsCategoryGroups()[0]?.name ?? 'Emergency Fund';
    let lastAccount = '';
    try {
      lastAccount = localStorage.getItem('ledger-last-savings-account') || '';
    } catch {}
    return { date: new Date().toISOString().slice(0, 10), description: '', category: firstCategory, subcategory: '', type: 'Income', amount: null, fundType: 'Contribution', account: lastAccount };
  }
}

import { Injectable, computed, signal } from '@angular/core';
import * as XLSX from 'xlsx';

export type TransactionType = 'Income' | 'Expense';

export interface Transaction {
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

export interface NewTransaction {
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

export interface SavingsMonthlySummary {
  month: string;
  contributions: number;
  withdrawals: number;
  netSavings: number;
  runningBalance: number;
}

export interface CategoryGroup {
  name: string;
  subcategories: string[];
}

export interface ExpectedBill {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  amount: number;
  active: boolean;
}

export interface SubcategoryTrend {
  name: string;
  total: number;
  points: number[];
}

export interface SavingsPlanAllocation {
  name: string;
  paycheckOne: number;
  paycheckTwo: number;
  monthly: number;
}

export interface SavingsPlanBucket {
  name: string;
  perPayday: number;
  monthly: number;
  purpose: string;
}

export interface SavingsPlanBill {
  id: number;
  name: string;
  monthly: number;
  paycheckOne: number;
  paycheckTwo: number;
}

export interface SavingsPlanRoadmap {
  milestone: string;
  target: number;
  monthlyContribution: number;
  estimatedMonths: number;
}

export interface SavingsTrendPoint {
  month: string;
  amount: number;
  height: number;
}

export interface CloudData {
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

@Injectable({
  providedIn: 'root',
})
export class LedgerService {
  private readonly builtInCategories = new Set(['Housing', 'Food', 'Transport', 'Lifestyle', 'Bills', 'Expected Bills', 'Health']);
  private readonly builtInCategorySubcategories = new Map([
    ['Housing', ['Rent', 'Utilities', 'Repairs']],
    ['Food', ['Groceries', 'Restaurants', 'Coffee']],
    ['Transport', ['Commute', 'Fuel', 'Parking']],
    ['Lifestyle', ['Entertainment', 'Shopping', 'Subscriptions']],
    ['Bills', ['Phone', 'Internet', 'Insurance', 'Electricity', 'Water', 'Utilities']],
    ['Expected Bills', ['Rent', 'Condo', 'Globe', 'Internet', 'Electricity', 'Water', 'Utilities', 'Parking', 'Groceries', 'Insurance', 'Phone']],
    ['Health', ['Medicine', 'Appointments', 'Fitness']],
  ]);
  private readonly builtInSavingsCategories = new Set(['Emergency Fund', 'General Savings', 'Investment Fund', 'Travel Fund', 'Other']);
  private readonly categoryColorSeed = Math.random() * 360;

  private readonly googleSheetsUrl = 'https://script.google.com/macros/s/REDACTED-DEPLOYMENT-ID/exec?token=REDACTED-ROTATED-TOKEN';
  private readonly apiUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000/api/transactions'
    : this.googleSheetsUrl;
  public readonly isHosted = this.apiUrl === this.googleSheetsUrl;

  public readonly selectedMonth = signal('2026-09');
  public readonly transactions = signal<Transaction[]>([]);
  public readonly cloudDataReady = signal(!this.isHosted);
  public readonly cloudDataError = signal(false);
  public readonly syncPending = signal(false);
  public readonly syncError = signal(false);

  public readonly categoryGroups = signal<CategoryGroup[]>([
    { name: 'Housing', subcategories: ['Rent', 'Utilities', 'Repairs'] },
    { name: 'Food', subcategories: ['Groceries', 'Restaurants', 'Coffee'] },
    { name: 'Transport', subcategories: ['Commute', 'Fuel', 'Parking'] },
    { name: 'Lifestyle', subcategories: ['Entertainment', 'Shopping', 'Subscriptions'] },
    { name: 'Bills', subcategories: ['Phone', 'Internet', 'Insurance', 'Electricity', 'Water', 'Utilities'] },
    { name: 'Expected Bills', subcategories: ['Rent', 'Condo', 'Globe', 'Internet', 'Electricity', 'Water', 'Utilities', 'Parking', 'Groceries', 'Insurance', 'Phone'] },
    { name: 'Health', subcategories: ['Medicine', 'Appointments', 'Fitness'] },
  ]);
  public readonly sharedSubcategories = signal<string[]>([]);
  public readonly savingsCategoryGroups = signal<CategoryGroup[]>([
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

  public readonly savingsPlanSalary = signal(192000);
  public readonly savingsPlanSavingsRate = signal(40);
  public readonly savingsPlanInvestment = signal(18200);
  public readonly savingsPlanBills = signal<SavingsPlanBill[]>(this.defaultSavingsPlanBills);

  public readonly expectedBills = signal<ExpectedBill[]>([]);
  public readonly categorySearch = signal('');

  public get categories(): string[] { return this.categoryGroups().map((group) => group.name); }
  public get savingsCategories(): string[] { return this.savingsCategoryGroups().map((group) => group.name); }

  public readonly regularTransactions = computed(() => this.transactions().filter((item) => !item.savings));
  public readonly savingsTransactions = computed(() => this.transactions().filter((item) => item.savings));

  public readonly monthOptions = computed(() =>
    [...new Set(this.transactions().map((item) => this.getTransactionMonth(item.date)).filter(Boolean))].sort().reverse()
  );
  public readonly monthLabel = computed(() => this.formatMonth(this.selectedMonth()));

  public readonly selectedTransactions = computed(() =>
    this.regularTransactions().filter((item) => this.matchesMonth(item.date, this.selectedMonth()))
  );

  public readonly activeExpectedBills = computed(() => this.expectedBills().filter((bill) => bill.active));
  public readonly billTracking = computed(() => this.activeExpectedBills().map((bill) => {
    const spent = this.selectedTransactions()
      .filter((item) => item.type === 'Expense' && item.category === bill.category && item.subcategory === bill.subcategory)
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...bill, spent, remaining: bill.amount - spent, overspent: spent > bill.amount };
  }));
  public readonly billsExpectedTotal = computed(() => this.billTracking().reduce((sum, bill) => sum + bill.amount, 0));
  public readonly billsSpentTotal = computed(() => this.billTracking().reduce((sum, bill) => sum + bill.spent, 0));
  public readonly billsOverspentCount = computed(() => this.billTracking().filter((bill) => bill.overspent).length);

  public readonly totalSpent = computed(() =>
    this.selectedTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0)
  );
  public readonly regularExpenseCount = computed(() =>
    this.selectedTransactions().filter((item) => item.type === 'Expense').length
  );
  public readonly monthlyExpenses = computed(() =>
    this.selectedTransactions().filter((item) => item.type === 'Expense' && !item.savings).reduce((sum, item) => sum + item.amount, 0)
  );

  public readonly monthlySavingsContributions = computed(() =>
    this.savingsTransactions()
      .filter((item) => this.isSavingsContribution(item) && this.matchesMonth(item.date, this.selectedMonth()))
      .reduce((sum, item) => sum + item.amount, 0)
  );
  public readonly monthlySavingsWithdrawals = computed(() =>
    this.savingsTransactions()
      .filter((item) => this.isSavingsWithdrawal(item) && this.matchesMonth(item.date, this.selectedMonth()))
      .reduce((sum, item) => sum + item.amount, 0)
  );
  public readonly monthlyNetSavings = computed(() =>
    this.monthlySavingsContributions() - this.monthlySavingsWithdrawals()
  );
  public readonly monthlySavingsSubtitle = computed(() => {
    const withdrawals = this.monthlySavingsWithdrawals();
    const contributions = this.monthlySavingsContributions();
    if (withdrawals > 0 && contributions > 0) {
      return `Net saved in ${this.monthLabel()} (+₱${Math.round(contributions).toLocaleString('en-US')} · −₱${Math.round(withdrawals).toLocaleString('en-US')})`;
    }
    if (withdrawals > 0 && contributions === 0) {
      return `Net withdrawal in ${this.monthLabel()} (−₱${Math.round(withdrawals).toLocaleString('en-US')})`;
    }
    return `Savings contributed in ${this.monthLabel()}`;
  });
  public readonly monthlySavingsReportSubtitle = computed(() => {
    const withdrawals = this.monthlySavingsWithdrawals();
    const contributions = this.monthlySavingsContributions();
    if (withdrawals > 0 && contributions > 0) {
      return `Net saved (+₱${Math.round(contributions).toLocaleString('en-US')} · −₱${Math.round(withdrawals).toLocaleString('en-US')})`;
    }
    if (withdrawals > 0 && contributions === 0) {
      return `Net withdrawal (−₱${Math.round(withdrawals).toLocaleString('en-US')})`;
    }
    return `Saved in ${this.monthLabel()}`;
  });
  public readonly monthlySavingsSubtext = computed(() => {
    const withdrawals = this.monthlySavingsWithdrawals();
    const contributions = this.monthlySavingsContributions();
    if (contributions === 0 && withdrawals === 0) {
      return `No activity in ${this.monthLabel()}`;
    }
    if (withdrawals > 0 && contributions > 0) {
      return `+₱${Math.round(contributions).toLocaleString('en-US')} in · −₱${Math.round(withdrawals).toLocaleString('en-US')} out this month`;
    }
    if (withdrawals > 0 && contributions === 0) {
      return `−₱${Math.round(withdrawals).toLocaleString('en-US')} withdrawn in ${this.monthLabel()}`;
    }
    return `+₱${Math.round(contributions).toLocaleString('en-US')} saved in ${this.monthLabel()}`;
  });

  public readonly budgetCategories = computed(() => this.categories
    .filter((cat) => cat !== 'Expected Bills')
    .map((category) => ({ category, total: this.categoryTotal(category) }))
    .filter((item) => item.total > 0)
    .sort((first, second) => second.total - first.total));

  public readonly reportCategories = computed(() => this.categories
    .filter((cat) => cat !== 'Expected Bills')
    .map((category) => ({ category, total: this.categoryTotal(category) }))
    .filter((item) => item.total > 0)
    .sort((first, second) => second.total - first.total));

  public readonly reportTransactions = computed(() => this.selectedTransactions().filter((item) => !item.savings));
  public readonly reportTotalSpent = computed(() =>
    this.reportTransactions().filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0)
  );
  public readonly reportExpenseCount = computed(() =>
    this.reportTransactions().filter((item) => item.type === 'Expense').length
  );

  public readonly targetSavingsGoal = signal(this.getInitialTargetSavings());
  public readonly targetSavingsProgress = computed(() => {
    const goal = this.targetSavingsGoal();
    if (goal <= 0) return this.savingsBalance() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.savingsBalance() / goal) * 100));
  });

  public readonly savingsBalance = computed(() =>
    this.savingsTransactions().reduce((sum, item) => {
      if (this.isSavingsContribution(item)) return sum + item.amount;
      if (this.isSavingsWithdrawal(item)) return sum - item.amount;
      return sum;
    }, 0)
  );

  public readonly savingsGoalProgress = computed(() => {
    const goal = this.targetSavingsGoal();
    if (goal <= 0) return this.savingsBalance() > 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (this.savingsBalance() / goal) * 100));
  });

  public readonly amountRemaining = computed(() => Math.max(0, this.targetSavingsGoal() - this.savingsBalance()));

  public readonly savingsSummary = computed<SavingsMonthlySummary[]>(() => {
    const months = [...new Set(this.savingsTransactions().map((item) => this.getTransactionMonth(item.date)).filter(Boolean))].sort();
    let runningBalance = 0;
    return months.map((month) => {
      const monthTransactions = this.savingsTransactions().filter((item) => this.matchesMonth(item.date, month));
      const contributions = monthTransactions.filter((item) => this.isSavingsContribution(item)).reduce((sum, item) => sum + item.amount, 0);
      const withdrawals = monthTransactions.filter((item) => this.isSavingsWithdrawal(item)).reduce((sum, item) => sum + item.amount, 0);
      const netSavings = contributions - withdrawals;
      runningBalance += netSavings;
      return { month, contributions, withdrawals, netSavings, runningBalance };
    }).reverse();
  });

  public readonly currentSavingsSummary = computed(() => {
    const found = this.savingsSummary().find((item) => item.month === this.selectedMonth());
    if (found) return found;
    const runningBalance = this.savingsTransactions()
      .filter((item) => this.isBeforeOrSameMonth(item.date, this.selectedMonth()))
      .reduce((sum, item) => {
        if (this.isSavingsContribution(item)) return sum + item.amount;
        if (this.isSavingsWithdrawal(item)) return sum - item.amount;
        return sum;
      }, 0);
    return {
      month: this.selectedMonth(),
      contributions: 0,
      withdrawals: 0,
      netSavings: 0,
      runningBalance,
    };
  });

  public readonly monthlyContribution = computed(() => this.currentSavingsSummary().contributions);
  public readonly effectiveMonthlySavings = computed(() => {
    const net = this.monthlyNetSavings();
    return net > 0 ? net : this.monthlySavingsContributions();
  });

  public readonly targetDate = computed(() => {
    if (this.amountRemaining() === 0) return 'Goal reached';
    const rate = this.effectiveMonthlySavings();
    if (rate <= 0) return 'Add monthly savings';
    const target = new Date();
    target.setMonth(target.getMonth() + Math.ceil(this.amountRemaining() / rate));
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(target);
  });

  public readonly recentSavingsTransactions = computed(() => this.transactions()
    .filter((item) => item.savings)
    .slice(0, 5));

  public readonly savingsBalances = computed(() => [
    { name: 'Target savings', amount: Math.min(Math.max(this.savingsBalance(), 0), this.targetSavingsGoal()) },
    { name: 'Additional savings', amount: Math.max(this.savingsBalance() - this.targetSavingsGoal(), 0) },
  ]);

  public readonly savingsTrendData = computed<SavingsTrendPoint[]>(() => {
    const months = this.monthOptions().slice(0, 6).reverse();
    const amounts = months.map((month) => this.savingsTransactions()
      .filter((item) => this.matchesMonth(item.date, month))
      .reduce((sum, item) => {
        if (this.isSavingsContribution(item)) return sum + item.amount;
        if (this.isSavingsWithdrawal(item)) return sum - item.amount;
        return sum;
      }, 0));
    const maximum = Math.max(...amounts, 1);
    return months.map((month, index) => ({
      month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
      amount: amounts[index],
      height: amounts[index] > 0 ? Math.max(8, (amounts[index] / maximum) * 100) : 4,
    }));
  });

  public readonly trendData = computed(() => this.monthOptions().slice(0, 6).reverse().map((month) => ({
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
    amount: this.transactions().filter((item) => item.type === 'Expense' && !item.savings && this.matchesMonth(item.date, month)).reduce((sum, item) => sum + item.amount, 0),
  })));

  public readonly subcategoryTrends = computed<SubcategoryTrend[]>(() => {
    const months = this.monthOptions().slice(0, 6).reverse();
    const totals = new Map<string, number[]>();
    this.transactions().filter((item) => item.type === 'Expense' && !item.savings && item.subcategory).forEach((item) => {
      const points = totals.get(item.subcategory) ?? months.map(() => 0);
      const month = this.getTransactionMonth(item.date);
      const monthIndex = months.indexOf(month);
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

  public readonly filteredCategories = computed(() => this.filterCategoryGroups(this.categoryGroups()));
  public readonly filteredSavingsCategories = computed(() => this.filterCategoryGroups(this.savingsCategoryGroups()));

  public readonly savingsPlanFixedNeeds = computed(() =>
    this.savingsPlanBills().reduce((sum, bill) => sum + bill.monthly, 0)
  );
  public readonly savingsPlanGoal = computed(() =>
    Math.round(this.savingsPlanSalary() * (this.savingsPlanSavingsRate() / 100))
  );
  public readonly savingsPlanEmergencyReserve = computed(() =>
    Math.max(0, this.savingsPlanGoal() - this.savingsPlanInvestment())
  );
  public readonly savingsPlanAvailableAfterFixed = computed(() =>
    this.savingsPlanSalary() - this.savingsPlanFixedNeeds()
  );
  public readonly savingsPlanVariableAllowance = computed(() =>
    this.savingsPlanSalary() - this.savingsPlanFixedNeeds() - this.savingsPlanGoal()
  );
  public readonly savingsPlanSpendingCap = computed(() =>
    this.savingsPlanFixedNeeds() + this.savingsPlanVariableAllowance()
  );

  public readonly savingsPlan = computed(() => ({
    salary: this.savingsPlanSalary(),
    fixedNeeds: this.savingsPlanFixedNeeds(),
    availableAfterFixedNeeds: this.savingsPlanAvailableAfterFixed(),
    savingsGoal: this.savingsPlanGoal(),
    spendingCap: this.savingsPlanSpendingCap(),
    variableAllowance: this.savingsPlanVariableAllowance(),
    threeMonthFund: this.savingsPlanFixedNeeds() * 3,
    sixMonthFund: this.savingsPlanFixedNeeds() * 6,
  }));

  public readonly savingsPlanAllocations = computed<SavingsPlanAllocation[]>(() => {
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

  public readonly savingsPlanBuckets = computed<SavingsPlanBucket[]>(() => {
    const investment = this.savingsPlanInvestment();
    const emergency = this.savingsPlanEmergencyReserve();
    const total = this.savingsPlanGoal();
    return [
      { name: 'Minimum Investment', perPayday: investment / 2, monthly: investment, purpose: 'Build long-term income-replacement assets.' },
      { name: 'Emergency Fund', perPayday: emergency / 2, monthly: emergency, purpose: 'Build the 3-6 month safety net first.' },
      { name: 'Total Savings', perPayday: total / 2, monthly: total, purpose: 'Automatic transfer immediately after payday.' },
    ];
  });

  public readonly savingsPlanRoadmap = computed<SavingsPlanRoadmap[]>(() => {
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

  public getTransactionMonth(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return dateStr.slice(0, 7);
  }

  public matchesMonth(dateStr: string, targetMonth: string): boolean {
    if (!dateStr || !targetMonth) return false;
    return this.getTransactionMonth(dateStr) === targetMonth;
  }

  public isBeforeOrSameMonth(dateStr: string, targetMonth: string): boolean {
    const month = this.getTransactionMonth(dateStr);
    return !!month && month <= targetMonth;
  }

  public isSavingsContribution(item: Transaction): boolean {
    if (!item.savings) return false;
    const fundType = String(item.fundType || '').toLowerCase();
    if (fundType === 'contribution') return true;
    if (fundType === 'withdrawal') return false;
    return item.type === 'Income';
  }

  public isSavingsWithdrawal(item: Transaction): boolean {
    if (!item.savings) return false;
    const fundType = String(item.fundType || '').toLowerCase();
    if (fundType === 'withdrawal') return true;
    if (fundType === 'contribution') return false;
    return item.type === 'Expense';
  }

  public formatMonth(month: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  }

  public selectMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  public categoryTotal(category: string): number {
    return this.selectedTransactions().filter((item) => item.category === category && item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0);
  }

  public categoryColor(index: number): string {
    const hue = (this.categoryColorSeed + (index * 137.508)) % 360;
    return `hsl(${hue} 65% 45%)`;
  }

  public subcategoriesFor(category: string): string[] {
    const expectedBillsGroup = this.categoryGroups().find((group) => group.name === 'Expected Bills');
    const expectedBillsSubcategories = expectedBillsGroup?.subcategories ?? [];
    
    const usedInExpectedBillsTransactions = this.transactions()
      .filter((t) => t.category === 'Expected Bills' && t.subcategory)
      .map((t) => t.subcategory);
      
    const usedInExpectedBillsBills = this.expectedBills()
      .filter((b) => b.category === 'Expected Bills' && b.subcategory)
      .map((b) => b.subcategory);

    const allExpectedBillsSubcategories = new Set([
      ...expectedBillsSubcategories,
      ...usedInExpectedBillsTransactions,
      ...usedInExpectedBillsBills
    ]);

    if (category === 'Expected Bills') {
      return [...allExpectedBillsSubcategories].filter(Boolean).sort();
    }

    const allOtherGroupsSubcategories = this.categoryGroups()
      .filter((g) => g.name !== 'Expected Bills')
      .flatMap((g) => g.subcategories);
      
    const allOtherUsedInTransactions = this.transactions()
      .filter((t) => t.category !== 'Expected Bills' && t.subcategory)
      .map((t) => t.subcategory);
      
    const allOtherUsedInBills = this.expectedBills()
      .filter((b) => b.category !== 'Expected Bills' && b.subcategory)
      .map((b) => b.subcategory);

    const allOtherSubcategories = new Set([
      ...allOtherGroupsSubcategories,
      ...allOtherUsedInTransactions,
      ...allOtherUsedInBills,
      ...this.sharedSubcategories(),
    ]);

    return [...allOtherSubcategories].filter((sub) => sub && !allExpectedBillsSubcategories.has(sub)).sort();
  }

  public savingsSubcategoriesFor(category: string): string[] {
    const allSavingsGroupsSubcategories = this.savingsCategoryGroups()
      .flatMap((g) => g.subcategories);
      
    const allSavingsUsedInTransactions = this.transactions()
      .filter((t) => t.savings && t.subcategory)
      .map((t) => t.subcategory);

    const allSavingsSubcategories = new Set([
      ...allSavingsGroupsSubcategories,
      ...allSavingsUsedInTransactions,
    ]);

    return [...allSavingsSubcategories].filter(Boolean).sort();
  }

  public addTransaction(entry: Partial<NewTransaction>): void {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const category = entry.category || (entry.savings ? (this.savingsCategories[0] || 'Emergency Fund') : (this.categories[0] || 'Food'));
    const description = entry.description?.trim() || entry.subcategory || category;
    const date = entry.date || new Date().toISOString().slice(0, 10);
    const savings = entry.savings ?? false;
    const fundType = savings ? (entry.type === 'Expense' ? 'Withdrawal' : 'Contribution') : undefined;
    const type = savings ? (entry.type || 'Income') : 'Expense';

    if (entry.account?.trim()) {
      try { localStorage.setItem('ledger-last-savings-account', entry.account.trim()); } catch {}
    }

    this.transactions.update((items) => [{
      id: Date.now(),
      date,
      description,
      category,
      subcategory: entry.subcategory || '',
      type,
      amount,
      savings,
      fundType,
      account: entry.account?.trim() || '',
    }, ...items]);
    this.persist();
    this.syncToApi();
  }

  public removeTransaction(id: number): void {
    this.transactions.update((items) => items.filter((item) => item.id !== id));
    this.persist();
    if (this.apiUrl) void fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => undefined);
  }

  public updateExpense(id: number, expense: Partial<NewTransaction>): void {
    if (!expense.description?.trim() || !expense.date || !expense.category || !expense.amount || Number(expense.amount) <= 0) return;
    this.transactions.update((items) => items.map((item) => item.id === id ? {
      ...item,
      date: expense.date!,
      description: expense.description!.trim(),
      category: expense.category!,
      subcategory: expense.subcategory || '',
      amount: Number(expense.amount),
    } : item));
    this.persist();
    this.syncToApi();
  }

  public addCategory(name: string, subcategory: string): void {
    const categoryName = name.trim();
    const subcategoryName = subcategory.trim();
    if (!categoryName || this.categories.some((category) => category.toLowerCase() === categoryName.toLowerCase())) return;
    this.categoryGroups.update((groups) => [...groups, { name: categoryName, subcategories: subcategoryName ? [subcategoryName] : [] }]);
    this.persistCategories();
    this.syncToApi();
  }

  public addExpenseSubcategory(category: string, subcategory: string): void {
    const subcategoryName = subcategory.trim();
    if (!subcategoryName) return;
    if (!category || category === '__ALL__') {
      if (!this.sharedSubcategories().some((item) => item.toLowerCase() === subcategoryName.toLowerCase())) {
        this.sharedSubcategories.update((items) => [...items, subcategoryName]);
        this.persistSharedSubcategories();
      }
      this.categoryGroups.update((groups) => groups.map((group) => {
        if (group.name === 'Expected Bills') return group;
        return group.subcategories.some((item) => item.toLowerCase() === subcategoryName.toLowerCase())
          ? group
          : { ...group, subcategories: [...group.subcategories, subcategoryName] };
      }));
    } else {
      this.categoryGroups.update((groups) => groups.map((group) =>
        group.name === category && !group.subcategories.some((item) => item.toLowerCase() === subcategoryName.toLowerCase())
          ? { ...group, subcategories: [...group.subcategories, subcategoryName] }
          : group
      ));
    }
    this.persistCategories();
    this.syncToApi();
  }

  public addSubcategory(subcategory: string): void {
    this.addExpenseSubcategory('__ALL__', subcategory);
  }

  public addSavingsCategory(name: string, subcategory: string): void {
    const categoryName = name.trim();
    const subcategoryName = subcategory.trim();
    if (!categoryName || this.savingsCategories.some((category) => category.toLowerCase() === categoryName.toLowerCase())) return;
    this.savingsCategoryGroups.update((groups) => [...groups, { name: categoryName, subcategories: subcategoryName ? [subcategoryName] : [] }]);
    this.persistSavingsCategories();
    this.syncToApi();
  }

  public addSavingsSubcategory(category: string, subcategory: string): void {
    const subcategoryName = subcategory.trim();
    if (!category || !subcategoryName) return;
    this.savingsCategoryGroups.update((groups) => groups.map((group) => group.name === category && !group.subcategories.some((item) => item.toLowerCase() === subcategoryName.toLowerCase()) ? { ...group, subcategories: [...group.subcategories, subcategoryName] } : group));
    this.persistSavingsCategories();
    this.syncToApi();
  }

  public isUserCategory(name: string, savings: boolean): boolean {
    return !(savings ? this.builtInSavingsCategories : this.builtInCategories).has(name);
  }

  public isUserSubcategory(category: string, subcategory: string, savings: boolean): boolean {
    if (savings) return this.isUserCategory(category, true);
    return !(this.builtInCategorySubcategories.get(category) ?? []).includes(subcategory);
  }

  public editCategory(name: string, savings: boolean): void {
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

  public editSubcategory(category: string, subcategory: string, savings: boolean): void {
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

  public deleteCategory(name: string, savings: boolean): void {
    if (!window.confirm(`Are you sure you want to delete the category "${name}"?`)) return;
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

  public deleteSubcategory(category: string, subcategory: string, savings: boolean): void {
    if (!window.confirm(`Are you sure you want to delete the sub-category "${subcategory}" from "${category}"?`)) return;
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

  public addExpectedBill(bill: { name: string; category: string; subcategory: string; amount: number }): void {
    const name = bill.name.trim();
    const amount = Number(bill.amount);
    if (!name || !bill.category || !bill.subcategory || !Number.isFinite(amount) || amount <= 0) return;
    this.expectedBills.update((bills) => [...bills, {
      id: Date.now(), name, category: bill.category, subcategory: bill.subcategory, amount, active: true,
    }]);
    this.persistExpectedBills();
    this.syncToApi();
  }

  public removeExpectedBill(id: number): void {
    if (!window.confirm('Are you sure you want to remove this expected bill?')) return;
    this.expectedBills.update((bills) => bills.filter((bill) => bill.id !== id));
    this.persistExpectedBills();
    this.syncToApi();
  }

  public updateExpectedBill(id: number, bill: Partial<ExpectedBill>): void {
    const amount = Number(bill.amount);
    if (!bill.name?.trim() || !bill.category || !bill.subcategory || !Number.isFinite(amount) || amount <= 0) return;
    this.expectedBills.update((items) => items.map((item) => item.id === id ? {
      ...item,
      name: bill.name!.trim(),
      category: bill.category!,
      subcategory: bill.subcategory!,
      amount,
    } : item));
    this.persistExpectedBills();
    this.syncToApi();
  }

  public billProgress(spent: number, amount: number): number {
    return Math.min(100, (spent / amount) * 100);
  }

  public billStatus(spent: number, amount: number, overspent: boolean): string {
    const difference = Math.abs(amount - spent).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
    return overspent ? `Overspending by ${difference}` : `${difference} remaining`;
  }

  public updateTargetSavingsGoal(amount: number): void {
    if (!Number.isNaN(amount) && amount >= 0) {
      this.targetSavingsGoal.set(amount);
      try { localStorage.setItem('ledger-target-savings', String(amount)); } catch {}
      this.syncToApi();
    }
  }

  public updateSavingsPlanSalary(value: string | number | null): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingsPlanSalary.set(amount);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public updateSavingsPlanRate(value: string | number | null): void {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
    this.savingsPlanSavingsRate.set(rate);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public updateSavingsPlanInvestment(value: string | number | null): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    this.savingsPlanInvestment.set(amount);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public resetSavingsPlanToDefaults(): void {
    this.savingsPlanSalary.set(192000);
    this.savingsPlanSavingsRate.set(40);
    this.savingsPlanInvestment.set(18200);
    this.savingsPlanBills.set(this.defaultSavingsPlanBills);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public updateSavingsPlanBill(id: number, bill: { name: string; monthly: number }): void {
    const monthly = Number(bill.monthly);
    if (!bill.name.trim() || !Number.isFinite(monthly) || monthly < 0) return;
    this.savingsPlanBills.update((bills) => bills.map((b) => b.id === id ? {
      ...b,
      name: bill.name.trim(),
      monthly,
      paycheckOne: monthly / 2,
      paycheckTwo: monthly / 2,
    } : b));
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public removeSavingsPlanBill(id: number): void {
    if (!window.confirm('Are you sure you want to remove this fixed need?')) return;
    this.savingsPlanBills.update((bills) => bills.filter((b) => b.id !== id));
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public addSavingsPlanBill(bill: { name: string; monthly: number }): void {
    const name = bill.name.trim();
    const monthly = Number(bill.monthly);
    if (!name || !Number.isFinite(monthly) || monthly <= 0) return;
    const newBill: SavingsPlanBill = {
      id: Date.now(),
      name,
      monthly,
      paycheckOne: monthly / 2,
      paycheckTwo: monthly / 2,
    };
    this.savingsPlanBills.update((bills) => [...bills, newBill]);
    this.persistSavingsPlan();
    this.syncToApi();
  }

  public importWorkbook(event: Event): void {
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

  public exportWorkbook(): void {
    const rows = this.transactions().map(({ id, ...item }) => ({ Date: item.date, Description: item.description, Category: item.category, Subcategory: item.subcategory, Type: item.type, Amount: item.amount }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
    XLSX.writeFile(workbook, 'ledger-transactions.xlsx');
  }

  public retryCloudData(): void {
    this.cloudDataError.set(false);
    this.syncError.set(false);
    if (!this.cloudDataReady()) {
      this.cloudDataReady.set(false);
      this.loadFromApi();
    } else {
      this.syncToApi();
    }
  }

  public emptyTransaction(): NewTransaction {
    return {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      category: 'Food',
      subcategory: 'Groceries',
      type: 'Expense',
      amount: null,
      savings: false,
    };
  }

  public emptySavingsTransaction(): NewTransaction {
    const firstCategory = this.savingsCategoryGroups()[0]?.name ?? 'Emergency Fund';
    let lastAccount = '';
    try {
      lastAccount = localStorage.getItem('ledger-last-savings-account') || '';
    } catch {}
    return {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      category: firstCategory,
      subcategory: '',
      type: 'Income',
      amount: null,
      fundType: 'Contribution',
      account: lastAccount,
      savings: true,
    };
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

  private ensureExpectedBillsCategory(): void {
    const defaultExpectedBills = [
      'Rent', 'Condo', 'Globe', 'Internet', 'Electricity', 'Water', 'Utilities', 'Parking', 'Groceries', 'Insurance', 'Phone'
    ];
    const usedInBills = this.expectedBills()
      .filter((b) => b.category === 'Expected Bills' && b.subcategory)
      .map((b) => b.subcategory);
    const usedInTransactions = this.transactions()
      .filter((t) => t.category === 'Expected Bills' && t.subcategory)
      .map((t) => t.subcategory);
    const needed = [...new Set([...defaultExpectedBills, ...usedInBills, ...usedInTransactions])];

    const expectedBillsCategory = this.categoryGroups().find((group) => group.name === 'Expected Bills');
    if (!expectedBillsCategory) {
      this.categoryGroups.update((groups) => [...groups, { name: 'Expected Bills', subcategories: needed }]);
      this.persistCategories();
      this.syncToApi();
      return;
    }
    const subcategories = [...new Set([...expectedBillsCategory.subcategories, ...needed])];
    if (subcategories.length !== expectedBillsCategory.subcategories.length) {
      this.categoryGroups.update((groups) => groups.map((group) => group.name === 'Expected Bills' ? { ...group, subcategories } : group));
      this.persistCategories();
      this.syncToApi();
    }
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

  private persist(): void {
    try {
      localStorage.setItem('ledger-transactions', JSON.stringify(this.transactions()));
    } catch {}
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

  private persistExpectedBills(): void {
    try { localStorage.setItem('ledger-expected-bills', JSON.stringify(this.expectedBills())); } catch {}
  }

  private persistSharedSubcategories(): void {
    try { localStorage.setItem('ledger-shared-subcategories', JSON.stringify(this.sharedSubcategories())); } catch {}
  }

  private loadFromApi(): void {
    if (!this.apiUrl) return;
    const requestUrl = this.isHosted ? `${this.apiUrl}&cacheBust=${Date.now()}` : this.apiUrl;
    void fetch(requestUrl, { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: Transaction[] | CloudData) => {
      const cloudData = Array.isArray(data) ? { transactions: data } : data;
      this.transactions.set(cloudData.transactions);

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
        this.ensureExpectedBillsCategory();
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
}


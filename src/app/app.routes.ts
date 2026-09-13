import { Routes } from '@angular/router';
import { CategoriesComponent } from './pages/categories.component';
import { DashboardComponent } from './pages/dashboard.component';
import { ExpectedBillsComponent } from './pages/expected-bills.component';
import { ReportsComponent } from './pages/reports.component';
import { SavingsComponent } from './pages/savings.component';
import { TransactionsComponent } from './pages/transactions.component';

export const routes: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: 'overview', component: DashboardComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'bills', component: ExpectedBillsComponent },
  { path: 'savings', component: SavingsComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: '**', redirectTo: 'overview' },
];


# BudgetTracker

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Development server

The development build reads `src/environments/environment.development.ts`, which is git-ignored so a personal Cloud Sync URL never gets committed. On a fresh clone, create it from the template first:

```bash
cp src/environments/environment.development.example.ts src/environments/environment.development.ts
```

Leave `googleSheetsUrl` empty to use the local API or browser storage. Then start a local development server:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Local API

The optional Node API in `server.js` stores the ledger in `data/transactions.json`:

```bash
npm run server
```

Run the Angular app and API together with:

```bash
npm run start:all
```

The dashboard uses the API when it is available and keeps a browser-local fallback when it is not. Transactions can be imported from CSV or JSON files and exported as CSV from the dashboard. To bring in an Excel sheet, save or download it as CSV first.

The Node API is optional. For browser-only use, run just:

```bash
npm start
```

Transactions will be saved in this browser. Run `npm run server` only when you want changes automatically written to `data/transactions.json`.

## Use on a phone

The browser-only app works on Android and iPhone. For a shareable address, push this project to GitHub and enable GitHub Pages with **Settings > Pages > Source: GitHub Actions**. The workflow in `.github/workflows/deploy.yml` will publish the app after each push to `main`.

Open the Pages address on your phone, then choose **Add to Home Screen** in Safari or Chrome. The app stores transactions in that phone's browser. GitHub Pages does not run the optional Node API, so use Cloud Sync (below) or the dashboard's CSV export/import when moving data between devices.

## Google Sheets cloud sync

When a Cloud Sync URL is configured (the `GOOGLE_SHEETS_URL` deploy secret, or the URL saved in the dashboard), the app sends the full ledger to a Google Apps Script with `action: 'replace'` and reads it back on every load. The cloud copy wins on load, so the script must persist every transaction field or that field is lost on refresh.

Each transaction has these fields:

| Field | Notes |
| --- | --- |
| `id`, `date`, `description`, `category`, `subcategory` | |
| `type` | `Income` or `Expense` |
| `amount` | number |
| `savings`, `fundType`, `account` | savings entries only |
| `status`, `pending` | `status` is `pending` or `cleared`; `pending` is the same as a boolean. Blank means cleared |

A reference copy of the script (with placeholders for the sheet ID and access token) is in [`docs/apps-script/Code.gs`](docs/apps-script/Code.gs).

If the script has no `status` column, marking a transaction as pending is only remembered on the device that set it. Add a `status` column to the sheet, write `tx.status || (tx.pending ? 'pending' : 'cleared')` when saving, return `status` and `pending: status === 'pending'` when loading, then redeploy the script as a new version (the URL stays the same).

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

# Prompt: make the Google Apps Script store all app data

Paste everything below the line into a new Claude Code session opened in this repo.

---

Continue work on the Ledger app (Angular, this repo). Read `docs/database-migration.md` and `README.md` ("Google Sheets cloud sync") for background.

## Context

- The hosted app (GitHub Pages) syncs to a Google Sheet through a Google Apps Script web app (Cloud Sync URL, built in from the `GOOGLE_SHEETS_URL` secret). A reference copy of the script is in `docs/apps-script/Code.gs` (my `SPREADSHEET_ID` and `ACCESS_TOKEN` are placeholders there). Use it as the base. Keep those two values out of every file, commit and reply. It already has the Status column, automatic column growth, and JSON error replies. To check script changes, run them against a fake spreadsheet (as was done for that file) before giving them to me.
- The app sends `{ action: 'replace', transactions, expectedBills, categories, sharedSubcategories, savingsCategories, settings: { targetSavingsGoal, savingsPlan: { salary, savingsRate, investment } } }` and expects the same shape back from GET (see `CloudData` and `loadFromApi` / `executeSyncToApi` in `src/app/app.ts`).
- The cloud copy wins on load. Uploads are blocked until a load has succeeded (`cloudLoaded`). A tab you return to refreshes quietly, and a waiting save is flushed when the tab is hidden.
- Already done: a `Status` column (pending / cleared) on Transactions, with the app keeping a device's local pending flag when the cloud returns none and pushing it up afterwards. Before starting, ask me to confirm that pending now survives a refresh and shows on a second device.

## The problems to fix

Found by reading the script. Everything the script does not know about is silently dropped, so it only lives in each device's browser:

1. **Savings plan is not stored.** `writeSettings` / `readSettings` keep only flat numbers, but the plan (`salary`, `savingsRate`, `investment`) is an object, so it is dropped. `readSettings` must return `settings.savingsPlan` as an object and `settings.targetSavingsGoal` as a number, as `CloudData` expects.
2. **Shared sub-categories are not stored.** The script has no sheet for `sharedSubcategories` (a `string[]`). Add one (for example a `Shared Subcategories` sheet with one column), write it on `replace`, and return it from `doGet` and from the responses of `replace` / `delete`. This is probably why one sub-category ("Shoppee") appears under every category and can differ between devices.
3. **No lock around saves.** Two devices saving at the same instant can interleave the clear-then-write steps. Wrap `replace` and `delete` in `LockService.getScriptLock()`.

## How to do it

- Update `docs/apps-script/Code.gs` and tell me which lines to copy over (my two constants stay as they are in my editor), plus redeploy steps: Deploy, Manage deployments, pencil, **New version**, so the URL does not change. Remind me to make a copy of the sheet first.
- Make it safe on first load after deploy: when the cloud has no plan or shared sub-categories yet but this device does, keep the local values and push them up right after load (same idea as `restoredPending` in `loadFromApi`). An empty cloud value must never wipe local values.
- Keep the app change small. Do not restructure sync.
- Verify with `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` then `node node_modules/.bin/ng build --output-path <scratchpad>/dist` and `node node_modules/.bin/tsc --noEmit --noUnusedLocals -p tsconfig.app.json` (there is no `npx` on this machine).
- After every change, end with a ready-to-paste commit message in my style (`fix : ...`, short lowercase prefix). Do not run `git commit` unless I ask.

## Also still open (mention, do not start)

- Rotate the script's `ACCESS_TOKEN` and update the `GOOGLE_SHEETS_URL` secret. The token was pasted into a chat earlier and it is embedded in the public JavaScript if the Pages site is public.
- Decide the database question in `docs/database-migration.md` (offline entry needed? public site? more than one user?).

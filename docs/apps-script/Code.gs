/*
 * Ledger cloud sync: Google Apps Script web app.
 *
 * REFERENCE COPY. The two constants below are placeholders; keep YOUR real
 * values in the Apps Script editor and never commit them.
 *
 * Changes in this version:
 *  - Transactions have a Status column ('pending' / 'cleared').
 *  - Missing columns are added automatically (a tab with only 10 columns used
 *    to make every request fail once the Status column was added).
 *  - Errors are returned as JSON ({ error }) instead of a Google error page,
 *    so the app can show the real reason.
 *
 * After any change: Deploy > Manage deployments > pencil > Version: New version.
 */

const SPREADSHEET_ID =
  'PASTE_YOUR_SPREADSHEET_ID';

const ACCESS_TOKEN =
  'PASTE_YOUR_ACCESS_TOKEN';

// ===== Keep your own two values above. Everything below is the code. =====

const TRANSACTIONS_SHEET_NAME = 'Transactions';
const SETTINGS_SHEET_NAME = 'Settings';

// Added: Sheet used to store expected bill definitions.
const EXPECTED_BILLS_SHEET_NAME = 'Expected Bills';

// Added: Sheets used to store regular and savings categories.
const CATEGORIES_SHEET_NAME = 'Categories';
const SAVINGS_CATEGORIES_SHEET_NAME = 'Savings Categories';

const TRANSACTION_HEADERS = [
  'ID',
  'Date',
  'Description',
  'Category',
  'Subcategory',
  'Type',
  'Amount',
  'Savings',
  'Fund Type',
  'Account',
  'Status',
];

// Added: Expected Bills sheet structure.
const EXPECTED_BILL_HEADERS = [
  'ID',
  'Name',
  'Category',
  'Subcategory',
  'Amount',
  'Due Day',
  'Active',
];

// Added: Category sheet structure.
const CATEGORY_HEADERS = [
  'Category',
  'Subcategory',
];

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet() {
  const sheet = getSpreadsheet()
    .getSheetByName(TRANSACTIONS_SHEET_NAME);

  if (!sheet) {
    throw new Error(
      `Missing sheet: ${TRANSACTIONS_SHEET_NAME}`
    );
  }

  return sheet;
}

function getSettingsSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    SETTINGS_SHEET_NAME
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      SETTINGS_SHEET_NAME
    );
  }

  sheet
    .getRange('A1:B1')
    .setValues([['Key', 'Value']]);

  return sheet;
}

// Added: Gets or creates the Expected Bills sheet.
function getExpectedBillsSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    EXPECTED_BILLS_SHEET_NAME
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      EXPECTED_BILLS_SHEET_NAME
    );
  }

  sheet
    .getRange(
      1,
      1,
      1,
      EXPECTED_BILL_HEADERS.length
    )
    .setValues([EXPECTED_BILL_HEADERS]);

  return sheet;
}

// Added: Gets or creates a category sheet.
function getCategorySheet(sheetName) {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet
    .getRange(
      1,
      1,
      1,
      CATEGORY_HEADERS.length
    )
    .setValues([CATEGORY_HEADERS]);

  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function isAuthorized(event) {
  return event &&
    event.parameter &&
    event.parameter.token === ACCESS_TOKEN;
}

// Runs a request handler and turns any exception into a JSON error reply.
function safely(handler) {
  try {
    return handler();
  } catch (error) {
    return jsonResponse({
      error: String((error && error.message) || error),
    });
  }
}

function ensureTransactionHeaders(sheet) {
  // Add columns if the tab is narrower than the headers (e.g. the new Status column).
  const missing =
    TRANSACTION_HEADERS.length - sheet.getMaxColumns();

  if (missing > 0) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      missing
    );
  }

  sheet
    .getRange(
      1,
      1,
      1,
      TRANSACTION_HEADERS.length
    )
    .setValues([TRANSACTION_HEADERS]);
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  return String(value || '');
}

// Blank cell = unknown (old rows), so the app can keep its own pending flag.
function statusFields(value) {
  const status = String(value || '').trim().toLowerCase();

  if (!status) {
    return {};
  }

  return {
    status: status === 'pending' ? 'pending' : 'cleared',
    pending: status === 'pending',
  };
}

/*
 * TRANSACTIONS
 */

// Reads transactions from the Transactions sheet.
function readTransactions() {
  const sheet = getSheet();
  ensureTransactionHeaders(sheet);

  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(
      1,
      1,
      sheet.getLastRow(),
      TRANSACTION_HEADERS.length
    )
    .getValues();

  return values.slice(1).map((row) => Object.assign({
    id: Number(row[0]),
    date: normalizeDate(row[1]),
    description: String(row[2] || ''),
    category: String(row[3] || ''),
    subcategory: String(row[4] || ''),
    type: String(row[5] || 'Expense') === 'Income'
      ? 'Income'
      : 'Expense',
    amount: Number(row[6]) || 0,
    savings:
      row[7] === true ||
      String(row[7]).toLowerCase() === 'true',
    fundType: String(row[8] || ''),
    account: String(row[9] || ''),
  }, statusFields(row[10])));
}

// Replaces all transaction rows in the Transactions sheet.
function writeTransactions(transactions) {
  const sheet = getSheet();
  ensureTransactionHeaders(sheet);

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        TRANSACTION_HEADERS.length
      )
      .clearContent();
  }

  if (!transactions || transactions.length === 0) {
    return;
  }

  const rows = transactions.map((transaction) => [
    Number(transaction.id),
    String(transaction.date || ''),
    String(transaction.description || ''),
    String(transaction.category || ''),
    String(transaction.subcategory || ''),
    transaction.type === 'Income'
      ? 'Income'
      : 'Expense',
    Number(transaction.amount) || 0,
    Boolean(transaction.savings),
    String(transaction.fundType || ''),
    String(transaction.account || ''),
    (transaction.status === 'pending' ||
      transaction.pending === true)
      ? 'pending'
      : 'cleared',
  ]);

  sheet
    .getRange(
      2,
      1,
      rows.length,
      TRANSACTION_HEADERS.length
    )
    .setValues(rows);
}

/*
 * SETTINGS
 */

// Reads monthly budget and savings goal.
function readSettings() {
  const sheet = getSettingsSheet();
  const values = sheet.getDataRange().getValues();
  const settings = {};

  values.slice(1).forEach(([key, value]) => {
    if (!key) {
      return;
    }

    const numberValue = Number(value);

    if (
      !Number.isNaN(numberValue) &&
      numberValue >= 0
    ) {
      settings[String(key)] = numberValue;
    }
  });

  return settings;
}

// Saves monthly budget and savings goal.
function writeSettings(settings) {
  const sheet = getSettingsSheet();

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        2
      )
      .clearContent();
  }

  const rows = Object.entries(settings || {})
    .filter(([, value]) => {
      return (
        typeof value === 'number' &&
        value >= 0
      );
    })
    .map(([key, value]) => [key, value]);

  if (rows.length > 0) {
    sheet
      .getRange(2, 1, rows.length, 2)
      .setValues(rows);
  }
}

/*
 * EXPECTED BILLS
 */

// Reads expected bills from Google Sheets.
function readExpectedBills() {
  const sheet = getExpectedBillsSheet();

  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(
      1,
      1,
      sheet.getLastRow(),
      EXPECTED_BILL_HEADERS.length
    )
    .getValues();

  return values
    .slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: Number(row[0]),
      name: String(row[1] || ''),
      category: String(row[2] || ''),
      subcategory: String(row[3] || ''),
      amount: Number(row[4]) || 0,
      dueDay: Number(row[5]) || 1,
      active:
        row[6] !== false &&
        String(row[6]).toLowerCase() !== 'false',
    }));
}

// Saves expected bills to Google Sheets.
function writeExpectedBills(bills) {
  const sheet = getExpectedBillsSheet();

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        EXPECTED_BILL_HEADERS.length
      )
      .clearContent();
  }

  if (!bills || bills.length === 0) {
    return;
  }

  const rows = bills.map((bill) => [
    Number(bill.id),
    String(bill.name || ''),
    String(bill.category || ''),
    String(bill.subcategory || ''),
    Number(bill.amount) || 0,
    Number(bill.dueDay) || 1,
    bill.active !== false,
  ]);

  sheet
    .getRange(
      2,
      1,
      rows.length,
      EXPECTED_BILL_HEADERS.length
    )
    .setValues(rows);
}

/*
 * CATEGORIES
 */

// Reads category rows and groups subcategories.
function readCategoryGroups(sheetName) {
  const sheet = getCategorySheet(sheetName);

  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(
      1,
      1,
      sheet.getLastRow(),
      CATEGORY_HEADERS.length
    )
    .getValues();

  const groups = new Map();

  values.slice(1).forEach(([category, subcategory]) => {
    const categoryName = String(category || '').trim();
    const subcategoryName = String(subcategory || '').trim();

    if (!categoryName) {
      return;
    }

    if (!groups.has(categoryName)) {
      groups.set(categoryName, []);
    }

    if (
      subcategoryName &&
      !groups.get(categoryName).includes(subcategoryName)
    ) {
      groups.get(categoryName).push(subcategoryName);
    }
  });

  return [...groups.entries()].map(
    ([name, subcategories]) => ({
      name,
      subcategories,
    })
  );
}

// Saves category groups as category/subcategory rows.
function writeCategoryGroups(sheetName, groups) {
  const sheet = getCategorySheet(sheetName);

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        CATEGORY_HEADERS.length
      )
      .clearContent();
  }

  if (!groups || groups.length === 0) {
    return;
  }

  const rows = [];

  groups.forEach((group) => {
    const categoryName = String(
      group.name || ''
    ).trim();

    if (!categoryName) {
      return;
    }

    const subcategories = Array.isArray(
      group.subcategories
    )
      ? group.subcategories
      : [];

    if (subcategories.length === 0) {
      rows.push([categoryName, '']);
      return;
    }

    subcategories.forEach((subcategory) => {
      rows.push([
        categoryName,
        String(subcategory || '').trim(),
      ]);
    });
  });

  if (rows.length > 0) {
    sheet
      .getRange(
        2,
        1,
        rows.length,
        CATEGORY_HEADERS.length
      )
      .setValues(rows);
  }
}

// Reads regular spending categories.
function readCategories() {
  return readCategoryGroups(
    CATEGORIES_SHEET_NAME
  );
}

// Reads savings categories.
function readSavingsCategories() {
  return readCategoryGroups(
    SAVINGS_CATEGORIES_SHEET_NAME
  );
}

// Saves regular spending categories.
function writeCategories(categories) {
  writeCategoryGroups(
    CATEGORIES_SHEET_NAME,
    categories
  );
}

// Saves savings categories.
function writeSavingsCategories(categories) {
  writeCategoryGroups(
    SAVINGS_CATEGORIES_SHEET_NAME,
    categories
  );
}

/*
 * API ENDPOINTS
 */

// Returns all application data from Google Sheets.
function doGet(event) {
  return safely(() => {
    if (!isAuthorized(event)) {
      return jsonResponse({
        error: 'Unauthorized',
      });
    }

    return jsonResponse({
      transactions: readTransactions(),
      settings: readSettings(),
      expectedBills: readExpectedBills(),
      categories: readCategories(),
      savingsCategories: readSavingsCategories(),
    });
  });
}

// Saves all application data to Google Sheets.
function doPost(event) {
  return safely(() => {
    if (!isAuthorized(event)) {
      return jsonResponse({
        error: 'Unauthorized',
      });
    }

    let payload;

    try {
      payload = JSON.parse(event.postData.contents);
    } catch (error) {
      return jsonResponse({
        error: 'Invalid JSON request',
      });
    }

    if (payload.action === 'replace') {
      // Added: Save categories together with the rest
      // of the hosted application data.
      writeTransactions(payload.transactions || []);
      writeSettings(payload.settings || {});
      writeExpectedBills(payload.expectedBills || []);
      writeCategories(payload.categories || []);
      writeSavingsCategories(
        payload.savingsCategories || []
      );

      return jsonResponse({
        success: true,
        transactions: readTransactions(),
        settings: readSettings(),
        expectedBills: readExpectedBills(),
        categories: readCategories(),
        savingsCategories: readSavingsCategories(),
      });
    }

    if (payload.action === 'delete') {
      const id = Number(payload.id);
      const sheet = getSheet();

      ensureTransactionHeaders(sheet);

      if (sheet.getLastRow() > 1) {
        const values = sheet
          .getRange(
            2,
            1,
            sheet.getLastRow() - 1,
            TRANSACTION_HEADERS.length
          )
          .getValues();

        for (let row = values.length - 1; row >= 0; row--) {
          if (Number(values[row][0]) === id) {
            sheet.deleteRow(row + 2);
          }
        }
      }

      return jsonResponse({
        success: true,
        transactions: readTransactions(),
        settings: readSettings(),
        expectedBills: readExpectedBills(),
        categories: readCategories(),
        savingsCategories: readSavingsCategories(),
      });
    }

    return jsonResponse({
      error: 'Unknown action',
    });
  });
}

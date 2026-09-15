const { createServer } = require('node:http');
const { existsSync, mkdirSync } = require('node:fs');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const XLSX = require('xlsx');

const port = 3000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB
const workbookPath = path.join(__dirname, 'data', 'transactions.xlsx');

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:4200',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS'
  });
  response.end(JSON.stringify(body));
}

async function readTransactions() {
  if (!existsSync(workbookPath)) {
    await writeTransactions([]);
    return [];
  }
  const workbook = XLSX.read(await readFile(workbookPath), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
}

async function writeTransactions(transactions) {
  mkdirSync(path.dirname(workbookPath), { recursive: true });
  const sheet = XLSX.utils.json_to_sheet(transactions);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');
  await writeFile(workbookPath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  if (!request.url?.startsWith('/api/transactions')) return send(response, 404, { error: 'Not found' });
  try {
    let transactions = await readTransactions();
    if (request.method === 'GET') return send(response, 200, transactions);
    if (request.method === 'PUT') {
      let body = '';
      let receivedBytes = 0;
      for await (const chunk of request) {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_BYTES) {
          return send(response, 413, { error: 'Payload too large' });
        }
        body += chunk;
      }
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed)) {
        return send(response, 400, { error: 'Expected array of transactions' });
      }
      transactions = parsed;
      await writeTransactions(transactions);
      return send(response, 200, transactions);
    }
    if (request.method === 'DELETE') {
      const id = Number(request.url.split('/').pop());
      if (isNaN(id)) return send(response, 400, { error: 'Invalid transaction ID' });
      await writeTransactions(transactions.filter((item) => Number(item.id) !== id));
      return send(response, 204, {});
    }
    return send(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: 'Could not read or write the workbook' });
  }
});

server.listen(port, () => console.log(`Ledger API running at http://localhost:${port}`));

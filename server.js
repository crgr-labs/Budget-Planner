const { createServer } = require('node:http');
const { existsSync, mkdirSync } = require('node:fs');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const port = 3000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB
const dataFilePath = path.join(__dirname, 'data', 'transactions.json');

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
  if (!existsSync(dataFilePath)) {
    await writeTransactions([]);
    return [];
  }
  const content = await readFile(dataFilePath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTransactions(transactions) {
  mkdirSync(path.dirname(dataFilePath), { recursive: true });
  await writeFile(dataFilePath, JSON.stringify(transactions, null, 2), 'utf-8');
}

// Serializes PUT/DELETE read-modify-write cycles so concurrent requests
// (e.g. two people saving at once) don't clobber each other's writes.
let writeQueue = Promise.resolve();
function enqueueWrite(task) {
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => {});
  return result;
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  if (!request.url?.startsWith('/api/transactions')) return send(response, 404, { error: 'Not found' });
  try {
    if (request.method === 'GET') return send(response, 200, await readTransactions());
    if (request.method === 'PUT') {
      const chunks = [];
      let receivedBytes = 0;
      for await (const chunk of request) {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_BYTES) {
          return send(response, 413, { error: 'Payload too large' });
        }
        chunks.push(chunk);
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (!Array.isArray(parsed)) {
        return send(response, 400, { error: 'Expected array of transactions' });
      }
      const transactions = await enqueueWrite(async () => {
        await writeTransactions(parsed);
        return parsed;
      });
      return send(response, 200, transactions);
    }
    if (request.method === 'DELETE') {
      const id = Number(request.url.split('/').pop());
      if (isNaN(id)) return send(response, 400, { error: 'Invalid transaction ID' });
      await enqueueWrite(async () => {
        const transactions = await readTransactions();
        await writeTransactions(transactions.filter((item) => Number(item.id) !== id));
      });
      return send(response, 204, {});
    }
    return send(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: 'Could not read or write the workbook' });
  }
});

server.listen(port, () => console.log(`Ledger API running at http://localhost:${port}`));

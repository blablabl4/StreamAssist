const { readJson, writeJson } = require('./localJsonStore');

const FILE = 'idempotency.json';

function _load() {
  const db = readJson(FILE, { transactions: {} });
  if (!db.transactions) db.transactions = {};
  return db;
}

function get(txid) {
  if (!txid) return null;
  const db = _load();
  return db.transactions[txid] || null;
}

function set(txid, data) {
  if (!txid) return null;
  const db = _load();
  db.transactions[txid] = { ...data, savedAt: new Date().toISOString() };
  writeJson(FILE, db);
  return db.transactions[txid];
}

module.exports = { get, set };

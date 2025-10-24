const { readJson, writeJson } = require('./localJsonStore');

const FILE = 'state.json';

function _load() {
  const db = readJson(FILE, { users: {} });
  if (!db.users) db.users = {};
  return db;
}

function getState(phone) {
  const db = _load();
  return db.users[phone] || null;
}

function setState(phone, data) {
  const db = _load();
  db.users[phone] = { ...(db.users[phone] || {}), ...data, updatedAt: new Date().toISOString() };
  writeJson(FILE, db);
  return db.users[phone];
}

function clearState(phone) {
  const db = _load();
  delete db.users[phone];
  writeJson(FILE, db);
}

module.exports = { getState, setState, clearState };

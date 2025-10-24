const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = {}) {
  try {
    ensureDir(DATA_DIR);
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(DATA_DIR);
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

module.exports = { DATA_DIR, readJson, writeJson };

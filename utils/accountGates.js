const path = require('path');
const { readJson, writeJson, DATA_DIR } = require('./localJsonStore');
const IPTVAutomationV2 = require('./iptvAutomationV2');
const { checkPaymentUntilPaid, getPaymentStatus, burstCheckPaid } = require('./paghiperClient');
const Idem = require('./idempotencyStore');

// Files
const TESTS_FILE = 'tests.json';
const PAYMENTS_FILE = 'payments.json';

// Helpers
function now() { return Date.now(); }

// Versão via polling na API da PagHiper (sem depender do JSON local)
// options: { transactionId, telefone, pacote=2, anotacoes='', maxAttempts=12, intervalMs=30000 }
async function createOfficialWhenPaidPolling(options) {
  const { transactionId, telefone, pacote = 2, anotacoes = '', maxAttempts = 12, intervalMs = 30000 } = options || {};
  if (!transactionId) return { success: false, error: 'transactionId é obrigatório' };
  if (!telefone) return { success: false, error: 'telefone é obrigatório' };

  // Polling
  const poll = await checkPaymentUntilPaid(transactionId, { maxAttempts, intervalMs });
  if (!poll.paid) {
    // Último status (opcional)
    const last = await getPaymentStatus(transactionId);
    return { success: false, error: 'Pagamento não confirmado no tempo esperado', attempts: poll.attempts, lastStatus: last?.status || null };
  }

  // Criar oficial
  const auto = new IPTVAutomationV2();
  try {
    await auto.init();
    const USER = process.env.IPTV_ADMIN_USER || process.env.IPTV_USER || 'Ziel20';
    const PASS = process.env.IPTV_ADMIN_PASSWORD || process.env.IPTV_PASS || '210309';
    const login = await auto.login(USER, PASS);
    if (!login.success) return { success: false, error: 'Falha no login: ' + login.error };

    const resp = await auto.createUserIptv({ tipo: 'oficial', pacote, telefone: String(telefone), anotacoes });
    return { ...resp, attempts: poll.attempts };
  } finally {
    await auto.close();
  }
}
function days(ms) { return Math.floor(ms / (24 * 60 * 60 * 1000)); }

// Load/Save
function loadTests() { return readJson(TESTS_FILE, { phones: {} }); }
function saveTests(db) { return writeJson(TESTS_FILE, db); }
function loadPayments() { return readJson(PAYMENTS_FILE, { payments: {} }); }
function savePayments(db) { return writeJson(PAYMENTS_FILE, db); }

// Gate: Test account cooldown (1 per 60 days)
function canCreateTest(phone, limitDays = 60) {
  const db = loadTests();
  const rec = db.phones[phone];
  if (!rec) return { allowed: true };
  const diff = now() - rec.last_test_at;
  const left = limitDays - days(diff);
  if (diff >= limitDays * 24 * 60 * 60 * 1000) return { allowed: true };
  return { allowed: false, remainingDays: Math.max(0, left) };
}

function markTestCreated(phone) {
  const db = loadTests();
  db.phones[phone] = { last_test_at: now() };
  saveTests(db);
}

// Payments management (no webhook version)
// We maintain a local payments.json and allow manual update via bot/admin command.
function getPayment(orderId) {
  const db = loadPayments();
  return db.payments[orderId] || null;
}

function markPaymentStatus(orderId, status, extra = {}) {
  const db = loadPayments();
  db.payments[orderId] = {
    orderId,
    status, // 'pending' | 'paid' | 'canceled'
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  savePayments(db);
  return db.payments[orderId];
}

function isPaymentPaid(orderId) {
  const p = getPayment(orderId);
  return !!(p && p.status === 'paid');
}

// High-level flows
async function createTestIfEligible(options) {
  const { telefone, pacote = 2, anotacoes = '' } = options;
  const check = canCreateTest(telefone);
  if (!check.allowed) {
    return { success: false, reason: 'cooldown', remainingDays: check.remainingDays };
  }

  const auto = new IPTVAutomationV2();
  try {
    await auto.init();
    const USER = process.env.IPTV_ADMIN_USER || process.env.IPTV_USER || 'Ziel20';
    const PASS = process.env.IPTV_ADMIN_PASSWORD || process.env.IPTV_PASS || '210309';
    const login = await auto.login(USER, PASS);
    if (!login.success) return { success: false, error: 'Falha no login: ' + login.error };

    const resp = await auto.createUserIptv({ tipo: 'teste', pacote, telefone: String(telefone), anotacoes });
    if (resp.success) {
      markTestCreated(String(telefone));
    }
    return resp;
  } finally {
    await auto.close();
  }
}

async function createOfficialIfPaid(options) {
  const { orderId, telefone, pacote = 2, anotacoes = '' } = options;
  if (!orderId) return { success: false, error: 'orderId é obrigatório' };
  if (!isPaymentPaid(orderId)) return { success: false, error: 'Pagamento não confirmado (status diferente de paid)' };

  const auto = new IPTVAutomationV2();
  try {
    await auto.init();
    const USER = process.env.IPTV_ADMIN_USER || process.env.IPTV_USER || 'Ziel20';
    const PASS = process.env.IPTV_ADMIN_PASSWORD || process.env.IPTV_PASS || '210309';
    const login = await auto.login(USER, PASS);
    if (!login.success) return { success: false, error: 'Falha no login: ' + login.error };

    return await auto.createUserIptv({ tipo: 'oficial', pacote, telefone: String(telefone), anotacoes });
  } finally {
    await auto.close();
  }
}

module.exports = {
  DATA_DIR,
  TESTS_FILE,
  PAYMENTS_FILE,
  canCreateTest,
  markTestCreated,
  getPayment,
  markPaymentStatus,
  isPaymentPaid,
  createTestIfEligible,
  createOfficialIfPaid,
  createOfficialWhenPaidPolling,
};

// Após confirmação do usuário no chat ("sim, paguei"), faça uma checagem rápida em rajada
// options: { transactionId, telefone, pacote=2, anotacoes='' }
async function createOfficialWhenPaidBurst(options) {
  const { transactionId, telefone, pacote = 2, anotacoes = '' } = options || {};
  if (!transactionId) return { success: false, error: 'transactionId é obrigatório' };
  if (!telefone) return { success: false, error: 'telefone é obrigatório' };

  const burst = await burstCheckPaid(transactionId, 5, 3000);
  if (!burst.paid) {
    return { success: false, error: 'Pagamento não confirmado após checagens rápidas', attempts: burst.attempt, lastStatus: burst.lastStatus || null };
  }

  // Marcar txid como pago antes de abrir automação
  Idem.set(transactionId, { ...(Idem.get(transactionId) || {}), status: 'paid' });

  const auto = new IPTVAutomationV2();
  try {
    await auto.init();
    const USER = process.env.IPTV_ADMIN_USER || process.env.IPTV_USER || 'Ziel20';
    const PASS = process.env.IPTV_ADMIN_PASSWORD || process.env.IPTV_PASS || '210309';
    const login = await auto.login(USER, PASS);
    if (!login.success) return { success: false, error: 'Falha no login: ' + login.error };
    const resp = await auto.createUserIptv({ tipo: 'oficial', pacote, telefone: String(telefone), anotacoes });
    return { ...resp, attempts: burst.attempt };
  } finally {
    await auto.close();
  }
}

module.exports.createOfficialWhenPaidBurst = createOfficialWhenPaidBurst;

// Criar oficial diretamente (quando já confirmado 'paid')
async function createOfficialDirect({ telefone, pacote = 2, anotacoes = '' }) {
  if (!telefone) return { success: false, error: 'telefone é obrigatório' };

  const auto = new IPTVAutomationV2();
  try {
    await auto.init();
    const USER = process.env.IPTV_ADMIN_USER || process.env.IPTV_USER || 'Ziel20';
    const PASS = process.env.IPTV_ADMIN_PASSWORD || process.env.IPTV_PASS || '210309';
    const login = await auto.login(USER, PASS);
    if (!login.success) return { success: false, error: 'Falha no login: ' + login.error };
    return await auto.createUserIptv({ tipo: 'oficial', pacote, telefone: String(telefone), anotacoes });
  } finally {
    await auto.close();
  }
}

module.exports.createOfficialDirect = createOfficialDirect;

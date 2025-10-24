require('dotenv').config();
const axios = require('axios');

const PAGHIPER_API_KEY = process.env.PAGHIPER_API_KEY || process.env.PAGHIPER_APIKEY || '';
const PAGHIPER_TOKEN = process.env.PAGHIPER_TOKEN || process.env.PAGHIPER_TOKEN_API || '';
const API_BASE = process.env.PAGHIPER_BASE_URL || 'https://api.paghiper.com';
const PIX_BASE = process.env.PAGHIPER_PIX_BASE_URL || 'https://pix.paghiper.com';

if (!PAGHIPER_API_KEY || !PAGHIPER_TOKEN) {
  console.warn('[PagHiper] API key/token não configurados no .env (PAGHIPER_API_KEY / PAGHIPER_TOKEN).');
}

async function getPaymentStatus(transactionId) {
  if (!transactionId) throw new Error('transactionId é obrigatório');

  const payload = {
    apiKey: PAGHIPER_API_KEY,
    token: PAGHIPER_TOKEN,
    transaction_id: transactionId,
  };

  // 1) Tentar endpoint PIX oficial
  try {
    const urlPix = `${PIX_BASE}/invoice/status/`;
    const resPix = await axios.post(urlPix, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
    const data = resPix.data || {};
    const sr = data.status_request || data.pix_status_request || {};
    const status = sr.status || data.status || null; // paid | pending | canceled | completed
    const result = sr.result || data.result || null; // success | reject
    const ok = result === 'success';
    return { ok, status, raw: data, source: 'pix' };
  } catch (e) {
    // continua para fallback
  }

  // 2) Fallback para endpoint geral de transação
  try {
    const urlApi = `${API_BASE}/transaction/status/`;
    const res = await axios.post(urlApi, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
    const data = res.data || {};
    const sr = data.status_request || {};
    const status = sr.status || data.status || null;
    const result = sr.result || data.result || null;
    const ok = result === 'success';
    return { ok, status, raw: data, source: 'api' };
  } catch (e) {
    return { ok: false, status: null, error: e.message };
  }
}

async function checkPaymentUntilPaid(transactionId, { maxAttempts = 12, intervalMs = 30000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const { ok, status, error } = await getPaymentStatus(transactionId);
    console.log(`[PagHiper] Tentativa ${i + 1}/${maxAttempts} - status: ${status || 'n/d'}${!ok && error ? ` (erro: ${error})` : ''}`);
    if (ok && (status === 'paid' || status === 'completed')) return { paid: true, attempts: i + 1 };
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { paid: false, attempts: maxAttempts };
}

module.exports = {
  getPaymentStatus,
  checkPaymentUntilPaid,
};

// Checagem rápida em rajada: várias consultas curtas para evitar falsos negativos por delay
async function burstCheckPaid(transactionId, attempts = 5, intervalMs = 3000) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    const r = await getPaymentStatus(transactionId);
    if (r.ok && (r.status === 'paid' || r.status === 'completed')) {
      return { paid: true, attempt: i + 1 };
    }
    last = r;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { paid: false, attempt: attempts, lastStatus: last?.status || null, lastOk: !!last?.ok };
}

module.exports.burstCheckPaid = burstCheckPaid;

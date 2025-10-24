const express = require('express');
const router = express.Router();
const paymentController = require('./controllers/paymentController');

// Rota para o webhook da PagHiper
router.post('/webhook/paghiper', paymentController.handleWebhook);

// Rota para verificar status do servidor
router.get('/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date() });
});

module.exports = router;

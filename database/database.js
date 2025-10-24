const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'iptv_bot.db'));
    this.init();
  }

  init() {
    // Tabela de clientes
    this.db.run(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefone TEXT UNIQUE NOT NULL,
        nome TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de assinaturas
    this.db.run(`
      CREATE TABLE IF NOT EXISTS assinaturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        plano TEXT NOT NULL,
        valor REAL NOT NULL,
        data_inicio DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        status TEXT DEFAULT 'ativa',
        usuario_iptv TEXT,
        senha_iptv TEXT,
        url_servidor TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
      )
    `);

    // Tabela de transações
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        assinatura_id INTEGER,
        transaction_id TEXT UNIQUE,
        valor REAL NOT NULL,
        status TEXT DEFAULT 'pendente',
        metodo_pagamento TEXT DEFAULT 'pix',
        qr_code TEXT,
        qr_code_text TEXT,
        data_vencimento_pix DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id),
        FOREIGN KEY (assinatura_id) REFERENCES assinaturas (id)
      )
    `);

    console.log('Banco de dados inicializado com sucesso!');
  }

  // Métodos para clientes
  async criarCliente(telefone, nome = null, email = null) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO clientes (telefone, nome, email) 
        VALUES (?, ?, ?)
      `);
      
      stmt.run([telefone, nome, email], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  async buscarCliente(telefone) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM clientes WHERE telefone = ?',
        [telefone],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Métodos para assinaturas
  async criarAssinatura(clienteId, plano, valor, dataInicio, dataVencimento) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO assinaturas (cliente_id, plano, valor, data_inicio, data_vencimento) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([clienteId, plano, valor, dataInicio, dataVencimento], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  async atualizarCredenciaisIPTV(assinaturaId, usuario, senha, urlServidor) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE assinaturas SET usuario_iptv = ?, senha_iptv = ?, url_servidor = ? WHERE id = ?`,
        [usuario, senha, urlServidor, assinaturaId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  async buscarAssinaturasVencendo(dias = 3) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT a.*, c.telefone, c.nome 
        FROM assinaturas a 
        JOIN clientes c ON a.cliente_id = c.id 
        WHERE a.status = 'ativa' 
        AND DATE(a.data_vencimento) <= DATE('now', '+${dias} days')
        AND DATE(a.data_vencimento) >= DATE('now')
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Métodos para transações
  async criarTransacao(clienteId, assinaturaId, transactionId, valor, qrCode, qrCodeText, dataVencimentoPix) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO transacoes (cliente_id, assinatura_id, transaction_id, valor, qr_code, qr_code_text, data_vencimento_pix) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([clienteId, assinaturaId, transactionId, valor, qrCode, qrCodeText, dataVencimentoPix], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  async atualizarStatusTransacao(transactionId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE transacoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`,
        [status, transactionId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  async buscarTransacao(transactionId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM transacoes WHERE transaction_id = ?',
        [transactionId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;

require('dotenv').config();
const puppeteer = require('puppeteer');
const CaptchaSolverCorreto = require('./captchaSolverCorreto');

class IPTVAutomationV2 {
  constructor() {
    this.browser = null;
    this.page = null;
    this.captchaSolver = new CaptchaSolverCorreto();
    this.loginUrl = 'https://onlineoffice.zip/#/login';
    this.isLoggedIn = false;
  }

  /**
   * Vai para a página de criação de usuário e cria um usuário (teste ou oficial)
   * options = {
   *   tipo: 'teste' | 'oficial',
   *   pacote: 1 | 2, // 1: Completo com adultos, 2: Completo sem adultos
   *   telefone: '5511911111111',
   *   anotacoes?: string
   * }
   */
  async createUserIptv(options) {
    const { tipo = 'teste', pacote = 2, telefone, anotacoes = '' } = options || {};
    if (!telefone) throw new Error('Telefone é obrigatório no formato DDI+DDD+NUMERO, ex: 5511911111111');

    try {
      // Garantir login
      if (!this.isLoggedIn) {
        const USER = process.env.IPTV_USER || process.env.IPTV_ADMIN_USER || '';
        const PASS = process.env.IPTV_PASS || process.env.IPTV_ADMIN_PASSWORD || '';
        const loginResult = await this.login(USER, PASS);
        if (!loginResult.success) throw new Error('Falha no login: ' + loginResult.error);
      }

      // Ir para a página
      const targetUrl = 'https://onlineoffice.zip/#/user-iptv';
      await this.page.goto(targetUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(1500 + Math.floor(Math.random() * 800));

      // Toggle: Conta Teste vs Oficial
      // Usar XPath específico fornecido pelo usuário
      const toggleXPath = '//*[@id="app"]/div/div[1]/div/div[2]/div/div/div/div/div[2]/div/div/div[1]/label/span';
      await this.page.waitForXPath(toggleXPath, { timeout: 15000 });
      const wantOficial = tipo.toLowerCase() !== 'teste';
      
      console.log(`🔄 Configurando tipo de conta: ${wantOficial ? 'OFICIAL' : 'TESTE'}`);

      for (let i = 0; i < 3; i++) {
        const stateText = await this.page.evaluate(() => {
          const el = Array.from(document.querySelectorAll('*'))
            .find(n => /Conta:\s*(Teste|Oficial)/i.test(n.textContent || ''));
          return el ? (el.textContent || '').trim() : '';
        });
        const isOficial = /Oficial/i.test(stateText);
        console.log(`🔍 Estado atual: ${stateText} | Queremos: ${wantOficial ? 'Oficial' : 'Teste'}`);
        
        if (isOficial === wantOficial) {
          console.log('✅ Toggle já está no estado correto');
          break;
        }
        
        console.log('🔄 Clicando no toggle...');
        const [toggleElement] = await this.page.$x(toggleXPath);
        await toggleElement.click();
        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 300));
      }

      // PRIMEIRO: Selecionar pacote no dropdown (ANTES de preencher campos)
      console.log(`📦 Selecionando pacote ${pacote}...`);
      
      // Aguardar carregamento dos selects
      await this.page.waitForTimeout(1000);
      
      // Detectar posição do select de pacotes baseado no estado (teste vs oficial)
      const selectInfo = await this.page.evaluate((wantOficial) => {
        const selects = Array.from(document.querySelectorAll('select.form-control'));
        
        if (wantOficial) {
          // Estado OFICIAL: pacotes em select[0], período em select[1]
          return {
            pacoteSelectIndex: 0,
            periodoSelectIndex: 1,
            totalSelects: selects.length
          };
        } else {
          // Estado TESTE: tempo em select[0], pacotes em select[1]
          return {
            pacoteSelectIndex: 1,
            periodoSelectIndex: null,
            totalSelects: selects.length
          };
        }
      }, wantOficial);
      
      console.log(`📊 Selects detectados: ${selectInfo.totalSelects} | Pacote em: select[${selectInfo.pacoteSelectIndex}]`);
      
      // Selecionar pacote no select correto
      const pacoteValue = await this.page.evaluate((selectIndex, pacote) => {
        const selects = document.querySelectorAll('select.form-control');
        const select = selects[selectIndex];
        if (!select) return null;
        
        const options = Array.from(select.options);
        console.log('Opções de pacote disponíveis:', options.map(o => `${o.value}: ${o.text}`));
        
        // Mapeamento direto
        const targetOption = options.find(o => o.value === String(pacote));
        return targetOption ? targetOption.value : null;
      }, selectInfo.pacoteSelectIndex, pacote);
      
      if (!pacoteValue) {
        throw new Error(`Não foi possível encontrar opção para pacote ${pacote}`);
      }
      
      console.log(`📦 Selecionando pacote valor: ${pacoteValue}`);
      await this.page.evaluate((selectIndex, value) => {
        const selects = document.querySelectorAll('select.form-control');
        const select = selects[selectIndex];
        if (select) {
          select.value = value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selectInfo.pacoteSelectIndex, pacoteValue);
      
      // Se for conta OFICIAL, selecionar período (padrão: 1 mês)
      if (wantOficial && selectInfo.periodoSelectIndex !== null) {
        console.log(`📅 Selecionando período para conta oficial...`);
        await this.page.evaluate((selectIndex) => {
          const selects = document.querySelectorAll('select.form-control');
          const select = selects[selectIndex];
          if (select) {
            // Selecionar "1 mês - 1 Crédito" (value="1")
            select.value = "1";
            select.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('📅 Período selecionado: 1 mês');
          }
        }, selectInfo.periodoSelectIndex);
      }
      
      await this.page.waitForTimeout(500);

      // Capturar número de usuário sugerido pelo portal (placeholder do primeiro input number)
      const userNumber = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input.form-control[type="number"][placeholder]'));
        // Preferir placeholder com 5-9 dígitos
        const candidate = inputs.find(i => /\d{5,9}/.test(i.getAttribute('placeholder') || ''));
        return candidate ? candidate.getAttribute('placeholder') : null;
      });

      // DEPOIS: Preencher telefone (input number com placeholder 5511...)
      console.log(`📱 Preenchendo telefone: ${telefone}`);
      await this.page.evaluate((telefone) => {
        const inputs = Array.from(document.querySelectorAll('input.form-control[type="number"][placeholder]'));
        const phoneInput = inputs.find(i => (i.getAttribute('placeholder') || '').includes('5511')) || inputs[1] || inputs[0];
        if (phoneInput) {
          phoneInput.focus();
          phoneInput.value = '';
        }
      }, telefone);
      await this.page.type('input.form-control[type="number"][placeholder*="5511"]', String(telefone), { delay: 50 }).catch(async () => {
        // Fallback: segundo input number
        const inputs = await this.page.$$('input.form-control[type="number"][placeholder]');
        if (inputs[1]) {
          await inputs[1].type(String(telefone), { delay: 50 });
        }
      });

      // Preencher anotações
      await this.page.type('textarea.form-control.form-control-alternative', anotacoes || 'Criado automaticamente pelo bot', { delay: 20 }).catch(() => {});

      // Enviar formulário: botão "Adicionar"
      await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button.btn.btn-primary.my-4'));
        const add = btns.find(b => /Adicionar/i.test(b.textContent || '')) || btns[0];
        if (add) add.click();
      });

      // Aguardar alerta com informações
      await this.page.waitForSelector('div.alert.alert-dark[role="alert"]', { timeout: 20000 });

      // Extrair infos do alerta
      const result = await this.page.evaluate(() => {
        const alert = document.querySelector('div.alert.alert-dark[role="alert"]');
        const host = alert ? (alert.textContent || '') : '';
        const text = host.replace(/\s+/g, ' ').trim();
        
        // Função melhorada para extrair campos
        const get = (label) => {
          const m = text.match(new RegExp(label + '\\s*:?\\s*([^ <]+)', 'i'));
          return m ? m[1] : null;
        };
        
        const usuario = get('USUÁRIO');
        const senha = get('SENHA');
        
        // Melhor extração do vencimento (capturar data/hora completa)
        const vencimentoMatch = text.match(/VENCIMENTO\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i);
        const vencimento = vencimentoMatch ? vencimentoMatch[1].trim() : null;
        
        // Links
        const links = [];
        alert && alert.querySelectorAll('a[href]').forEach(a => links.push(a.href));
        
        // Extrair link M3U8 principal do texto
        const m3u8Match = text.match(/http:\/\/[^\s]+\.php\?username=[^&\s]+&password=[^&\s]+[^\s]*/i);
        const linkPrincipal = m3u8Match ? m3u8Match[0] : null;
        
        return { 
          usuario, 
          senha, 
          vencimento, 
          links, 
          linkPrincipal,
          raw: text.slice(0, 800) // Mais caracteres para debug
        };
      });

      return { success: true, tipo: wantOficial ? 'oficial' : 'teste', pacote, telefone, userNumber, ...result };
    } catch (error) {
      console.error('❌ Erro em createUserIptv:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inicializa o browser
   */
  async init() {
    try {
      console.log('🚀 Inicializando automação IPTV V2...');
      
      // Usar perfil persistente para evitar reCAPTCHA recorrente e manter sessão
      const userDataDir = require('path').resolve(__dirname, '..', 'data', 'puppeteer_profile');
      this.browser = await puppeteer.launch({
        headless: false, // Manter visível para debug inicial
        defaultViewport: null,
        userDataDir,
        slowMo: 80,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Configurar user agent mais natural
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('✅ Browser inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar browser:', error.message);
      return false;
    }
  }

  async close() {
    try {
      if (this.page) { try { await this.page.close(); } catch {} }
      if (this.browser) { try { await this.browser.close(); } catch {} }
    } catch {}
  }

  /**
   * Realiza login automático com resolução de captcha
   */
  async login(username, password) {
    try {
      console.log('🔐 Iniciando login automático...');
      console.log(`👤 Usuário: ${username}`);
      
      if (!this.browser || !this.page) {
        await this.init();
      }

      // DETECÇÃO INTELIGENTE: Verificar se já está logado (sessão existente ou login manual)
      try {
        console.log('🔎 Verificando se já está logado...');
        
        // Primeiro, verificar URL atual
        const currentUrl = this.page.url();
        console.log(`📍 URL atual: ${currentUrl}`);
        
        // Se não estiver na página de login, provavelmente já está logado
        if (!/login/i.test(currentUrl)) {
          console.log('✅ Não está na página de login - verificando se está logado...');
          
          // Tentar acessar página interna para confirmar login
          await this.page.goto('https://onlineoffice.zip/#/user-iptv', { waitUntil: 'networkidle2' });
          await this.page.waitForTimeout(2000);
          
          const newUrl = this.page.url();
          if (!/login/i.test(newUrl)) {
            console.log('✅ LOGIN MANUAL DETECTADO! Sessão válida confirmada');
            this.isLoggedIn = true;
            return { success: true, method: 'manual_login_detected' };
          }
        }
        
        // Se chegou aqui, tentar acessar página interna diretamente
        console.log('🔎 Testando acesso direto à página interna...');
        await this.page.goto('https://onlineoffice.zip/#/user-iptv', { waitUntil: 'networkidle2' });
        await this.page.waitForTimeout(2000);
        
        const finalUrl = this.page.url();
        if (!/login/i.test(finalUrl)) {
          console.log('✅ SESSÃO VÁLIDA DETECTADA! Pulando processo de login');
          this.isLoggedIn = true;
          return { success: true, method: 'session_valid' };
        }
        
        console.log('ℹ️ Redirecionado para login - sessão não válida, prosseguindo com login automático');
      } catch (e) {
        console.log('ℹ️ Erro ao verificar sessão, prosseguindo com login:', e.message);
      }

      // Navegar para página de login
      console.log('🌐 Navegando para página de login...');
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);

      // Preencher credenciais
      console.log('📝 Preenchendo credenciais...');
      await this.page.type('input[placeholder*="usuário" i]', username, { delay: 100 });
      await this.page.waitForTimeout(1000);
      await this.page.type('input[placeholder*="senha" i]', password, { delay: 100 });
      await this.page.waitForTimeout(2000);

      // Verificar se há reCAPTCHA
      const hasRecaptcha = await this.page.evaluate(() => {
        return document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]') !== null;
      });

      if (hasRecaptcha) {
        console.log('🤖 reCAPTCHA detectado! Resolvendo automaticamente...');
        
        // Verificar saldo primeiro
        const balance = await this.captchaSolver.checkBalance();
        console.log(`💰 Saldo 2captcha: $${balance}`);
        
        if (balance < 0.01) {
          throw new Error('Saldo insuficiente no 2captcha');
        }

        // Resolver captcha automaticamente
        const captchaSuccess = await this.captchaSolver.solveAndLoginCorrect(this.page);
        
        if (captchaSuccess) {
          console.log('✅ Login com reCAPTCHA realizado com sucesso!');
          this.isLoggedIn = true;
          return { success: true, method: 'captcha_auto' };
        } else {
          console.log('⚠️ Captcha resolvido mas login falhou - tentando métodos alternativos...');
          // Continuar para tentar login manual
        }
      }

      // Tentar login sem captcha ou após falha do captcha
      console.log('🖱️ Tentando login direto...');
      
      const loginResult = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        
        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase().trim();
          
          if (text.includes('logar') || 
              text.includes('login') || 
              text.includes('entrar') ||
              button.type === 'submit') {
            
            button.click();
            return { success: true, text: text || button.type };
          }
        }
        
        return { success: false };
      });

      if (loginResult.success) {
        await this.page.waitForTimeout(5000);
        
        const currentUrl = this.page.url();
        const loginSuccess = !currentUrl.includes('login');
        
        if (loginSuccess) {
          console.log('✅ Login realizado com sucesso!');
          this.isLoggedIn = true;
          return { success: true, method: 'direct', url: currentUrl };
        } else {
          console.log('❌ Login falhou - ainda na página de login');
          return { success: false, error: 'Credenciais incorretas ou proteção ativa' };
        }
      } else {
        throw new Error('Botão de login não encontrado');
      }

    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cria uma nova conta IPTV automaticamente
   */
  async createAccount(userData) {
    try {
      console.log('👤 Criando nova conta IPTV...');
      console.log(`📧 Email: ${userData.email}`);
      console.log(`👤 Username: ${userData.username}`);
      
      if (!this.browser || !this.page) {
        await this.init();
      }

      // Navegar para página de registro (se existir)
      // Implementar lógica de criação de conta conforme necessário
      
      console.log('⚠️ Funcionalidade de criação de conta em desenvolvimento');
      return { success: false, error: 'Não implementado ainda' };
      
    } catch (error) {
      console.error('❌ Erro na criação de conta:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Gera credenciais IPTV para um cliente
   */
  async generateCredentials(clientData) {
    try {
      console.log('🔑 Gerando credenciais IPTV...');
      
      // Verificar se está logado
      if (!this.isLoggedIn) {
        console.log('⚠️ Não está logado, tentando login primeiro...');
        const loginResult = await this.login('Ziel20', '210309'); // Usar credenciais do .env em produção
        
        if (!loginResult.success) {
          throw new Error('Falha no login: ' + loginResult.error);
        }
      }

      // Implementar lógica de geração de credenciais
      // Navegar para seção de criação de usuários
      // Preencher dados do cliente
      // Gerar credenciais
      
      console.log('⚠️ Funcionalidade de geração de credenciais em desenvolvimento');
      
      // Por enquanto, retornar credenciais mock
      const credentials = {
        username: `user_${Date.now()}`,
        password: `pass_${Math.random().toString(36).substring(7)}`,
        server: 'http://servidor.iptv.com:8080',
        createdAt: new Date().toISOString()
      };
      
      console.log('✅ Credenciais geradas:', credentials);
      return { success: true, credentials };
      
    } catch (error) {
      console.error('❌ Erro na geração de credenciais:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fecha o browser
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('✅ Browser fechado');
      }
    } catch (error) {
      console.error('❌ Erro ao fechar browser:', error.message);
    }
  }

  /**
   * Verifica status da conexão
   */
  async checkStatus() {
    try {
      if (!this.page) {
        return { connected: false, logged: false };
      }
      
      const currentUrl = this.page.url();
      const isConnected = currentUrl && !currentUrl.includes('about:blank');
      const isLogged = this.isLoggedIn && !currentUrl.includes('login');
      
      return {
        connected: isConnected,
        logged: isLogged,
        url: currentUrl
      };
    } catch (error) {
      return { connected: false, logged: false, error: error.message };
    }
  }
}

module.exports = IPTVAutomationV2;

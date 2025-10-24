const puppeteer = require('puppeteer');
const CaptchaSolver = require('./captchaSolver');

class IPTVAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.captchaSolver = new CaptchaSolver();
    
    // Credenciais do portal IPTV
    this.loginUrl = 'https://onlineoffice.zip/#/login';
    this.username = process.env.IPTV_ADMIN_USER;
    this.password = process.env.IPTV_ADMIN_PASSWORD;
  }

  async init() {
    try {
      console.log('🚀 Inicializando browser para automação IPTV');
      
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized',
          '--window-size=1920,1080',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Configurar headers realistas
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // Anti-detecção avançada
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'permissions', { get: () => ({ query: () => Promise.resolve({ state: 'granted' }) }) });
      });

      console.log('✅ Browser inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar browser:', error);
      return false;
    }
  }

  async login() {
    try {
      if (!this.browser || !this.page) {
        await this.init();
      }

      console.log('🔐 Iniciando processo de login...');
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);

      // Preencher credenciais usando seletores corretos do debug
      console.log('📝 Preenchendo credenciais...');
      await this.page.type('input[placeholder*="usuário" i], input[name="username"], input[type="text"], #username', this.username, { delay: 100 });
      await this.page.waitForTimeout(1000);
      await this.page.type('input[placeholder*="senha" i], input[name="password"], input[type="password"], #password', this.password, { delay: 100 });
      await this.page.waitForTimeout(2000);

      // PRIMEIRO: Verificar e resolver reCAPTCHA automaticamente com 2captcha
      console.log('🔍 Verificando se reCAPTCHA está presente...');
      const recaptchaSuccess = await this.resolverRecaptchaAutomatico();
      
      if (!recaptchaSuccess) {
        console.log('⚠️ reCAPTCHA não foi resolvido automaticamente, mas continuando...');
      } else {
        console.log('✅ reCAPTCHA resolvido com sucesso pelo 2captcha!');
      }

      // DEPOIS: Clicar no botão de login (APÓS reCAPTCHA resolvido)
      console.log('🖱️ reCAPTCHA resolvido! Clicando no botão de login...');
      
      // Procurar botão "Logar" usando evaluate
      const loginButton = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find(btn => 
          btn.textContent?.trim().toLowerCase().includes('logar') ||
          btn.value?.toLowerCase().includes('logar') ||
          btn.classList.contains('btn-primary')
        );
      });
      
      if (loginButton) {
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const btn = buttons.find(btn => 
            btn.textContent?.trim().toLowerCase().includes('logar') ||
            btn.value?.toLowerCase().includes('logar') ||
            btn.classList.contains('btn-primary')
          );
          if (btn) btn.click();
        });
        console.log('✅ Botão "Logar" clicado após reCAPTCHA!');
      } else {
        // Fallback para seletores tradicionais
        await this.page.click('button[type="submit"], .btn-primary, input[type="submit"]');
        console.log('✅ Botão de login clicado (fallback) após reCAPTCHA!');
      }
      await this.page.waitForTimeout(3000);

      // Verificar se ainda está na página de login (re-clicar se necessário)
      const currentUrl = this.page.url();
      if (currentUrl.includes('login')) {
        console.log('🔄 Ainda na página de login, clicando novamente...');
        await this.page.click('button[type="submit"], .btn-login, input[type="submit"]');
        await this.page.waitForTimeout(3000);
      }

      // Verificar sucesso do login
      await this.page.waitForTimeout(5000);
      const loginSuccess = await this.verificarLoginSucesso();

      if (loginSuccess) {
        this.isLoggedIn = true;
        console.log('✅ Login realizado com sucesso!');
        return true;
      } else {
        throw new Error('❌ Falha no login - Verifique credenciais ou reCAPTCHA');
      }

    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      return false;
    }
  }

  async resolverRecaptchaAutomatico() {
    try {
      console.log('🤖 Iniciando resolução AUTOMÁTICA de reCAPTCHA...');
      
      // Verificar se reCAPTCHA está presente
      const recaptchaPresente = await this.page.$('iframe[src*="recaptcha"]');
      
      if (!recaptchaPresente) {
        console.log('✅ Nenhum reCAPTCHA detectado!');
        return true;
      }
      
      console.log('🛡️ reCAPTCHA detectado, usando 2captcha...');
      
      // Aguardar um pouco para o reCAPTCHA carregar completamente
      await this.page.waitForTimeout(2000);
      
      // Usar o CaptchaSolver (2captcha) para resolver automaticamente
      const success = await this.captchaSolver.solveRecaptcha(this.page);
      
      if (success) {
        console.log('🎉 reCAPTCHA resolvido automaticamente pelo 2captcha!');
        // Aguardar um pouco após resolver para garantir que foi processado
        await this.page.waitForTimeout(2000);
        return true;
      }
      
      console.log('⚠️ 2captcha não conseguiu resolver, mas continuando...');
      return false;
      
    } catch (error) {
      console.error('❌ Erro na resolução automática:', error.message);
      console.log('⚠️ Continuando mesmo com erro no captcha...');
      return false;
    }
  }

  async verificarLoginSucesso() {
    try {
      const currentUrl = this.page.url();
      
      // Verificar se saiu da página de login
      if (!currentUrl.includes('login')) {
        console.log('✅ Redirecionado da página de login');
        return true;
      }

      // Procurar elementos que indicam login bem-sucedido
      const successSelectors = [
        '.dashboard',
        '.main-content',
        '.user-menu',
        '.logout',
        '[href*="logout"]',
        '.welcome'
      ];

      for (const selector of successSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`✅ Elemento de sucesso encontrado: ${selector}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar login:', error);
      return false;
    }
  }

  async criarUsuario(dadosUsuario) {
    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Não foi possível fazer login');
        }
      }

      console.log('👤 Iniciando criação de usuário IPTV...');
      
      // Navegar para seção de usuários
      await this.navegarParaUsuarios();
      
      // Clicar em "Criar Novo Usuário"
      await this.clicarCriarNovoUsuario();
      
      // Preencher formulário
      await this.preencherFormularioUsuario(dadosUsuario);
      
      // Submeter formulário
      await this.submeterFormulario();
      
      // Verificar sucesso
      const sucesso = await this.verificarCriacaoSucesso();
      
      if (sucesso) {
        console.log('✅ Usuário IPTV criado com sucesso!');
        return {
          success: true,
          usuario: dadosUsuario.username,
          senha: dadosUsuario.password
        };
      } else {
        throw new Error('Falha na criação do usuário');
      }
      
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error.message);
      return { success: false, error: error.message };
    }
  }

  async navegarParaUsuarios() {
    console.log('🧭 Navegando para seção de usuários...');
    
    const userSectionSelectors = [
      'a[href*="user"]',
      'a[href*="cliente"]',
      '.menu-users',
      '.nav-users',
      '[data-menu="users"]'
    ];
    
    for (const selector of userSectionSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click();
        await this.page.waitForTimeout(2000);
        console.log(`✅ Clicou em: ${selector}`);
        return;
      }
    }
    
    throw new Error('Não foi possível encontrar seção de usuários');
  }

  async clicarCriarNovoUsuario() {
    console.log('➕ Procurando botão "Criar Novo Usuário"...');
    
    const createButtonSelectors = [
      'button:contains("Novo")',
      'button:contains("Criar")',
      'button:contains("Add")',
      '.btn-create',
      '.btn-new',
      '.create-user',
      '[data-action="create"]'
    ];
    
    for (const selector of createButtonSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 2000 });
        await this.page.click(selector);
        await this.page.waitForTimeout(2000);
        console.log(`✅ Clicou em botão: ${selector}`);
        return;
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('Não foi possível encontrar botão de criar usuário');
  }

  async preencherFormularioUsuario(dados) {
    console.log('📝 Preenchendo formulário de usuário...');
    
    // Preencher username
    const usernameSelectors = ['input[name="username"]', '#username', '.username'];
    await this.preencherCampo(usernameSelectors, dados.username);
    
    // Preencher password
    const passwordSelectors = ['input[name="password"]', '#password', '.password'];
    await this.preencherCampo(passwordSelectors, dados.password);
    
    // Preencher email (se necessário)
    if (dados.email) {
      const emailSelectors = ['input[name="email"]', '#email', '.email'];
      await this.preencherCampo(emailSelectors, dados.email);
    }
    
    // Selecionar tipo de conta (se necessário)
    if (dados.accountType) {
      await this.selecionarTipoConta(dados.accountType);
    }
  }

  async preencherCampo(selectors, valor) {
    for (const selector of selectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 }); // Selecionar tudo
        await element.type(valor, { delay: 50 });
        console.log(`✅ Preenchido: ${selector} = ${valor}`);
        return;
      }
    }
    console.log(`⚠️ Campo não encontrado para: ${valor}`);
  }

  async selecionarTipoConta(tipo) {
    console.log(`🎯 Selecionando tipo de conta: ${tipo}`);
    
    const typeSelectors = [
      `select[name="account_type"] option[value="${tipo}"]`,
      `select[name="type"] option[value="${tipo}"]`,
      `.account-type option[value="${tipo}"]`
    ];
    
    for (const selector of typeSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click();
        console.log(`✅ Selecionado tipo: ${tipo}`);
        return;
      }
    }
  }

  async submeterFormulario() {
    console.log('📤 Submetendo formulário...');
    
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn-submit',
      '.btn-save',
      'button:contains("Salvar")',
      'button:contains("Criar")'
    ];
    
    for (const selector of submitSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click();
        await this.page.waitForTimeout(3000);
        console.log(`✅ Formulário submetido: ${selector}`);
        return;
      }
    }
    
    throw new Error('Não foi possível submeter formulário');
  }

  async verificarCriacaoSucesso() {
    console.log('🔍 Verificando sucesso da criação...');
    
    const successIndicators = [
      '.alert-success',
      '.success-message',
      '.notification-success',
      'text=criado com sucesso',
      'text=created successfully'
    ];
    
    for (const indicator of successIndicators) {
      const element = await this.page.$(indicator);
      if (element) {
        console.log(`✅ Sucesso confirmado: ${indicator}`);
        return true;
      }
    }
    
    // Verificar se voltou para lista de usuários
    const currentUrl = this.page.url();
    if (currentUrl.includes('user') && !currentUrl.includes('create')) {
      console.log('✅ Redirecionado para lista de usuários');
      return true;
    }
    
    return false;
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('🏁 Browser fechado');
      }
    } catch (error) {
      console.error('Erro ao fechar browser:', error);
    }
  }

  // Método para gerar credenciais aleatórias
  gerarCredenciais() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8);
    
    return {
      username: `user_${timestamp}`,
      password: `pass_${random}`,
      email: `user_${timestamp}@iptv.com`,
      accountType: 'trial' // ou 'premium'
    };
  }
}

module.exports = IPTVAutomation;

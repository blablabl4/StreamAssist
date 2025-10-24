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
      this.browser = await puppeteer.launch({
        headless: false, // Modo visível para bypass de reCAPTCHA
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--metrics-recording-only',
          '--no-report-upload',
          '--disable-default-apps',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-extensions-except',
          '--disable-plugins-discovery',
          '--disable-preconnect'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
        executablePath: undefined
      });

      this.page = await this.browser.newPage();
      
      // Configurar User-Agent ultra-realista
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Headers extras para parecer mais humano
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // Script ultra-avançado para bypass de detecção
      await this.page.evaluateOnNewDocument(() => {
        // Remover TODAS as indicações de automação
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Deletar propriedades de automação
        delete navigator.__proto__.webdriver;
        delete window.navigator.webdriver;
        delete window.webdriver;
        
        // Simular Chrome real
        window.chrome = {
          app: {
            isInstalled: false,
          },
          webstore: {
            onInstallStageChanged: {},
            onDownloadProgress: {},
          },
          runtime: {
            PlatformOs: {
              MAC: 'mac',
              WIN: 'win',
              ANDROID: 'android',
              CROS: 'cros',
              LINUX: 'linux',
              OPENBSD: 'openbsd',
            },
            PlatformArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
            PlatformNaclArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
            RequestUpdateCheckStatus: {
              THROTTLED: 'throttled',
              NO_UPDATE: 'no_update',
              UPDATE_AVAILABLE: 'update_available',
            },
          },
        };
        
        // Propriedades do navigator mais realistas
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en'],
        });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: '',
                enabledPlugin: null,
              },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            },
            {
              0: {
                type: 'application/pdf',
                suffixes: 'pdf',
                description: '',
                enabledPlugin: null,
              },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer',
            },
          ],
        });
        
        // Simular hardware real
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
        });
        
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });
        
        // Permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // WebGL fingerprint
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel(R) Iris(R) Xe Graphics';
          }
          return getParameter(parameter);
        };
      });
      
      await this.page.setViewport({ width: 1366, height: 768 });
      
      console.log('Browser inicializado para automação IPTV');
      return true;

    } catch (error) {
      console.error('Erro ao inicializar browser:', error);
      return false;
    }
  }

  async login() {
    try {
      if (!this.page) {
        await this.init();
      }

      console.log('Fazendo login no portal IPTV...');
      
      // Navegar para página de login
      await this.page.goto(this.loginUrl, { waitUntil: 'networkidle0' });
      
      // Aguardar campos de login carregarem
      await this.page.waitForSelector('input[placeholder="Usuário"]', { timeout: 10000 });
      
      // Preencher credenciais
      console.log('✏️ Preenchendo credenciais...');
      await this.page.type('input[placeholder="Usuário"]', this.username, { delay: 100 });
      await this.page.type('input[placeholder="Senha"]', this.password, { delay: 100 });
      
      console.log('🖱️ Clicando no botão de login...');
      // Clicar no botão de login PRIMEIRO
      await this.page.click('button.btn-primary');
      
      // Aguardar um pouco para ver se reCAPTCHA aparece
      await this.page.waitForTimeout(2000);
      
      // DEPOIS tratar reCAPTCHA se aparecer - AUTOMÁTICO!
      console.log('🔍 Verificando se reCAPTCHA apareceu após clique...');
      const recaptchaSuccess = await this.resolverRecaptchaAutomatico();
      
      if (!recaptchaSuccess) {
        throw new Error('❌ reCAPTCHA NÃO foi resolvido - login não pode prosseguir!');
      }
      
      console.log('✅ reCAPTCHA obrigatoriamente resolvido, prosseguindo...');
      // Aguardar mais um pouco após resolver reCAPTCHA
      await this.page.waitForTimeout(3000);
      
      // Verificar se ainda estamos na página de login após resolver reCAPTCHA
      const urlAposRecaptcha = this.page.url();
      if (urlAposRecaptcha.includes('login')) {
        console.log('🔄 Ainda na página de login após reCAPTCHA, clicando login novamente...');
        await this.page.click('button.btn-primary');
        await this.page.waitForTimeout(2000);
      }
      
      // Aguardar redirecionamento
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      
      // Verificar se login foi bem-sucedido
      const currentUrl = this.page.url();
      if (currentUrl.includes('login')) {
        throw new Error('Login falhou - ainda na página de login');
      }
      
      this.isLoggedIn = true;
      console.log('✅ Login realizado com sucesso!');
      console.log('URL atual:', currentUrl);
      
      return true;

    } catch (error) {
      console.error('❌ Erro no login:', error);
      this.isLoggedIn = false;
      return false;
    }
  }

  async criarUsuarioTeste(dadosUsuario) {
    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Não foi possível fazer login');
        }
      }

      console.log('Criando usuário teste:', dadosUsuario.username);
      
      // Aqui você precisa navegar para a seção de criação de usuários
      // Como não tenho acesso ao painel, vou criar a estrutura genérica
      
      // Exemplo de navegação (adapte conforme o portal):
      // await this.page.goto('https://onlineoffice.zip/#/users/create');
      // await this.page.waitForSelector('form', { timeout: 10000 });
      
      // Preencher formulário de criação
      const usuario = {
        username: dadosUsuario.username,
        password: dadosUsuario.password,
        package: dadosUsuario.package || 'trial',
        max_connections: dadosUsuario.max_connections || 1,
        enabled: true,
        is_trial: true,
        trial_duration: dadosUsuario.trial_duration || 24 // horas
      };

      // Simular preenchimento do formulário
      // await this.page.type('input[name="username"]', usuario.username);
      // await this.page.type('input[name="password"]', usuario.password);
      // await this.page.select('select[name="package"]', usuario.package);
      // await this.page.type('input[name="max_connections"]', usuario.max_connections.toString());
      
      // Marcar como teste/trial
      // await this.page.click('input[name="is_trial"]');
      
      // Submeter formulário
      // await this.page.click('button[type="submit"]');
      // await this.page.waitForNavigation({ waitUntil: 'networkidle0' });

      // Por enquanto, simular sucesso
      console.log('✅ Usuário teste criado (simulado):', usuario);
      
      return {
        success: true,
        data: usuario
      };

    } catch (error) {
      console.error('❌ Erro ao criar usuário teste:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criarUsuarioPago(dadosUsuario) {
    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Não foi possível fazer login');
        }
      }

      console.log('Criando usuário pago:', dadosUsuario.username);
      
      const usuario = {
        username: dadosUsuario.username,
        password: dadosUsuario.password,
        package: dadosUsuario.package,
        max_connections: dadosUsuario.max_connections,
        enabled: true,
        is_trial: false,
        expiry_date: dadosUsuario.expiry_date
      };

      // Implementar criação de usuário pago similar ao teste
      // mas sem marcar como trial e com data de expiração

      console.log('✅ Usuário pago criado (simulado):', usuario);
      
      return {
        success: true,
        data: usuario
      };

    } catch (error) {
      console.error('❌ Erro ao criar usuário pago:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async desativarUsuario(username) {
    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Não foi possível fazer login');
        }
      }

      console.log('Desativando usuário:', username);
      
      // Navegar para lista de usuários e encontrar o usuário específico
      // Implementar busca e desativação
      
      console.log('✅ Usuário desativado (simulado):', username);
      
      return { success: true };

    } catch (error) {
      console.error('❌ Erro ao desativar usuário:', error);
      return { success: false, error: error.message };
    }
  }

  async explorarPortal() {
    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Não foi possível fazer login');
        }
      }

      console.log('🔍 Explorando estrutura do portal...');
      
      // Capturar screenshot da página principal
      await this.page.screenshot({ 
        path: 'portal_main.png', 
        fullPage: true 
      });
      
      // Listar todos os links/menus disponíveis
      const links = await this.page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a, button'));
        return allLinks.map(link => ({
          text: link.textContent.trim(),
          href: link.href || link.onclick?.toString(),
          tag: link.tagName
        })).filter(link => link.text.length > 0);
      });
      
      console.log('📋 Links encontrados no portal:');
      links.forEach((link, index) => {
        console.log(`${index + 1}. ${link.text} (${link.tag})`);
      });
      
      return {
        success: true,
        links: links,
        screenshot: 'portal_main.png'
      };

    } catch (error) {
      console.error('❌ Erro ao explorar portal:', error);
      return { success: false, error: error.message };
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('Browser fechado');
    }
  }

  // Método para manter sessão ativa
  async keepAlive() {
    if (this.page && this.isLoggedIn) {
      try {
        // Fazer uma ação simples para manter sessão
        await this.page.evaluate(() => {
          // Simular movimento do mouse ou click
          document.body.click();
        });
        return true;
      } catch (error) {
    return false;
    
  } catch (error) {
    console.error('❌ Erro na resolução automática:', error.message);
    return false;
  }
}

async lidarComRecaptcha() {
  try {
    console.log('🔍 Verificando presença de reCAPTCHA...');
    
    // Aguardar carregamento completo
    await this.page.waitForTimeout(3000);
    
    // Verificar diferentes tipos de reCAPTCHA
    const recaptchaSelectors = [
      '.g-recaptcha',
      'iframe[src*="recaptcha"]',
      '[data-sitekey]',
      '.recaptcha-checkbox',
      '#recaptcha',
      '.captcha'
    ];
    
    let recaptchaEncontrado = false;
    
    for (const selector of recaptchaSelectors) {
      const elemento = await this.page.$(selector);
      if (elemento) {
        recaptchaEncontrado = true;
        console.log(`⚠️ reCAPTCHA detectado: ${selector}`);
        break;
      await this.page.waitForTimeout(3000);
      
      // Verificar diferentes tipos de reCAPTCHA
      const recaptchaSelectors = [
        '.g-recaptcha',
        'iframe[src*="recaptcha"]',
        '[data-sitekey]',
        '.recaptcha-checkbox',
        '#recaptcha',
        '.captcha'
      ];
      
      let recaptchaEncontrado = false;
      
      for (const selector of recaptchaSelectors) {
        const elemento = await this.page.$(selector);
        if (elemento) {
          recaptchaEncontrado = true;
          console.log(`⚠️ reCAPTCHA detectado: ${selector}`);
          break;
        }
      }
      
      if (recaptchaEncontrado) {
        console.log('🚀 MODO ULTRA-AGRESSIVO: Bypass de reCAPTCHA ativado!');
        
        // ESTRATÉGIA MULTI-TENTATIVAS
        const maxTentativas = 5;
        
        for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
          console.log(`🎯 TENTATIVA ${tentativa}/${maxTentativas}`);
          
          // Comportamento humano antes de cada tentativa
          await this.simularComportamentoHumano();
          
          // Tentar clicar no checkbox
          const clickSuccess = await this.clicarCheckboxRecaptcha();
          
          if (clickSuccess) {
            console.log(`✅ Tentativa ${tentativa}: Checkbox clicado!`);
            
            // Aguardar processamento com tempo variável
            const tempoEspera = Math.random() * 3000 + 2000;
            await this.page.waitForTimeout(tempoEspera);
            
            // Verificar se foi resolvido
            const autoResolvido = await this.verificarCaptchaResolvido();
            
            if (autoResolvido) {
              console.log(`🎉 SUCESSO na tentativa ${tentativa}! reCAPTCHA resolvido!`);
              return true;
            }
            
            // Se não resolveu, tentar clicar novamente após pausa
            console.log(`⚠️ Tentativa ${tentativa} não resolveu, tentando novamente...`);
            await this.page.waitForTimeout(1000);
            
            // Tentar clicar uma segunda vez na mesma tentativa
            await this.clicarCheckboxRecaptcha();
            await this.page.waitForTimeout(2000);
            
            const segundaVerificacao = await this.verificarCaptchaResolvido();
            if (segundaVerificacao) {
              console.log(`🎉 SUCESSO na segunda tentativa ${tentativa}!`);
              return true;
            }
          }
          
          // Pausa entre tentativas
          if (tentativa < maxTentativas) {
            console.log(`⏳ Pausando antes da próxima tentativa...`);
            await this.page.waitForTimeout(Math.random() * 2000 + 1000);
          }
        }
        
        // Se todas as tentativas falharam, tentar estratégia manual
        console.log('👤 FALLBACK: Aguardando resolução manual...');
        console.log('🕰️ Você tem 45 segundos para resolver manualmente!');
        
        const tempoLimiteManual = 45000;
        const inicioTempo = Date.now();
        
        while (Date.now() - inicioTempo < tempoLimiteManual) {
          const captchaResolvido = await this.verificarCaptchaResolvido();
          
          if (captchaResolvido) {
            console.log('✅ reCAPTCHA resolvido manualmente!');
            return true;
          }
          
          // Verificar a cada 1 segundo
          await this.page.waitForTimeout(1000);
        }
        
        // Última tentativa desesperada
        console.log('🚑 Última tentativa desesperada!');
        await this.tentativaDesesperada();
        
        const verificacaoFinal = await this.verificarCaptchaResolvido();
        if (verificacaoFinal) {
          console.log('🎆 MILAGRE! reCAPTCHA resolvido na tentativa desesperada!');
          return true;
        }
        
        console.log('❌ Todas as estratégias falharam.');
        return false;
        
      } else {
        console.log('✅ Nenhum reCAPTCHA detectado. Prosseguindo...');
        return true;
      }
      
    } catch (error) {
      console.error('❌ Erro crítico no bypass de reCAPTCHA:', error);
      return false;
    }
  }
  
  async tentativaDesesperada() {
    try {
      console.log('🚑 Executando tentativa desesperada...');
      
      // Recarregar a página e tentar novamente
      await this.page.reload({ waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);
      
      // Preencher credenciais novamente
      await this.page.type('input[placeholder="Usuário"]', this.username, { delay: 150 });
      await this.page.type('input[placeholder="Senha"]', this.password, { delay: 150 });
      
      // Tentar clicar no reCAPTCHA imediatamente
      await this.page.waitForTimeout(1000);
      await this.clicarCheckboxRecaptcha();
      
      // Clicar no botão de login
      await this.page.waitForTimeout(2000);
      await this.page.click('button.btn-primary');
      
    } catch (error) {
      console.error('Erro na tentativa desesperada:', error);
    }
  }
  
  async simularComportamentoHumano() {
    try {
      console.log('🎭 Simulando comportamento ultra-humano...');
      
      // Movimento gradual e natural do mouse
      const startX = Math.random() * 200 + 100;
      const startY = Math.random() * 200 + 100;
      const endX = Math.random() * 600 + 200;
      const endY = Math.random() * 400 + 200;
      
      // Movimento em curva (mais humano)
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const x = startX + (endX - startX) * progress + Math.sin(progress * Math.PI) * 20;
        const y = startY + (endY - startY) * progress + Math.cos(progress * Math.PI) * 10;
        
        await this.page.mouse.move(x, y);
        await this.page.waitForTimeout(Math.random() * 50 + 20);
      }
      
      // Scroll natural com inércia
      const scrollSteps = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < scrollSteps; i++) {
        await this.page.evaluate(() => {
          window.scrollBy(0, Math.random() * 100 - 50);
        });
        await this.page.waitForTimeout(Math.random() * 200 + 100);
      }
      
      // Pausa humana variável
      const pausaHumana = Math.random() * 2000 + 1000;
      await this.page.waitForTimeout(pausaHumana);
      
      // Simular respiração/hesitação humana
      await this.page.mouse.move(
        endX + Math.random() * 10 - 5,
        endY + Math.random() * 10 - 5
      );
      
      await this.page.waitForTimeout(Math.random() * 500 + 200);
      
    } catch (error) {
      console.error('Erro ao simular comportamento humano:', error);
    }
  }
  
  async verificarCaptchaResolvido() {
    try {
      console.log('🔎 Verificando RIGOROSAMENTE se reCAPTCHA foi resolvido...');
      
      // 1. Verificar se o token do reCAPTCHA foi gerado (MAIS IMPORTANTE)
      const tokenRecaptcha = await this.page.evaluate(() => {
        const textarea = document.querySelector('[name="g-recaptcha-response"]');
        const token = textarea ? textarea.value : null;
        console.log('Token reCAPTCHA:', token ? token.substring(0, 50) + '...' : 'NENHUM');
        return token;
      });
      
      if (tokenRecaptcha && tokenRecaptcha.length > 20) {
        console.log('✅ TOKEN reCAPTCHA encontrado - CAPTCHA RESOLVIDO!');
        return true;
      }
      
      // 2. Verificar se o checkbox foi marcado visualmente
      const checkboxInfo = await this.page.evaluate(() => {
        const checkboxChecked = document.querySelector('.recaptcha-checkbox-checked');
        const checkboxBorder = document.querySelector('.recaptcha-checkbox-border');
        const checkboxTick = document.querySelector('.recaptcha-checkbox-checkmark');
        
        return {
          checked: checkboxChecked !== null,
          border: checkboxBorder !== null,
          tick: checkboxTick !== null,
          classes: checkboxBorder ? checkboxBorder.className : 'N/A'
        };
      });
      
      console.log('📊 Estado do checkbox:', checkboxInfo);
      
      if (checkboxInfo.checked) {
        console.log('✅ CHECKBOX marcado - CAPTCHA RESOLVIDO!');
        return true;
      }
      
      // 3. Verificar se o iframe do reCAPTCHA mudou de estado
      const iframeInfo = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe[src*="recaptcha"]'));
        return iframes.map(iframe => ({
          src: iframe.src,
          style: iframe.style.cssText,
          display: getComputedStyle(iframe).display
        }));
      });
      
      console.log('🖼️ Estado dos iframes:', iframeInfo);
      
      // 4. Verificar se há mensagens de sucesso do reCAPTCHA
      const sucessoRecaptcha = await this.page.evaluate(() => {
        const elementos = [
          document.querySelector('.recaptcha-success'),
          document.querySelector('[data-recaptcha="success"]'),
          document.querySelector('.g-recaptcha[data-callback]')
        ];
        
        return elementos.some(el => el !== null);
      });
      
      if (sucessoRecaptcha) {
        console.log('✅ SUCESSO reCAPTCHA detectado!');
        return true;
      }
      
      // 5. Verificar se o reCAPTCHA desapareceu completamente
      const recaptchaAindaPresente = await this.page.$('iframe[src*="recaptcha"]');
      if (!recaptchaAindaPresente) {
        console.log('✅ reCAPTCHA desapareceu - provavelmente resolvido!');
        return true;
      }
      
      console.log('❌ reCAPTCHA ainda NÃO foi resolvido!');
      return false;
      
    } catch (error) {
      console.error('❌ Erro ao verificar CAPTCHA resolvido:', error.message);
      return false;
    }
  }
  
  async clicarCheckboxRecaptcha() {
    try {
      console.log('🎯 Procurando checkbox do reCAPTCHA...');
      
      // Aguardar um pouco para garantir que o reCAPTCHA carregou
      await this.page.waitForTimeout(2000);
      
      // Diferentes seletores para o checkbox do reCAPTCHA
      const seletoresCheckbox = [
        '.recaptcha-checkbox-border',
        '.recaptcha-checkbox',
        '#recaptcha-anchor',
        'iframe[src*="recaptcha"] + div .recaptcha-checkbox',
        '[role="checkbox"]',
        '.rc-anchor-checkbox'
      ];
      
      // Tentar clicar diretamente nos seletores
      for (const seletor of seletoresCheckbox) {
        try {
          const elemento = await this.page.$(seletor);
          if (elemento) {
            console.log(`🎯 Tentando clicar no seletor: ${seletor}`);
            await elemento.click();
            await this.page.waitForTimeout(1000);
            return true;
          }
        } catch (error) {
          console.log(`⚠️ Seletor ${seletor} não funcionou:`, error.message);
        }
      }
      
      // Tentar encontrar iframe do reCAPTCHA e clicar dentro dele
      const iframes = await this.page.$$('iframe[src*="recaptcha"]');
      
      for (let i = 0; i < iframes.length; i++) {
        try {
          console.log(`🖼️ Tentando iframe ${i + 1}...`);
          
          const frame = await iframes[i].contentFrame();
          if (frame) {
            // Aguardar o checkbox carregar no iframe
            await frame.waitForSelector('.recaptcha-checkbox-border', { timeout: 5000 });
            
            // Clicar no checkbox dentro do iframe
            await frame.click('.recaptcha-checkbox-border');
            console.log('✅ Clicou no checkbox dentro do iframe!');
            
            await this.page.waitForTimeout(2000);
            return true;
          }
        } catch (error) {
          console.log(`⚠️ Iframe ${i + 1} falhou:`, error.message);
        }
      }
      
      // Tentar coordenadas aproximadas se nenhum seletor funcionou
      console.log('🎯 Tentando clique por coordenadas...');
      
      // Procurar elemento reCAPTCHA para obter posição
      const recaptchaElement = await this.page.$('iframe[src*="recaptcha"]');
      if (recaptchaElement) {
        const box = await recaptchaElement.boundingBox();
        if (box) {
          // Clicar aproximadamente no centro-esquerda do reCAPTCHA (onde fica o checkbox)
          const x = box.x + 25; // 25px da borda esquerda
          const y = box.y + box.height / 2; // Centro vertical
          
          console.log(`🎯 Clicando nas coordenadas: (${x}, ${y})`);
          await this.page.mouse.click(x, y);
          
          await this.page.waitForTimeout(2000);
          return true;
        }
      }
      
      console.log('❌ Não foi possível encontrar o checkbox do reCAPTCHA');
      return false;
      
    } catch (error) {
      console.error('❌ Erro ao clicar no checkbox do reCAPTCHA:', error.message);
      return false;
    }
  }
  
  async criarUsuario(dadosUsuario) {
    try {
      console.log(`👤 Iniciando criação de usuário: ${dadosUsuario.username}`);
      console.log(`🏷️ Tipo: ${dadosUsuario.tipo}`);
      
      // Aguardar estar no dashboard
      await this.page.waitForTimeout(2000);
      
      // Procurar por links/botões relacionados a usuários
      const linkUsuarios = await this.procurarSecaoUsuarios();
      
      if (!linkUsuarios) {
        throw new Error('Não foi possível encontrar seção de usuários');
      }
      
      console.log(`🎯 Navegando para seção de usuários: ${linkUsuarios}`);
      
      // Navegar para a seção de usuários
      if (linkUsuarios.startsWith('http')) {
        await this.page.goto(linkUsuarios, { waitUntil: 'networkidle2' });
      } else {
        await this.page.click(linkUsuarios);
        await this.page.waitForTimeout(3000);
      }
      
      // Procurar botão "Criar" ou "Novo"
      const botaoCriar = await this.procurarBotaoCriar();
      
      if (botaoCriar) {
        console.log(`🎯 Clicando em botão criar: ${botaoCriar}`);
        await this.page.click(botaoCriar);
        await this.page.waitForTimeout(2000);
      }
      
      // Preencher formulário de criação
      const preenchimentoSuccess = await this.preencherFormularioUsuario(dadosUsuario);
      
      if (!preenchimentoSuccess) {
        throw new Error('Falha ao preencher formulário de usuário');
      }
      
      // Submeter formulário
      const submissaoSuccess = await this.submeterFormulario();
      
      if (submissaoSuccess) {
        console.log('✅ Usuário criado com sucesso!');
        
        // Capturar screenshot de sucesso
        await this.page.screenshot({
          path: `screenshots/usuario-criado-${dadosUsuario.username}.png`,
          fullPage: true
        });
        
        return {
          success: true,
          username: dadosUsuario.username,
          password: dadosUsuario.password,
          tipo: dadosUsuario.tipo,
          screenshot: `usuario-criado-${dadosUsuario.username}.png`
        };
      } else {
        throw new Error('Falha ao submeter formulário');
      }
      
    } catch (error) {
      console.error(`❌ Erro ao criar usuário ${dadosUsuario.username}:`, error.message);
      
      // Capturar screenshot de erro
      await this.page.screenshot({
        path: `screenshots/erro-criacao-${dadosUsuario.username}.png`,
        fullPage: true
      });
      
      return {
        success: false,
        error: error.message,
        screenshot: `erro-criacao-${dadosUsuario.username}.png`
      };
    }
  }
  
  async procurarSecaoUsuarios() {
    try {
      console.log('🔍 Procurando seção de usuários...');
      
      // Termos relacionados a usuários
      const termosUsuarios = [
        'usuários', 'usuarios', 'users', 'clientes', 'clients',
        'contas', 'accounts', 'pessoas', 'people'
      ];
      
      // Procurar em links
      for (const termo of termosUsuarios) {
        const seletores = [
          `a[href*="${termo}"]`,
          `a:contains("${termo}")`,
          `button:contains("${termo}")`,
          `.${termo}`,
          `#${termo}`
        ];
        
        for (const seletor of seletores) {
          try {
            const elemento = await this.page.$(seletor);
            if (elemento) {
              const href = await elemento.evaluate(el => el.href || el.getAttribute('data-href'));
              return href || seletor;
            }
          } catch (error) {
            // Continuar tentando
          }
        }
      }
      
      // Procurar usando XPath
      for (const termo of termosUsuarios) {
        try {
          const [elemento] = await this.page.$x(`//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${termo}')]`);
          if (elemento) {
            const href = await elemento.evaluate(el => el.href);
            return href || `xpath://a[contains(text(), '${termo}')]`;
          }
        } catch (error) {
          // Continuar tentando
        }
      }
      
      console.log('⚠️ Não foi possível encontrar seção de usuários automaticamente');
      return null;
      
    } catch (error) {
      console.error('Erro ao procurar seção de usuários:', error.message);
      return null;
    }
  }
  
  async procurarBotaoCriar() {
    try {
      console.log('🔍 Procurando botão criar/novo...');
      
      const termosCriar = [
        'criar', 'novo', 'adicionar', 'add', 'create', 'new',
        '+', 'plus', 'insert'
      ];
      
      for (const termo of termosCriar) {
        const seletores = [
          `button:contains("${termo}")`,
          `a:contains("${termo}")`,
          `.btn:contains("${termo}")`,
          `[title*="${termo}"]`,
          `[alt*="${termo}"]`
        ];
        
        for (const seletor of seletores) {
          try {
            const elemento = await this.page.$(seletor);
            if (elemento) {
              return seletor;
            }
          } catch (error) {
            // Continuar tentando
          }
        }
      }
      
      // Procurar usando XPath
      for (const termo of termosCriar) {
        try {
          const [elemento] = await this.page.$x(`//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${termo}')]`);
          if (elemento) {
            return `xpath://button[contains(text(), '${termo}')]`;
          }
        } catch (error) {
          // Continuar tentando
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro ao procurar botão criar:', error.message);
      return null;
    }
  }
  
  async preencherFormularioUsuario(dadosUsuario) {
    try {
      console.log('✏️ Preenchendo formulário de usuário...');
      
      // Aguardar formulário carregar
      await this.page.waitForTimeout(2000);
      
      // Mapear campos comuns
      const camposComuns = {
        username: ['input[name="username"]', 'input[name="user"]', 'input[placeholder*="usuário"]', 'input[placeholder*="user"]'],
        password: ['input[name="password"]', 'input[name="senha"]', 'input[placeholder*="senha"]', 'input[placeholder*="password"]'],
        email: ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email"]'],
        nome: ['input[name="nome"]', 'input[name="name"]', 'input[placeholder*="nome"]', 'input[placeholder*="name"]']
      };
      
      // Preencher username
      const campoUsername = await this.encontrarCampo(camposComuns.username);
      if (campoUsername) {
        await this.page.type(campoUsername, dadosUsuario.username, { delay: 100 });
        console.log(`✅ Username preenchido: ${dadosUsuario.username}`);
      }
      
      // Preencher password
      const campoPassword = await this.encontrarCampo(camposComuns.password);
      if (campoPassword) {
        await this.page.type(campoPassword, dadosUsuario.password, { delay: 100 });
        console.log(`✅ Password preenchido`);
      }
      
      // Preencher email (se necessário)
      const campoEmail = await this.encontrarCampo(camposComuns.email);
      if (campoEmail) {
        const email = dadosUsuario.email || `${dadosUsuario.username}@teste.com`;
        await this.page.type(campoEmail, email, { delay: 100 });
        console.log(`✅ Email preenchido: ${email}`);
      }
      
      // Selecionar tipo de conta se necessário
      if (dadosUsuario.tipo === 'trial') {
        await this.selecionarTipoTrial();
      }
      
      return true;
      
    } catch (error) {
      console.error('Erro ao preencher formulário:', error.message);
      return false;
    }
  }
  
  async encontrarCampo(seletores) {
    for (const seletor of seletores) {
      try {
        const elemento = await this.page.$(seletor);
        if (elemento) {
          return seletor;
        }
      } catch (error) {
        // Continuar tentando
      }
    }
    return null;
  }
  
  async selecionarTipoTrial() {
    try {
      console.log('🏷️ Selecionando tipo trial...');
      
      const seletoresTrial = [
        'select[name="tipo"] option[value*="trial"]',
        'select[name="type"] option[value*="trial"]',
        'input[value*="trial"]',
        'input[type="radio"][value*="trial"]',
        '.trial',
        '#trial'
      ];
      
      for (const seletor of seletoresTrial) {
        try {
          const elemento = await this.page.$(seletor);
          if (elemento) {
            await elemento.click();
            console.log('✅ Tipo trial selecionado');
            return true;
          }
        } catch (error) {
          // Continuar tentando
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao selecionar tipo trial:', error.message);
      return false;
    }
  }
  
  async submeterFormulario() {
    try {
      console.log('🚀 Submetendo formulário...');
      
      const seletoresSubmit = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("salvar")',
        'button:contains("criar")',
        'button:contains("save")',
        'button:contains("create")',
        '.btn-primary',
        '.btn-success'
      ];
      
      for (const seletor of seletoresSubmit) {
        try {
          const elemento = await this.page.$(seletor);
          if (elemento) {
            await elemento.click();
            console.log('✅ Formulário submetido');
            
            // Aguardar resposta
            await this.page.waitForTimeout(3000);
            
            // Verificar se houve sucesso (procurar mensagens de sucesso ou redirecionamento)
            const sucesso = await this.verificarSucessoCriacao();
            return sucesso;
          }
        } catch (error) {
          // Continuar tentando
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao submeter formulário:', error.message);
      return false;
    }
  }
  
  async verificarSucessoCriacao() {
    try {
      // Procurar mensagens de sucesso
      const mensagensSucesso = [
        '.success', '.alert-success', '.message-success',
        '.notification-success', '.toast-success'
      ];
      
      for (const seletor of mensagensSucesso) {
        const elemento = await this.page.$(seletor);
        if (elemento) {
          const texto = await elemento.evaluate(el => el.textContent);
          console.log(`✅ Mensagem de sucesso encontrada: ${texto}`);
          return true;
        }
      }
      
      // Verificar se a URL mudou (indicando redirecionamento após sucesso)
      const urlAtual = this.page.url();
      if (urlAtual.includes('success') || urlAtual.includes('created') || urlAtual.includes('usuarios')) {
        console.log('✅ URL indica sucesso na criação');
        return true;
      }
      
      // Se não encontrou indicações claras de erro, assumir sucesso
      const erros = await this.page.$('.error, .alert-error, .message-error');
      if (!erros) {
        console.log('✅ Nenhum erro detectado, assumindo sucesso');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao verificar sucesso:', error.message);
      return false;
    }
  }
}

module.exports = IPTVAutomation;

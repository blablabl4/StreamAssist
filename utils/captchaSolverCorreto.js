require('dotenv').config();
const axios = require('axios');

// Helper fora da classe para checar visualmente o checkbox dentro do iframe
async function waitForRecaptchaChecked(page, { timeout = 10000 } = {}) {
  try {
    console.log('🔎 Verificando estado visual do checkbox no iframe do reCAPTCHA...');

    const iframeHandle = await page.$('iframe[src*="recaptcha"][src*="anchor"]');
    if (!iframeHandle) {
      console.log('⚠️ Iframe do checkbox não encontrado na página principal');
    } else {
      await iframeHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    }

    const anchorFrame = page.frames().find(f => {
      try { return f.url().includes('recaptcha') && f.url().includes('anchor'); } catch { return false; }
    });

    const waitForCheckedInFrame = async () => {
      if (!anchorFrame) return false;
      try {
        await anchorFrame.waitForSelector('#recaptcha-anchor', { timeout: 5000 });
        await anchorFrame.waitForFunction(() => {
          const el = document.querySelector('#recaptcha-anchor');
          if (!el) return false;
          const aria = el.getAttribute('aria-checked');
          const hasClass = el.classList.contains('recaptcha-checkbox-checked');
          return aria === 'true' || hasClass;
        }, { timeout });
        return true;
      } catch {
        return false;
      }
    };

    let checked = await waitForCheckedInFrame();

    if (!checked && iframeHandle) {
      try {
        console.log('🖱️ Tentando clique por coordenadas no iframe do checkbox...');
        const box = await iframeHandle.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + Math.min(18, box.height / 2);
          await page.mouse.move(x, y);
          await page.waitForTimeout(200);
          await page.mouse.click(x, y, { delay: 80 });
          await page.waitForTimeout(1200);
          checked = await waitForCheckedInFrame();
        }
      } catch (e) {
        console.log('⚠️ Falha no clique por coordenadas:', e.message);
      }
    }

    if (!checked) {
      console.log('⚠️ Não foi possível confirmar verificação visual do checkbox no tempo limite');
    } else {
      console.log('✅ Checkbox marcado visualmente dentro do iframe!');
    }

    return checked;
  } catch (error) {
    console.log('⚠️ Erro ao verificar checkbox no iframe:', error.message);
    return false;
  }
}

class CaptchaSolverCorreto {
  constructor() {
    this.apiKey = process.env.CAPTCHA_2CAPTCHA_KEY;
    this.baseUrl = 'https://api.2captcha.com';
    
    if (!this.apiKey) {
      throw new Error('CAPTCHA_2CAPTCHA_KEY não encontrada no arquivo .env');
    }
  }

  /**
   * Extrai a site key do reCAPTCHA da página
   */
  async extractSiteKey(page) {
    try {
      console.log('🔍 Extraindo site key do reCAPTCHA...');
      
      const siteKey = await page.evaluate(() => {
        // Método 1: Procurar no atributo data-sitekey
        const recaptchaDiv = document.querySelector('.g-recaptcha');
        if (recaptchaDiv && recaptchaDiv.getAttribute('data-sitekey')) {
          return recaptchaDiv.getAttribute('data-sitekey');
        }
        
        // Método 2: Procurar em iframes
        const iframes = document.querySelectorAll('iframe[src*="recaptcha"]');
        for (const iframe of iframes) {
          const src = iframe.src;
          const match = src.match(/k=([^&]+)/);
          if (match) {
            return match[1];
          }
        }
        
        return null;
      });
      
      if (siteKey) {
        console.log('✅ Site key encontrada:', siteKey);
        return siteKey;
      } else {
        throw new Error('Site key não encontrada na página');
      }
    } catch (error) {
      console.error('❌ Erro ao extrair site key:', error.message);
      throw error;
    }
  }

  /**
   * Cria uma task no 2captcha para resolver reCAPTCHA v2
   */
  async createTask(siteKey, pageUrl) {
    try {
      console.log('📝 Criando task no 2captcha...');
      console.log('   - Site Key:', siteKey);
      console.log('   - Page URL:', pageUrl);
      
      const taskData = {
        clientKey: this.apiKey,
        task: {
          type: 'RecaptchaV2TaskProxyless',
          websiteURL: pageUrl,
          websiteKey: siteKey
        }
      };
      
      const response = await axios.post(`${this.baseUrl}/createTask`, taskData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (response.data.errorId === 0) {
        console.log('✅ Task criada com sucesso! ID:', response.data.taskId);
        return response.data.taskId;
      } else {
        throw new Error(`Erro na criação da task: ${response.data.errorDescription}`);
      }
    } catch (error) {
      console.error('❌ Erro ao criar task:', error.message);
      throw error;
    }
  }

  /**
   * Aguarda a resolução da task no 2captcha
   */
  async waitForSolution(taskId) {
    try {
      console.log('⏳ Aguardando resolução do reCAPTCHA...');
      const maxAttempts = 40;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Verificação ${attempts}/${maxAttempts}...`);
        
        const response = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId: taskId
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });
        
        if (response.data.errorId === 0) {
          if (response.data.status === 'ready') {
            console.log('✅ reCAPTCHA resolvido com sucesso!');
            console.log('💰 Custo:', response.data.cost);
            return response.data.solution.gRecaptchaResponse;
          } else if (response.data.status === 'processing') {
            console.log('⏳ Ainda processando... aguardando 5 segundos');
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            throw new Error(`Status inesperado: ${response.data.status}`);
          }
        } else {
          throw new Error(`Erro na verificação: ${response.data.errorDescription}`);
        }
      }
      
      throw new Error('Timeout: reCAPTCHA não foi resolvido no tempo esperado');
    } catch (error) {
      console.error('❌ Erro ao aguardar solução:', error.message);
      throw error;
    }
  }

  /**
   * INJEÇÃO OTIMIZADA - VERSÃO FINAL MELHORADA
   * Versão mais robusta fornecida pelo usuário
   */
  async injectSolutionCorrect(page, token) {
    console.log('💉 Injetando token com método OTIMIZADO (versão final)...');
    
    return await page.evaluate((token) => {
      try {
        // 1. Campo hidden
        const textarea = document.getElementById('g-recaptcha-response');
        if (!textarea) return { success: false, error: 'Campo g-recaptcha-response não encontrado' };
        textarea.value = token;

        // 2. Dispara eventos
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        // 3. Atualiza internamente o grecaptcha
        if (typeof grecaptcha !== 'undefined') {
          // Pega o ID do widget do checkbox (normalmente 0, mas pode variar)
          const widgetId = grecaptcha.render ? 0 : Object.keys(window.___grecaptcha_cfg.clients)[0];
          
          // Força o getResponse() retornar o token
          grecaptcha.getResponse = () => token;

          // Procura o callback no cliente interno
          const clients = Object.values(window.___grecaptcha_cfg.clients);
          for (const client of clients) {
            const cb = client?.callback || client?.O?.callback || client?.$?.callback;
            if (typeof cb === 'function') {
              cb(token); // dispara como se o usuário tivesse resolvido
            }
          }
        }

        return { success: true, tokenLength: token.length };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, token);
  }

  /**
   * Clica no botão de login
   */
  async clickLoginButton(page) {
    try {
      console.log('🖱️ Clicando no botão de login...');
      
      // Aguardar um pouco para garantir que a validação foi processada
      await page.waitForTimeout(2000);
      
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        
        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase().trim();
          
          if (text.includes('logar') || 
              text.includes('login') || 
              text.includes('entrar') ||
              button.type === 'submit') {
            
            console.log('🎯 Botão encontrado:', text || button.type);
            button.click();
            return { success: true, text: text || button.type };
          }
        }
        
        return { success: false };
      });
      
      if (clicked.success) {
        console.log(`✅ Botão clicado: ${clicked.text}`);
        await page.waitForTimeout(3000);
        return true;
      } else {
        console.log('❌ Botão não encontrado');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro no clique do botão:', error.message);
      return false;
    }
  }

  /**
   * MÉTODO PRINCIPAL CORRIGIDO - Resolve captcha e faz login
   */
  async solveAndLoginCorrect(page, pageUrl = null) {
    try {
      console.log('🚀 INICIANDO AUTOMAÇÃO COM MÉTODO CORRETO');
      console.log('==========================================');
      
      if (!pageUrl) {
        pageUrl = page.url();
      }
      
      // 1. Extrair site key
      const siteKey = await this.extractSiteKey(page);
      
      // 2. Criar task no 2captcha
      const taskId = await this.createTask(siteKey, pageUrl);
      
      // 3. Aguardar solução
      const solution = await this.waitForSolution(taskId);
      
      // 4. Injetar solução com método CORRETO
      const injected = await this.injectSolutionCorrect(page, solution);
      
      if (!injected || !injected.success) {
        throw new Error('Falha na injeção correta da solução');
      }

      console.log('✅ Token injetado com sucesso!');
      await page.waitForTimeout(1000);

      // 5. Clique por coordenadas no checkbox (método que funcionou!)
      console.log('🎯 Executando clique por coordenadas no checkbox...');
      
      const iframePosition = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha/api2/anchor"]');
        if (iframe) {
          const rect = iframe.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            found: true
          };
        }
        return { found: false };
      });

      if (iframePosition.found) {
        const checkboxX = iframePosition.x + 15;
        const checkboxY = iframePosition.y + (iframePosition.height / 2);
        
        console.log(`🎯 Clicando nas coordenadas: (${checkboxX}, ${checkboxY})`);
        await page.mouse.click(checkboxX, checkboxY);
        await page.waitForTimeout(2000);
        console.log('✅ Clique no checkbox executado!');
      } else {
        console.log('⚠️ Iframe não encontrado, mas continuando...');
      }

      // 6. Garantir verificação visual (no iframe) e que o grecaptcha tem resposta
      console.log('⏳ Aguardando verificação visual do reCAPTCHA (iframe)...');
      await waitForRecaptchaChecked(page, { timeout: 10000 });

      // Espera até que grecaptcha.getResponse() esteja preenchido na página host
      await page.waitForFunction(() => {
        try {
          return typeof grecaptcha !== 'undefined' &&
                 typeof grecaptcha.getResponse === 'function' &&
                 (grecaptcha.getResponse() || '').length > 0;
        } catch (_) {
          return false;
        }
      }, { timeout: 5000 }).catch(() => console.log('⚠️ Timeout esperando grecaptcha.getResponse()'));

      // Pequeno delay extra para garantir processamento
      await page.waitForTimeout(800);

      // 6. Clicar no botão de login somente após verificação visual
      const loginClicked = await this.clickLoginButton(page);
      
      // 6. Aguardar e verificar resultado
      await page.waitForTimeout(5000);
      
      const currentUrl = page.url();
      const success = !currentUrl.includes('login');
      
      console.log('\n🎊 RESULTADO FINAL:');
      console.log('==================');
      console.log(`📍 URL atual: ${currentUrl}`);
      console.log(`🎯 Status: ${success ? '✅ SUCESSO!' : '⚠️ Ainda na página de login'}`);
      
      return success;
      
    } catch (error) {
      console.error('💥 Erro no processo completo:', error.message);
      return false;
    }
  }

  /**
   * Verifica o saldo da conta 2captcha
   */
  async checkBalance() {
    try {
      const response = await axios.post(`${this.baseUrl}/getBalance`, {
        clientKey: this.apiKey
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      if (response.data.errorId === 0) {
        return response.data.balance;
      } else {
        throw new Error(`Erro ao verificar saldo: ${response.data.errorDescription}`);
      }
    } catch (error) {
      console.error('❌ Erro ao verificar saldo:', error.message);
      throw error;
    }
  }
}

module.exports = CaptchaSolverCorreto;

require('dotenv').config();
const axios = require('axios');

class CaptchaSolverFinal {
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
   * MÉTODO FINAL OTIMIZADO - Injeta solução e executa validação completa
   */
  async injectAndValidate(page, solution) {
    try {
      console.log('💉 Injetando solução e executando validação COMPLETA...');
      
      // 1. Injetar token no campo response
      const injectionResult = await page.evaluate((token) => {
        const responseField = document.getElementById('g-recaptcha-response');
        if (responseField) {
          responseField.value = token;
          responseField.style.display = 'block';
          
          // Disparar eventos essenciais
          ['input', 'change'].forEach(eventType => {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            responseField.dispatchEvent(event);
          });
          
          // Executar callbacks do grecaptcha se disponíveis
          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients && window.___grecaptcha_cfg.clients[0]) {
            const client = window.___grecaptcha_cfg.clients[0];
            if (client.callback && typeof client.callback === 'function') {
              client.callback(token);
            }
          }
          
          return true;
        }
        return false;
      }, solution);

      if (!injectionResult) {
        throw new Error('Falha na injeção do token');
      }

      console.log('✅ Token injetado com sucesso!');
      await page.waitForTimeout(1000);

      // 2. Clique por coordenadas no checkbox (método que funcionou!)
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

      return true;
      
    } catch (error) {
      console.error('❌ Erro na injeção e validação:', error.message);
      return false;
    }
  }

  /**
   * Clica no botão de login de forma otimizada
   */
  async clickLoginButton(page) {
    try {
      console.log('🖱️ Executando clique otimizado no botão de login...');
      
      // Aguardar um pouco para garantir que tudo foi processado
      await page.waitForTimeout(1500);
      
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        
        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase().trim();
          
          if (text.includes('logar') || 
              text.includes('login') || 
              text.includes('entrar') ||
              button.type === 'submit') {
            
            // Clique duplo para garantir
            button.click();
            setTimeout(() => button.click(), 100);
            
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
   * MÉTODO PRINCIPAL - Resolve captcha e faz login (VERSÃO FINAL OTIMIZADA)
   */
  async solveAndLogin(page, pageUrl = null) {
    try {
      console.log('🚀 INICIANDO AUTOMAÇÃO COMPLETA - VERSÃO FINAL');
      console.log('===============================================');
      
      if (!pageUrl) {
        pageUrl = page.url();
      }
      
      // Limpar cookies e sessão para evitar conflitos
      await page.deleteCookie(...(await page.cookies()));
      
      // 1. Extrair site key
      const siteKey = await this.extractSiteKey(page);
      
      // 2. Criar task no 2captcha
      const taskId = await this.createTask(siteKey, pageUrl);
      
      // 3. Aguardar solução
      const solution = await this.waitForSolution(taskId);
      
      // 4. Injetar solução E validar (método otimizado)
      const injected = await this.injectAndValidate(page, solution);
      
      if (!injected) {
        throw new Error('Falha na injeção e validação');
      }
      
      // 5. Clicar no botão de login
      const loginClicked = await this.clickLoginButton(page);
      
      // 6. Aguardar resultado
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

module.exports = CaptchaSolverFinal;

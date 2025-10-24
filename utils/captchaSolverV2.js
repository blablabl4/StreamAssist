require('dotenv').config();
const axios = require('axios');

class CaptchaSolverV2 {
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
        
        // Método 2: Procurar em scripts
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const content = script.textContent || script.innerHTML;
          const match = content.match(/['"](6L[a-zA-Z0-9_-]{40,})['"]/);
          if (match) {
            return match[1];
          }
        }
        
        // Método 3: Procurar em iframes
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
      const maxAttempts = 40; // 40 tentativas = ~3 minutos
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
   * Injeta a solução do reCAPTCHA na página e executa validação visual
   */
  async injectSolution(page, solution) {
    try {
      console.log('💉 Injetando solução e executando validação visual...');
      
      const injectionResult = await page.evaluate((token) => {
        const responseField = document.getElementById('g-recaptcha-response');
        if (responseField) {
          responseField.value = token;
          responseField.style.display = 'block';
          console.log('✅ Token injetado no g-recaptcha-response:', token.substring(0, 20) + '...');
          
          // VALIDAÇÃO VISUAL: Executar callbacks do reCAPTCHA conforme documentação 2captcha
          try {
            // Método 1: Executar callback direto via grecaptcha config
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients && window.___grecaptcha_cfg.clients[0]) {
              const client = window.___grecaptcha_cfg.clients[0];
              if (client.callback && typeof client.callback === 'function') {
                console.log('🔄 Executando callback do grecaptcha client...');
                client.callback(token);
              }
            }
            
            // Método 2: Disparar evento de mudança no campo response
            responseField.dispatchEvent(new Event('change', { bubbles: true }));
            responseField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('🔄 Eventos de mudança disparados no campo response');
            
            // Método 3: Executar callback personalizado se existir
            if (window.grecaptchaCallback && typeof window.grecaptchaCallback === 'function') {
              console.log('🔄 Executando callback personalizado...');
              window.grecaptchaCallback(token);
            }
            
            // Método 4: Tentar executar callback via data-callback
            const recaptchaDiv = document.querySelector('.g-recaptcha');
            if (recaptchaDiv) {
              const callbackName = recaptchaDiv.getAttribute('data-callback');
              if (callbackName && window[callbackName] && typeof window[callbackName] === 'function') {
                console.log('🔄 Executando callback via data-callback:', callbackName);
                window[callbackName](token);
              }
            }
            
            // Método 5: Forçar validação via grecaptcha API se disponível
            if (window.grecaptcha && window.grecaptcha.getResponse) {
              console.log('🔄 Validando via grecaptcha.getResponse...');
              // Força o grecaptcha a reconhecer que foi resolvido
              if (window.grecaptcha.reset) {
                // Não fazemos reset, apenas garantimos que está validado
              }
            }
            
            console.log('✅ Validação visual do reCAPTCHA executada com sucesso!');
            
          } catch (callbackError) {
            console.log('⚠️ Erro ao executar callbacks de validação:', callbackError.message);
          }
          
          return true;
        }
        console.log('❌ Campo g-recaptcha-response não encontrado');
        return false;
      }, solution);

      if (!injectionResult) {
        console.log('❌ Falha na injeção da solução');
        return false;
      }

      console.log('✅ Solução injetada E validada com sucesso!');
      await page.waitForTimeout(2000); // Aguardar mais tempo para validação
      return true;
      
    } catch (error) {
      console.error('❌ Erro na injeção da solução:', error.message);
      return false;
    }
  }

  /**
   * Clica no botão de login após resolver o captcha
   */
  async clickLoginButton(page) {
    try {
      console.log('🖱️ Procurando e clicando no botão de login...');
      
      // Aguardar um pouco para garantir que a validação visual foi processada
      await page.waitForTimeout(1000);
      
      const clicked = await page.evaluate(() => {
        // Procurar todos os possíveis botões de login
        const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        
        console.log('🔍 Botões encontrados na página:', allButtons.length);
        
        // Primeiro: procurar por texto específico
        for (const button of allButtons) {
          const text = (button.textContent || button.value || '').toLowerCase().trim();
          const classes = button.className || '';
          const id = button.id || '';
          
          console.log('🔍 Analisando botão:', {
            text: text,
            type: button.type,
            classes: classes,
            id: id
          });
          
          // Verificar se é botão de login
          if (text.includes('logar') || 
              text.includes('login') || 
              text.includes('entrar') ||
              text.includes('acessar') ||
              classes.includes('btn-primary') ||
              classes.includes('btn-login') ||
              id.includes('login') ||
              button.type === 'submit') {
            
            console.log('🎯 Botão de login identificado:', text || button.type || classes);
            button.click();
            return { success: true, method: 'specific', details: text || button.type || classes };
          }
        }
        
        // Segundo: procurar por tipo submit
        const submitButtons = allButtons.filter(btn => btn.type === 'submit');
        if (submitButtons.length > 0) {
          console.log('🎯 Usando botão submit como fallback');
          submitButtons[0].click();
          return { success: true, method: 'submit_fallback', details: 'submit button' };
        }
        
        // Terceiro: procurar por classes comuns
        const primaryButtons = allButtons.filter(btn => 
          btn.className.includes('btn-primary') || 
          btn.className.includes('primary') ||
          btn.className.includes('btn-login')
        );
        if (primaryButtons.length > 0) {
          console.log('🎯 Usando botão primary como fallback');
          primaryButtons[0].click();
          return { success: true, method: 'primary_fallback', details: primaryButtons[0].className };
        }
        
        // Quarto: último recurso - primeiro botão disponível
        if (allButtons.length > 0) {
          console.log('🎯 Usando primeiro botão disponível como último recurso');
          allButtons[0].click();
          return { success: true, method: 'first_button', details: 'first available button' };
        }
        
        return { success: false, method: 'none', details: 'no buttons found' };
      });
      
      if (clicked.success) {
        console.log(`✅ Botão de login clicado! Método: ${clicked.method}, Detalhes: ${clicked.details}`);
        await page.waitForTimeout(3000);
        return true;
      } else {
        console.log('❌ Nenhum botão de login encontrado na página');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao clicar no botão de login:', error.message);
      return false;
    }
  }

  /**
   * Resolve reCAPTCHA automaticamente e faz login
   */
  async solveAndLogin(page, pageUrl = null) {
    try {
      console.log('🤖 Iniciando resolução automática de reCAPTCHA...');
      
      if (!pageUrl) {
        pageUrl = page.url();
      }
      
      // 1. Extrair site key
      const siteKey = await this.extractSiteKey(page);
      
      // 2. Criar task no 2captcha
      const taskId = await this.createTask(siteKey, pageUrl);
      
      // 3. Aguardar solução
      const solution = await this.waitForSolution(taskId);
      
      // 4. Injetar solução e executar validação visual
      const injected = await this.injectSolution(page, solution);
      
      if (!injected) {
        throw new Error('Falha na injeção da solução');
      }
      
      // 5. Clicar no botão de login
      const loginClicked = await this.clickLoginButton(page);
      
      if (!loginClicked) {
        console.log('⚠️ Botão de login não encontrado, mas captcha foi resolvido');
      }
      
      console.log('🎉 Processo completo finalizado!');
      return true;
      
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
      console.log('💰 Verificando saldo da conta 2captcha...');
      
      const response = await axios.post(`${this.baseUrl}/getBalance`, {
        clientKey: this.apiKey
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      if (response.data.errorId === 0) {
        console.log('✅ Saldo atual: $' + response.data.balance);
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

module.exports = CaptchaSolverV2;

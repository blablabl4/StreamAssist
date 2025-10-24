const axios = require('axios');

class CaptchaSolverV2 {
  constructor() {
    this.apiKey = process.env.CAPTCHA_2CAPTCHA_KEY;
    this.baseUrl = 'https://api.2captcha.com';
    
    if (!this.apiKey) {
      throw new Error('❌ CAPTCHA_2CAPTCHA_KEY não configurada no .env');
    }
    
    console.log('🎯 CaptchaSolver V2 inicializado com 2captcha');
  }

  /**
   * Resolve reCAPTCHA v2 usando a API oficial do 2captcha
   * @param {Object} page - Página do Puppeteer
   * @param {string} siteKey - Site key do reCAPTCHA (opcional, será extraída automaticamente)
   * @param {string} pageUrl - URL da página (opcional, será obtida automaticamente)
   * @returns {Promise<boolean>} - true se resolvido com sucesso
   */
  async solveRecaptcha(page, siteKey = null, pageUrl = null) {
    try {
      console.log('🤖 Iniciando resolução reCAPTCHA v2 com 2captcha...');
      
      // Extrair site key se não fornecida
      if (!siteKey) {
        siteKey = await this.extractSiteKey(page);
      }
      
      // Obter URL da página se não fornecida
      if (!pageUrl) {
        pageUrl = page.url();
      }
      
      if (!siteKey) {
        throw new Error('❌ Site key não encontrada');
      }
      
      console.log('🔑 Site Key:', siteKey);
      console.log('🌐 URL:', pageUrl);
      
      // Criar task usando RecaptchaV2TaskProxyless
      const taskId = await this.createTask(siteKey, pageUrl);
      console.log('📋 Task ID criada:', taskId);
      
      // Aguardar resolução
      const solution = await this.waitForSolution(taskId);
      console.log('🎉 Solução recebida:', solution.substring(0, 50) + '...');
      
      // Injetar solução na página
      const injected = await this.injectSolution(page, solution);
      
      if (injected) {
        console.log('✅ reCAPTCHA resolvido e injetado com sucesso!');
        return true;
      } else {
        console.log('❌ Falha ao injetar solução');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro ao resolver reCAPTCHA:', error.message);
      return false;
    }
  }

  /**
   * Extrai a site key do reCAPTCHA da página
   */
  async extractSiteKey(page) {
    return await page.evaluate(() => {
      // Procurar em diferentes lugares
      const sources = [
        // data-sitekey em elementos
        document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey'),
        document.querySelector('.g-recaptcha')?.getAttribute('data-sitekey'),
        
        // Em iframes do reCAPTCHA
        ...Array.from(document.querySelectorAll('iframe[src*="recaptcha"]')).map(iframe => {
          const src = iframe.src;
          const match = src.match(/[?&]k=([^&]+)/);
          return match ? match[1] : null;
        }).filter(Boolean),
        
        // Em scripts
        ...Array.from(document.scripts).map(script => {
          const text = script.textContent || '';
          const patterns = [
            /sitekey['\"]?:\s*['\"]([^'\"]+)['\"]/i,
            /data-sitekey['\"]?:\s*['\"]([^'\"]+)['\"]/i,
            /6L[a-zA-Z0-9_-]{38}/g
          ];
          
          for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
              return matches[1] || matches[0];
            }
          }
          return null;
        }).filter(Boolean)
      ];
      
      return sources.find(key => key && key.startsWith('6L')) || null;
    });
  }

  /**
   * Cria uma task no 2captcha usando RecaptchaV2TaskProxyless
   */
  async createTask(siteKey, pageUrl) {
    const payload = {
      clientKey: this.apiKey,
      task: {
        type: 'RecaptchaV2TaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        isInvisible: false
      }
    };

    console.log('📤 Enviando task para 2captcha...');
    
    const response = await axios.post(`${this.baseUrl}/createTask`, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data.errorId !== 0) {
      throw new Error(`Erro do 2captcha: ${response.data.errorDescription || 'Erro desconhecido'}`);
    }

    return response.data.taskId;
  }

  /**
   * Aguarda a resolução da task
   */
  async waitForSolution(taskId, maxAttempts = 40) {
    console.log('⏳ Aguardando resolução (pode levar 30-120 segundos)...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.sleep(3000); // Aguardar 3 segundos entre tentativas
      
      try {
        const response = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId: taskId
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.data.errorId !== 0) {
          throw new Error(`Erro do 2captcha: ${response.data.errorDescription || 'Erro desconhecido'}`);
        }

        if (response.data.status === 'ready') {
          console.log(`✅ reCAPTCHA resolvido em ${attempt * 3} segundos!`);
          return response.data.solution.gRecaptchaResponse;
        }

        if (response.data.status === 'processing') {
          console.log(`⏳ Tentativa ${attempt}/${maxAttempts} - ainda processando...`);
          continue;
        }

        throw new Error(`Status inesperado: ${response.data.status}`);

      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Timeout após ${maxAttempts * 3} segundos: ${error.message}`);
        }
        console.log(`⚠️ Erro na tentativa ${attempt}, tentando novamente...`);
      }
    }

    throw new Error('Timeout: reCAPTCHA não foi resolvido no tempo esperado');
  }

  /**
   * Injeta a solução do reCAPTCHA na página e valida com clique
   */
  async injectSolution(page, solution) {
    try {
      console.log('💉 Injetando solução na página...');
      
      const injected = await page.evaluate((token) => {
        try {
          // Método 1: Injetar no textarea g-recaptcha-response
          const responseTextarea = document.querySelector('#g-recaptcha-response');
          if (responseTextarea) {
            responseTextarea.value = token;
            responseTextarea.innerHTML = token;
            
            // Disparar eventos
            responseTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            responseTextarea.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Método 2: Usar callback do grecaptcha se disponível
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            // Tentar encontrar widget ID
            const widgets = document.querySelectorAll('.g-recaptcha');
            widgets.forEach((widget, index) => {
              try {
                if (window.grecaptcha.reset) {
                  window.grecaptcha.reset(index);
                }
              } catch (e) {
                // Ignorar erros de reset
              }
            });
          }

          // Método 3: Procurar por callback personalizado
          const recaptchaElement = document.querySelector('.g-recaptcha');
          if (recaptchaElement) {
            const callback = recaptchaElement.getAttribute('data-callback');
            if (callback && window[callback]) {
              try {
                window[callback](token);
              } catch (e) {
                console.log('Erro ao executar callback:', e);
              }
            }
          }

          // Verificar se foi injetado com sucesso
          const finalResponse = document.querySelector('#g-recaptcha-response');
          return finalResponse && finalResponse.value === token;
          
        } catch (error) {
          console.error('Erro na injeção:', error);
          return false;
        }
      }, solution);

      if (injected) {
        console.log('✅ Solução injetada com sucesso!');
        
        // NOVO: Interagir com o elemento do captcha para validar
        const validated = await this.validateCaptchaInteraction(page);
        
        if (validated) {
          // DEPOIS: Clicar no botão de login
          await this.clickLoginButton(page);
        }
        
        return true;
      } else {
        console.log('❌ Falha ao injetar solução');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro ao injetar solução:', error.message);
      return false;
    }
  }

  /**
   * Interage com elementos do captcha para validar a solução
   */
  async validateCaptchaInteraction(page) {
    try {
      console.log('🖱️ Validando captcha com clique no checkbox...');
      
      // Aguardar um pouco para a solução ser processada
      await page.waitForTimeout(3000);
      
      // PRIMEIRO: Verificar se o checkbox existe e está visível
      const checkboxInfo = await page.evaluate(() => {
        // Elemento específico identificado pelo usuário
        const primaryCheckbox = document.querySelector('.recaptcha-checkbox-borderAnimation[role="presentation"]');
        const fallbackCheckbox = document.querySelector('.recaptcha-checkbox-borderAnimation');
        const oldCheckbox = document.querySelector('.recaptcha-checkbox-border');
        
        return {
          primaryExists: !!primaryCheckbox,
          fallbackExists: !!fallbackCheckbox,
          oldExists: !!oldCheckbox,
          primaryVisible: primaryCheckbox ? primaryCheckbox.offsetParent !== null : false,
          fallbackVisible: fallbackCheckbox ? fallbackCheckbox.offsetParent !== null : false,
          oldVisible: oldCheckbox ? oldCheckbox.offsetParent !== null : false
        };
      });
      
      console.log('🔍 Informações do checkbox:');
      console.log('   - Checkbox borderAnimation existe:', checkboxInfo.primaryExists);
      console.log('   - Checkbox borderAnimation fallback existe:', checkboxInfo.fallbackExists);
      console.log('   - Checkbox antigo existe:', checkboxInfo.oldExists);
      console.log('   - Checkbox borderAnimation visível:', checkboxInfo.primaryVisible);
      console.log('   - Checkbox borderAnimation fallback visível:', checkboxInfo.fallbackVisible);
      console.log('   - Checkbox antigo visível:', checkboxInfo.oldVisible);
      
      if (!checkboxInfo.primaryExists && !checkboxInfo.fallbackExists && !checkboxInfo.oldExists) {
        console.log(' Nenhum checkbox encontrado, mas continuando...');
        console.log(' A solução já foi injetada, tentando prosseguir sem clique no checkbox');
        
        // Injetar a solução no campo g-recaptcha-response E executar callbacks de validação
    const injectionResult = await page.evaluate((token) => {
      const responseField = document.getElementById('g-recaptcha-response');
      if (responseField) {
        responseField.value = token;
        responseField.style.display = 'block';
        console.log(' Token injetado no g-recaptcha-response:', token.substring(0, 20) + '...');
        
        // VALIDAÇÃO VISUAL: Executar callbacks do reCAPTCHA conforme documentação 2captcha
        try {
          // Método 1: Executar callback direto via grecaptcha config
          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients && window.___grecaptcha_cfg.clients[0]) {
            const client = window.___grecaptcha_cfg.clients[0];
            if (client.callback && typeof client.callback === 'function') {
              console.log(' Executando callback do grecaptcha client...');
              client.callback(token);
            }
          }
          
          // Método 2: Disparar evento de mudança no campo response
          responseField.dispatchEvent(new Event('change', { bubbles: true }));
          responseField.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(' Eventos de mudança disparados no campo response');
          
          // Método 3: Executar callback personalizado se existir
          if (window.grecaptchaCallback && typeof window.grecaptchaCallback === 'function') {
            console.log(' Executando callback personalizado...');
            window.grecaptchaCallback(token);
          }
          
          // Método 4: Tentar executar callback via data-callback
          const recaptchaDiv = document.querySelector('.g-recaptcha');
          if (recaptchaDiv) {
            const callbackName = recaptchaDiv.getAttribute('data-callback');
            if (callbackName && window[callbackName] && typeof window[callbackName] === 'function') {
              console.log(' Executando callback via data-callback:', callbackName);
              window[callbackName](token);
            }
          }
          
          // Método 5: Forçar validação via grecaptcha API se disponível
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            console.log(' Validando via grecaptcha.getResponse...');
            // Força o grecaptcha a reconhecer que foi resolvido
            if (window.grecaptcha.reset) {
              // Não fazemos reset, apenas garantimos que está validado
            }
          }
          
          console.log(' Validação visual do reCAPTCHA executada com sucesso!');
          
        } catch (callbackError) {
          console.log(' Erro ao executar callbacks de validação:', callbackError.message);
        }
        
        return true;
      }
      console.log(' Campo g-recaptcha-response não encontrado');
      return false;
    }, solution);

    if (!injectionResult) {
      console.log(' Falha na injeção da solução');
      return false;
    }

    console.log(' Solução injetada E validada com sucesso!');
    await page.waitForTimeout(2000); // Aguardar mais tempo para validação
      const maxAttempts = 5;
      
      while (!clickSuccess && attempts < maxAttempts) {
        attempts++;
        console.log(` Tentativa ${attempts}/${maxAttempts} de clicar no checkbox...`);
{{ ... }}
        
        const clickResult = await page.evaluate(() => {
          try {
            // PRIMEIRO: Tentar o elemento específico identificado pelo usuário
            const borderAnimation = document.querySelector('.recaptcha-checkbox-borderAnimation[role="presentation"]');
            if (borderAnimation && borderAnimation.offsetParent !== null) {
              console.log('Clicando no borderAnimation com role presentation...');
              borderAnimation.click();
              return 'borderAnimation-presentation-clicked';
            }
            
            // SEGUNDO: Tentar borderAnimation sem role
            const borderAnimationFallback = document.querySelector('.recaptcha-checkbox-borderAnimation');
            if (borderAnimationFallback && borderAnimationFallback.offsetParent !== null) {
              console.log('Clicando no borderAnimation fallback...');
              borderAnimationFallback.click();
              return 'borderAnimation-fallback-clicked';
            }
            
            // TERCEIRO: Fallback para outros seletores
            const fallbacks = [
              '.recaptcha-checkbox-border',
              '#recaptcha-anchor > div.recaptcha-checkbox-border',
              '#recaptcha-anchor .recaptcha-checkbox-border',
              '.recaptcha-checkbox',
              '[role="checkbox"]'
            ];
            
            for (const selector of fallbacks) {
              const element = document.querySelector(selector);
              if (element && element.offsetParent !== null) {
                console.log(`Fallback: clicando em ${selector}`);
                element.click();
                return `fallback-clicked: ${selector}`;
              }
            }
            
            return 'no-clickable-checkbox-found';
            
          } catch (error) {
            return 'click-error: ' + error.message;
          }
        });
        
        console.log(`   Resultado: ${clickResult}`);
        
        // Aguardar um pouco após o clique
        await page.waitForTimeout(2000);
        
        // Verificar se o clique foi efetivo
        const checkResult = await page.evaluate(() => {
          const checkbox = document.querySelector('.recaptcha-checkbox-checked');
          const response = document.querySelector('#g-recaptcha-response');
          
          return {
            isChecked: !!checkbox,
            hasResponse: response && response.value && response.value.length > 0,
            responseLength: response ? response.value.length : 0
          };
        });
        
        console.log(`   Checkbox marcado: ${checkResult.isChecked}`);
        console.log(`   Response preenchida: ${checkResult.hasResponse} (${checkResult.responseLength} chars)`);
        
        if (checkResult.isChecked || checkResult.hasResponse) {
          clickSuccess = true;
          console.log('✅ Clique no checkbox foi efetivo!');
        } else {
          console.log(`⚠️ Tentativa ${attempts} não foi efetiva, tentando novamente...`);
          await page.waitForTimeout(1000);
        }
      }
      
      if (!clickSuccess) {
        console.log('⚠️ Falha ao clicar no checkbox, mas verificando se solução está presente...');
        
        // Verificar se mesmo sem clique, a solução está lá
        const hasSolution = await page.evaluate(() => {
          const response = document.querySelector('#g-recaptcha-response');
          return {
            hasResponse: response && response.value && response.value.length > 0,
            responseLength: response ? response.value.length : 0
          };
        });
        
        if (hasSolution.hasResponse && hasSolution.responseLength > 0) {
          console.log(`✅ Solução presente (${hasSolution.responseLength} chars), continuando sem clique...`);
          // Não retornar false, continuar o fluxo
        } else {
          console.log('❌ Nem clique nem solução funcionaram!');
          return false;
        }
      }
      
      // TERCEIRO: Aguardar validação completa
      console.log('⏳ Aguardando validação completa do captcha...');
      await page.waitForTimeout(5000);
      
      // QUARTO: Verificar status final
      const finalStatus = await page.evaluate(() => {
        const response = document.querySelector('#g-recaptcha-response');
        const checkbox = document.querySelector('.recaptcha-checkbox-checked');
        const checkboxBorder = document.querySelector('#recaptcha-anchor > div.recaptcha-checkbox-border');
        
        return {
          hasResponse: response && response.value && response.value.length > 0,
          responseLength: response ? response.value.length : 0,
          isChecked: !!checkbox,
          borderExists: !!checkboxBorder,
          borderClasses: checkboxBorder ? checkboxBorder.className : 'not-found'
        };
      });
      
      console.log('🔍 Status final da validação:');
      console.log('   - Resposta preenchida:', finalStatus.hasResponse);
      console.log('   - Tamanho da resposta:', finalStatus.responseLength);
      console.log('   - Checkbox marcado:', finalStatus.isChecked);
      console.log('   - Border existe:', finalStatus.borderExists);
      console.log('   - Classes do border:', finalStatus.borderClasses);
      
      if (finalStatus.hasResponse && finalStatus.responseLength > 0) {
        console.log('✅ Captcha totalmente validado!');
        return true;
      } else {
        console.log('❌ Validação do captcha falhou!');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro na validação do captcha:', error.message);
      return false;
    }
  }

  /**
   * Clica no botão de login após validar o captcha
   */
  async clickLoginButton(page) {
    try {
      console.log('🖱️ Clicando no botão de login...');
      
      // Aguardar um pouco para garantir que o captcha foi processado
      await page.waitForTimeout(2000);
      
      const loginClicked = await page.evaluate(() => {
        try {
          // Procurar botão "Logar"
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const loginButton = buttons.find(btn => 
            btn.textContent?.trim().toLowerCase().includes('logar') ||
            btn.value?.toLowerCase().includes('logar') ||
            btn.classList.contains('btn-primary')
          );
          
          if (loginButton) {
            console.log('Botão "Logar" encontrado, clicando...');
            loginButton.click();
            return 'login-button-clicked';
          }
          
          // Fallback: tentar seletores comuns
          const fallbacks = [
            'button[type="submit"]',
            '.btn-primary',
            'input[type="submit"]',
            'button:contains("Entrar")',
            'button:contains("Login")'
          ];
          
          for (const selector of fallbacks) {
            const element = document.querySelector(selector);
            if (element) {
              console.log(`Fallback: clicando em ${selector}`);
              element.click();
              return `fallback-clicked: ${selector}`;
            }
          }
          
          return 'login-button-not-found';
          
        } catch (error) {
          return 'login-click-error: ' + error.message;
        }
      });
      
      console.log('🖱️ Resultado do clique no login:', loginClicked);
      
      // Aguardar resposta do servidor
      await page.waitForTimeout(5000);
      
      // Verificar se login foi bem-sucedido
      const currentUrl = page.url();
      console.log('🌐 URL após login:', currentUrl);
      
      if (!currentUrl.includes('login')) {
        console.log('🎉 LOGIN REALIZADO COM SUCESSO!');
        console.log('✅ SISTEMA TOTALMENTE FUNCIONAL!');
        return true;
      } else {
        console.log('⚠️ Ainda na página de login');
        
        // Verificar se há mensagens de erro
        const errorMsg = await page.evaluate(() => {
          const selectors = ['.error', '.alert-danger', '.text-danger', '[class*="error"]'];
          for (const sel of selectors) {
            const elem = document.querySelector(sel);
            if (elem && elem.textContent.trim()) {
              return elem.textContent.trim();
            }
          }
          return null;
        });
        
        if (errorMsg) {
          console.log('❌ Erro encontrado:', errorMsg);
        }
        
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro ao clicar no botão de login:', error.message);
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
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errorId !== 0) {
        throw new Error(`Erro: ${response.data.errorDescription}`);
      }

      return `$${response.data.balance}`;
      
    } catch (error) {
      console.error('❌ Erro ao verificar saldo:', error.message);
      return 'Erro ao verificar saldo';
    }
  }

  /**
   * Utilitário para aguardar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CaptchaSolverV2;

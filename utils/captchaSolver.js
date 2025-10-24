const axios = require('axios');
const { Solver } = require('2captcha');

class CaptchaSolver {
  constructor() {
    // Múltiplos serviços para redundância
    this.services = {
      '2captcha': {
        apiKey: process.env.CAPTCHA_2CAPTCHA_KEY,
        submitUrl: 'http://2captcha.com/in.php',
        resultUrl: 'http://2captcha.com/res.php',
        cost: 0.003, // $3 por 1000
        enabled: !!process.env.CAPTCHA_2CAPTCHA_KEY
      },
      'anticaptcha': {
        apiKey: process.env.CAPTCHA_ANTICAPTCHA_KEY,
        submitUrl: 'https://api.anti-captcha.com/createTask',
        resultUrl: 'https://api.anti-captcha.com/getTaskResult',
        cost: 0.002, // $2 por 1000
        enabled: !!process.env.CAPTCHA_ANTICAPTCHA_KEY
      },
      'truecaptcha': {
        apiKey: process.env.CAPTCHA_TRUECAPTCHA_KEY || 'FREE', // Gratuito
        submitUrl: 'https://api.truecaptcha.org/v1/captcha/solve',
        cost: 0, // Gratuito
        enabled: true // Sempre disponível
      }
    };
    
    this.currentService = this.selectBestService();
  }
  
  selectBestService() {
    // Priorizar 2captcha se API key estiver disponível (mais confiável)
    if (this.services['2captcha'].enabled) {
      console.log('🎯 Usando serviço: 2captcha (MAIS CONFIÁVEL - $3 por 1000 CAPTCHAs)');
      return '2captcha';
    }
    
    // Fallback para outros serviços por custo
    const available = Object.entries(this.services)
      .filter(([name, config]) => config.enabled)
      .sort(([, a], [, b]) => a.cost - b.cost);
    
    if (available.length === 0) {
      console.log('⚠️ Nenhum serviço de CAPTCHA configurado, usando modo manual');
      return null;
    }
    
    const [serviceName, config] = available[0];
    console.log(`🎯 Usando serviço: ${serviceName} (${config.cost === 0 ? 'GRATUITO' : '$' + config.cost + ' por CAPTCHA'})`);
    return serviceName;
  }
  
  async solveRecaptcha(page, siteKey = null, pageUrl = null) {
    try {
      console.log('🤖 Iniciando resolução automática de reCAPTCHA...');
      
      if (!this.currentService) {
        console.log('❌ Nenhum serviço disponível, usando resolução manual');
        return await this.manualSolve(page);
      }
      
      // Extrair dados necessários automaticamente
      if (!siteKey) {
        siteKey = await this.extractSiteKey(page);
      }
      
      if (!pageUrl) {
        pageUrl = page.url();
      }
      
      console.log(`🔑 Site Key: ${siteKey}`);
      console.log(`🌐 URL: ${pageUrl}`);
      
      // Resolver usando o serviço selecionado
      const solution = await this.solveWithService(this.currentService, siteKey, pageUrl);
      
      if (solution) {
        // Injetar solução na página
        const success = await this.injectSolution(page, solution);
        return success;
      }
      
      console.log('❌ Falha na resolução automática, tentando manual...');
      return await this.manualSolve(page);
      
    } catch (error) {
      console.error('💥 Erro na resolução de CAPTCHA:', error.message);
      return await this.manualSolve(page);
    }
  }
  
  async extractSiteKey(page) {
    try {
      const siteKey = await page.evaluate(() => {
        // Procurar site key em diferentes lugares
        const sources = [
          document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey'),
          document.querySelector('.g-recaptcha')?.getAttribute('data-sitekey'),
          window.grecaptcha?.enterprise?.sitekey,
          
          // Procurar em iframes do reCAPTCHA
          ...Array.from(document.querySelectorAll('iframe[src*="recaptcha"]')).map(iframe => {
            const src = iframe.src;
            const match = src.match(/[?&]k=([^&]+)/);
            return match ? match[1] : null;
          }).filter(Boolean),
          
          // Procurar em scripts
          ...Array.from(document.scripts).map(script => {
            const text = script.textContent || '';
            const patterns = [
              /sitekey['\"]?:\s*['\"]([^'\"]+)['\"]/i,
              /data-sitekey['\"]?:\s*['\"]([^'\"]+)['\"]/i,
              /[?&]k=([^&'\"\s]+)/g,
              /6L[a-zA-Z0-9_-]{38}/g
            ];
            
            for (const pattern of patterns) {
              const matches = text.match(pattern);
              if (matches) {
                return matches[1] || matches[0];
              }
            }
            return null;
          }).filter(Boolean),
          
          // Procurar padrão típico do site key (6L...)
          ...Array.from(document.querySelectorAll('*')).map(el => {
            const text = el.textContent || el.innerHTML || '';
            const match = text.match(/6L[a-zA-Z0-9_-]{38}/);
            return match ? match[0] : null;
          }).filter(Boolean)
        ];
        
        return sources.find(key => key && key.length > 10 && key.startsWith('6L'));
      });
      
      if (!siteKey) {
        // Tentar extrair de forma mais agressiva
        console.log('🔍 Tentando extração agressiva do site key...');
        const aggressiveSiteKey = await page.evaluate(() => {
          const allText = document.documentElement.innerHTML;
          const match = allText.match(/6L[a-zA-Z0-9_-]{38}/);
          return match ? match[0] : null;
        });
        
        if (aggressiveSiteKey) {
          console.log(`🎯 Site key encontrado (extração agressiva): ${aggressiveSiteKey}`);
          return aggressiveSiteKey;
        }
        
        throw new Error('Site key não encontrada');
      }
      
      console.log(`🎯 Site key encontrado: ${siteKey}`);
      return siteKey;
    } catch (error) {
      console.error('Erro ao extrair site key:', error.message);
      throw error;
    }
  }
  
  async solveWithService(serviceName, siteKey, pageUrl) {
    const service = this.services[serviceName];
    
    switch (serviceName) {
      case '2captcha':
        return await this.solve2Captcha(service, siteKey, pageUrl);
      case 'anticaptcha':
        return await this.solveAntiCaptcha(service, siteKey, pageUrl);
      case 'truecaptcha':
        return await this.solveTrueCaptcha(service, siteKey, pageUrl);
      default:
        throw new Error(`Serviço desconhecido: ${serviceName}`);
    }
  }
  
  async solve2Captcha(service, siteKey, pageUrl) {
    try {
      console.log('🔧 Resolvendo com 2captcha (biblioteca oficial)...');
      
      const solver = new Solver(service.apiKey);
      
      console.log(`🔑 Site Key: ${siteKey}`);
      console.log(`🌐 URL: ${pageUrl}`);
      console.log('⏳ Aguardando resolução (pode levar 30-120 segundos)...');
      
      const result = await solver.recaptcha(siteKey, pageUrl);
      
      if (result && result.data) {
        console.log('✅ reCAPTCHA resolvido pelo 2captcha!');
        return result.data;
      }
      
      throw new Error('Resposta inválida do 2captcha');
      
    } catch (error) {
      console.error('Erro no 2captcha:', error.message);
      return null;
    }
  }
  
  async solveTrueCaptcha(service, siteKey, pageUrl) {
    try {
      console.log('🆓 Tentando TrueCaptcha (GRATUITO)...');
      
      const response = await axios.post(service.submitUrl, {
        captcha_type: 'recaptchav2',
        sitekey: siteKey,
        url: pageUrl,
        api_key: service.apiKey === 'FREE' ? undefined : service.apiKey
      });
      
      if (response.data.success) {
        console.log('✅ reCAPTCHA resolvido pelo TrueCaptcha!');
        return response.data.token;
      }
      
      throw new Error(`TrueCaptcha error: ${response.data.message}`);
      
    } catch (error) {
      console.error('Erro no TrueCaptcha:', error.message);
      return null;
    }
  }
  
  async solveAntiCaptcha(service, siteKey, pageUrl) {
    // Implementação similar ao 2captcha
    console.log('🔧 AntiCaptcha não implementado ainda, usando fallback...');
    return null;
  }
  
  async injectSolution(page, solution) {
    try {
      console.log('💉 Injetando solução do reCAPTCHA...');
      
      const success = await page.evaluate((token) => {
        // Método 1: Preencher textarea
        const textarea = document.querySelector('[name="g-recaptcha-response"]');
        if (textarea) {
          textarea.value = token;
          textarea.style.display = 'block';
        }
        
        // Método 2: Chamar callback do grecaptcha
        if (window.grecaptcha && window.grecaptcha.getResponse) {
          try {
            // Encontrar widget ID
            const widgets = document.querySelectorAll('.g-recaptcha');
            widgets.forEach((widget, index) => {
              try {
                window.grecaptcha.enterprise.execute(index, token);
              } catch (e) {
                // Tentar método alternativo
                if (window.grecaptcha.callback) {
                  window.grecaptcha.callback(token);
                }
              }
            });
          } catch (e) {
            console.log('Erro ao executar callback:', e);
          }
        }
        
        // Método 3: Disparar eventos
        const recaptchaElement = document.querySelector('.g-recaptcha');
        if (recaptchaElement) {
          const event = new Event('change', { bubbles: true });
          recaptchaElement.dispatchEvent(event);
        }
        
        return true;
      }, solution);
      
      if (success) {
        console.log('✅ Solução injetada com sucesso!');
        await page.waitForTimeout(2000); // Aguardar processamento
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao injetar solução:', error.message);
      return false;
    }
  }
  
  async manualSolve(page) {
    console.log('👤 Aguardando resolução manual do reCAPTCHA...');
    console.log('🕰️ Você tem 60 segundos para resolver!');
    
    const startTime = Date.now();
    const timeout = 60000; // 60 segundos
    
    while (Date.now() - startTime < timeout) {
      const resolved = await page.evaluate(() => {
        const textarea = document.querySelector('[name="g-recaptcha-response"]');
        return textarea && textarea.value.length > 20;
      });
      
      if (resolved) {
        console.log('✅ reCAPTCHA resolvido manualmente!');
        return true;
      }
      
      await page.waitForTimeout(1000);
    }
    
    console.log('⏰ Timeout na resolução manual');
    return false;
  }
}

module.exports = CaptchaSolver;

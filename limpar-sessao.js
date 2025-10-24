require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function limparSessao() {
  console.log('🧹 LIMPANDO SESSÃO PERSISTENTE');
  console.log('=' .repeat(40));
  
  const userDataDir = path.resolve(__dirname, 'data', 'puppeteer_profile');
  
  console.log(`📁 Diretório de sessão: ${userDataDir}`);
  
  // Opção 1: Deletar cookies via Puppeteer
  try {
    console.log('🍪 Tentando limpar cookies via Puppeteer...');
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir,
      slowMo: 100
    });
    
    const page = await browser.newPage();
    
    // Ir para o site primeiro
    await page.goto('https://onlineoffice.zip', { waitUntil: 'networkidle2' });
    
    // Limpar todos os cookies
    const cookies = await page.cookies();
    console.log(`🍪 Encontrados ${cookies.length} cookies`);
    
    if (cookies.length > 0) {
      await page.deleteCookie(...cookies);
      console.log('✅ Cookies deletados');
    }
    
    // Limpar localStorage e sessionStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('🧹 Storage limpo');
    });
    
    // Ir para login para testar
    console.log('🌐 Navegando para login...');
    await page.goto('https://onlineoffice.zip/#/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log(`📍 URL atual: ${url}`);
    
    if (url.includes('login')) {
      console.log('✅ Sucesso! Agora está na tela de login');
      console.log('📝 Preencha as credenciais manualmente...');
      console.log('👆 NÃO clique no captcha ainda!');
      console.log('⏸️ Pressione ENTER quando estiver pronto para testar a injeção...');
      
      // Aguardar input do usuário
      await new Promise((resolve) => {
        process.stdin.once('data', () => resolve());
      });
      
      // Agora fazer o teste da injeção
      console.log('💉 Testando injeção de token...');
      const tokenTeste = 'TOKEN_TESTE_' + Date.now() + '_LONGO_PARA_SIMULAR_2CAPTCHA_REAL';
      
      const resultado = await page.evaluate((token) => {
        try {
          const textarea = document.getElementById('g-recaptcha-response');
          if (!textarea) return { success: false, error: 'textarea não encontrado' };
          
          // Estado antes
          const antes = {
            textareaValor: textarea.value,
            textareaLength: textarea.value.length
          };
          
          // Injetar
          textarea.value = token;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Atualizar grecaptcha
          if (typeof grecaptcha !== 'undefined') {
            grecaptcha.getResponse = () => token;
            
            // Callbacks
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
              const clients = Object.values(window.___grecaptcha_cfg.clients);
              for (const client of clients) {
                const cb = client?.callback || client?.O?.callback || client?.$?.callback;
                if (typeof cb === 'function') {
                  cb(token);
                }
              }
            }
          }
          
          // Estado depois
          const depois = {
            textareaValor: textarea.value.substring(0, 50) + '...',
            textareaLength: textarea.value.length
          };
          
          return { success: true, antes, depois, tokenInjetado: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }, tokenTeste);
      
      console.log('📊 Resultado da injeção:', JSON.stringify(resultado, null, 2));
      
      console.log('=' .repeat(40));
      console.log('👆 AGORA clique no checkbox do reCAPTCHA');
      console.log('🔍 Observe se fica verde ou abre quebra-cabeça');
      console.log('⏸️ Deixando browser aberto para análise...');
      
      // Manter aberto
      await new Promise(() => {});
      
    } else {
      console.log('❌ Ainda está logado. Sessão não foi limpa completamente.');
      await browser.close();
    }
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

limparSessao().catch(console.error);

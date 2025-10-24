/**
 * ANÁLISE COMPLETA DO FLUXO DE DIÁLOGO
 * Script para identificar todos os problemas de lógica e comandos de texto
 */

const fs = require('fs');
const path = require('path');

async function analisarFluxoCompleto() {
  console.log('🔍 ANÁLISE COMPLETA DO FLUXO DE DIÁLOGO\n');
  
  const problemas = [];
  const comandosTexto = [];
  const errosLogica = [];
  
  // 1. Analisar messageHandler.js
  console.log('📄 Analisando messageHandler.js...');
  const messageHandlerPath = './whatsapp/messageHandler.js';
  const messageHandlerContent = fs.readFileSync(messageHandlerPath, 'utf8');
  
  // Verificar comandos de texto ainda presentes
  const linhas = messageHandlerContent.split('\n');
  
  linhas.forEach((linha, index) => {
    const numeroLinha = index + 1;
    
    // Procurar por comandos de texto
    const comandosTextoRegex = /(menu|início|start|oi|olá|sim|não|nao|suporte|tutorial|planos|status|renovar|credenciais|teste)/gi;
    const matches = linha.match(comandosTextoRegex);
    
    if (matches && !linha.includes('//') && !linha.includes('console.log')) {
      comandosTexto.push({
        linha: numeroLinha,
        conteudo: linha.trim(),
        comandos: matches
      });
    }
    
    // Procurar por possíveis erros de lógica
    if (linha.includes('===') && linha.includes("'") && !linha.includes('//')) {
      const textoComparacao = linha.match(/'([^']+)'/g);
      if (textoComparacao) {
        textoComparacao.forEach(texto => {
          if (!/^\d+$/.test(texto.replace(/'/g, ''))) {
            errosLogica.push({
              linha: numeroLinha,
              conteudo: linha.trim(),
              problema: `Comparação com texto: ${texto}`
            });
          }
        });
      }
    }
  });
  
  // 2. Analisar messages.js
  console.log('📄 Analisando messages.js...');
  const messagesPath = './utils/messages.js';
  const messagesContent = fs.readFileSync(messagesPath, 'utf8');
  
  const linhasMessages = messagesContent.split('\n');
  linhasMessages.forEach((linha, index) => {
    const numeroLinha = index + 1;
    
    // Procurar por instruções de texto em mensagens
    if (linha.includes('Digite') && !linha.includes('*NÚMERO*') && !linha.includes('*0*') && !linha.includes('*1*')) {
      if (linha.includes('MENU') || linha.includes('SIM') || linha.includes('NÃO')) {
        problemas.push({
          arquivo: 'messages.js',
          linha: numeroLinha,
          conteudo: linha.trim(),
          problema: 'Instrução usando texto em vez de número'
        });
      }
    }
  });
  
  // 3. Verificar estados e fluxos
  console.log('🔄 Analisando estados e fluxos...');
  
  // Extrair todos os estados possíveis
  const estadosRegex = /step:\s*['"]([^'"]+)['"]/g;
  let match;
  const estados = new Set();
  
  while ((match = estadosRegex.exec(messageHandlerContent)) !== null) {
    estados.add(match[1]);
  }
  
  console.log('📊 Estados encontrados:', Array.from(estados));
  
  // Verificar se todos os estados têm processamento
  const estadosProcessados = new Set();
  const processamentoRegex = /if\s*\([^)]*step\s*===\s*['"]([^'"]+)['"]/g;
  
  while ((match = processamentoRegex.exec(messageHandlerContent)) !== null) {
    estadosProcessados.add(match[1]);
  }
  
  const estadosOrfaos = Array.from(estados).filter(estado => !estadosProcessados.has(estado));
  
  if (estadosOrfaos.length > 0) {
    errosLogica.push({
      problema: 'Estados sem processamento',
      estados: estadosOrfaos
    });
  }
  
  // 4. Relatório final
  console.log('\n📋 RELATÓRIO DE ANÁLISE:\n');
  
  console.log('🚨 COMANDOS DE TEXTO ENCONTRADOS:');
  if (comandosTexto.length === 0) {
    console.log('✅ Nenhum comando de texto encontrado!');
  } else {
    comandosTexto.forEach(item => {
      console.log(`❌ Linha ${item.linha}: ${item.conteudo}`);
      console.log(`   Comandos: ${item.comandos.join(', ')}\n`);
    });
  }
  
  console.log('\n🔧 ERROS DE LÓGICA ENCONTRADOS:');
  if (errosLogica.length === 0) {
    console.log('✅ Nenhum erro de lógica encontrado!');
  } else {
    errosLogica.forEach(item => {
      if (item.linha) {
        console.log(`❌ Linha ${item.linha}: ${item.problema}`);
        console.log(`   Código: ${item.conteudo}\n`);
      } else {
        console.log(`❌ ${item.problema}: ${item.estados?.join(', ')}\n`);
      }
    });
  }
  
  console.log('\n📝 PROBLEMAS EM MENSAGENS:');
  if (problemas.length === 0) {
    console.log('✅ Nenhum problema em mensagens encontrado!');
  } else {
    problemas.forEach(item => {
      console.log(`❌ ${item.arquivo} - Linha ${item.linha}: ${item.problema}`);
      console.log(`   Conteúdo: ${item.conteudo}\n`);
    });
  }
  
  // 5. Gerar lista de correções necessárias
  console.log('\n🛠️ CORREÇÕES NECESSÁRIAS:');
  
  const correcoes = [];
  
  // Comandos de texto para converter
  comandosTexto.forEach(item => {
    if (item.comandos.includes('menu') || item.comandos.includes('início') || item.comandos.includes('start')) {
      correcoes.push(`Linha ${item.linha}: Substituir comandos de texto por números (0 para menu)`);
    }
    if (item.comandos.includes('sim')) {
      correcoes.push(`Linha ${item.linha}: Substituir 'sim' por '1'`);
    }
    if (item.comandos.includes('não') || item.comandos.includes('nao')) {
      correcoes.push(`Linha ${item.linha}: Substituir 'não'/'nao' por '2'`);
    }
  });
  
  // Problemas em mensagens
  problemas.forEach(item => {
    correcoes.push(`${item.arquivo} linha ${item.linha}: ${item.problema}`);
  });
  
  if (correcoes.length === 0) {
    console.log('✅ Nenhuma correção necessária! Fluxo está correto.');
  } else {
    correcoes.forEach((correcao, index) => {
      console.log(`${index + 1}. ${correcao}`);
    });
  }
  
  return {
    comandosTexto,
    errosLogica,
    problemas,
    correcoes,
    estados: Array.from(estados),
    estadosProcessados: Array.from(estadosProcessados)
  };
}

// Executar análise
analisarFluxoCompleto()
  .then((resultado) => {
    console.log('\n✅ Análise completa finalizada!');
    
    // Salvar relatório
    const relatorio = {
      timestamp: new Date().toISOString(),
      ...resultado
    };
    
    fs.writeFileSync('./relatorio-analise-fluxo.json', JSON.stringify(relatorio, null, 2));
    console.log('📄 Relatório salvo em: relatorio-analise-fluxo.json');
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro durante análise:', error);
    process.exit(1);
  });

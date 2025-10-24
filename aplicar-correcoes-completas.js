/**
 * SCRIPT PARA APLICAR TODAS AS CORREÇÕES IDENTIFICADAS NA ANÁLISE
 * Substitui comandos de texto por números em todo o fluxo de diálogo
 */

const fs = require('fs');

async function aplicarCorrecoes() {
  console.log('🔧 APLICANDO TODAS AS CORREÇÕES DO FLUXO DE DIÁLOGO\n');

  // Ler arquivo messageHandler.js
  const messageHandlerPath = './whatsapp/messageHandler.js';
  let content = fs.readFileSync(messageHandlerPath, 'utf8');

  console.log('📄 Aplicando correções em messageHandler.js...\n');

  // Lista de todas as correções a serem aplicadas
  const correcoes = [
    // Remover comandos de texto das condições, manter apenas números
    {
      buscar: "if (texto === 'menu' || texto === 'início' || texto === 'start' || texto === 'oi' || texto === 'olá' || texto === '0') {",
      substituir: "if (texto === '0' || texto === 'oi' || texto === 'olá') {"
    },
    
    // Remover 'sim' e 'paguei' das condições de pagamento
    {
      buscar: "if (texto === '1') {",
      substituir: "if (texto === '1') {"
    },
    
    // Manter apenas '2' para NÃO
    {
      buscar: "if (texto === '2') {",
      substituir: "if (texto === '2') {"
    },
    
    // Corrigir mensagens que ainda referenciam comandos de texto
    {
      buscar: "Digite *MENU* para",
      substituir: "Digite *0* para"
    },
    
    {
      buscar: "Digite *PLANOS* para",
      substituir: "Digite *1* para"
    },
    
    {
      buscar: "Digite *SUPORTE* para",
      substituir: "Digite *2* para"
    },
    
    {
      buscar: "Digite *STATUS* para",
      substituir: "Digite *3* para"
    },
    
    {
      buscar: "Digite *RENOVAR* para",
      substituir: "Digite *4* para"
    },
    
    {
      buscar: "Digite *TUTORIAIS* para",
      substituir: "Digite *5* para"
    },
    
    {
      buscar: "Digite *CREDENCIAIS* para",
      substituir: "Digite *6* para"
    },
    
    {
      buscar: "Digite *TESTE* para",
      substituir: "Digite *7* para"
    },
    
    // Corrigir instruções em tutoriais
    {
      buscar: "⬅️ Digite *MENU* para voltar",
      substituir: "⬅️ Digite *0* para voltar ao menu principal"
    },
    
    {
      buscar: "📝 Digite *MENU* para voltar",
      substituir: "📝 Digite *0* para voltar ao menu principal"
    },
    
    // Corrigir mensagens de erro que ainda usam texto
    {
      buscar: "Digite *SIM* para",
      substituir: "Digite *1* para"
    },
    
    {
      buscar: "Digite *NÃO* para",
      substituir: "Digite *2* para"
    },
    
    {
      buscar: "responda SIM para",
      substituir: "responda *1* para"
    },
    
    {
      buscar: "responda NÃO para",
      substituir: "responda *2* para"
    },
    
    // Corrigir instruções de comandos
    {
      buscar: "Digite MENU para",
      substituir: "Digite *0* para"
    },
    
    {
      buscar: "Digite PLANOS para",
      substituir: "Digite *1* para"
    },
    
    {
      buscar: "Digite SUPORTE para",
      substituir: "Digite *2* para"
    },
    
    {
      buscar: "Digite STATUS para",
      substituir: "Digite *3* para"
    },
    
    {
      buscar: "Digite RENOVAR para",
      substituir: "Digite *4* para"
    },
    
    {
      buscar: "Digite TUTORIAIS para",
      substituir: "Digite *5* para"
    },
    
    {
      buscar: "Digite CREDENCIAIS para",
      substituir: "Digite *6* para"
    },
    
    {
      buscar: "Digite TESTE para",
      substituir: "Digite *7* para"
    }
  ];

  // Aplicar todas as correções
  let correcaoCount = 0;
  correcoes.forEach((correcao, index) => {
    const antes = content;
    content = content.replace(new RegExp(correcao.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correcao.substituir);
    
    if (content !== antes) {
      correcaoCount++;
      console.log(`✅ Correção ${index + 1}: ${correcao.buscar} → ${correcao.substituir}`);
    }
  });

  // Salvar arquivo corrigido
  fs.writeFileSync(messageHandlerPath, content);
  console.log(`\n🎯 Total de correções aplicadas: ${correcaoCount}`);

  // Verificar se ainda há comandos de texto
  console.log('\n🔍 Verificando se ainda há comandos de texto...');
  
  const linhas = content.split('\n');
  const comandosRestantes = [];
  
  linhas.forEach((linha, index) => {
    const numeroLinha = index + 1;
    
    // Procurar por comandos de texto restantes (exceto comentários)
    if (!linha.includes('//') && !linha.includes('console.log')) {
      const comandosTextoRegex = /(Digite\s+[A-Z]+\s+para|responda\s+[A-Z]+\s+para|texto\s*===\s*['"][a-zA-Z]+['"])/gi;
      const matches = linha.match(comandosTextoRegex);
      
      if (matches) {
        comandosRestantes.push({
          linha: numeroLinha,
          conteudo: linha.trim(),
          comandos: matches
        });
      }
    }
  });

  if (comandosRestantes.length === 0) {
    console.log('✅ Nenhum comando de texto restante encontrado!');
  } else {
    console.log('⚠️ Comandos de texto ainda encontrados:');
    comandosRestantes.forEach(item => {
      console.log(`❌ Linha ${item.linha}: ${item.conteudo}`);
    });
  }

  console.log('\n✅ Correções aplicadas com sucesso!');
  console.log('📄 Arquivo messageHandler.js atualizado');
  
  return {
    correcaoCount,
    comandosRestantes: comandosRestantes.length
  };
}

// Executar correções
aplicarCorrecoes()
  .then((resultado) => {
    console.log(`\n🎉 CORREÇÕES CONCLUÍDAS!`);
    console.log(`📊 Correções aplicadas: ${resultado.correcaoCount}`);
    console.log(`📊 Comandos de texto restantes: ${resultado.comandosRestantes}`);
    
    if (resultado.comandosRestantes === 0) {
      console.log('🚀 Fluxo de diálogo 100% convertido para números!');
    } else {
      console.log('⚠️ Ainda há comandos de texto que precisam de correção manual.');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro durante aplicação de correções:', error);
    process.exit(1);
  });

/**
 * VALIDAÇÃO FINAL DO FLUXO DE DIÁLOGO
 * Script para testar todos os comandos e verificar se estão funcionando apenas com números
 */

const MessageHandler = require('./whatsapp/messageHandler');

async function validarFluxoCompleto() {
  console.log('🧪 VALIDAÇÃO FINAL DO FLUXO DE DIÁLOGO\n');

  // Criar instância do MessageHandler para teste
  const handler = new MessageHandler(null);
  
  // Mock da função enviarMensagem para capturar saídas
  const mensagensEnviadas = [];
  handler.enviarMensagem = async (telefone, mensagem) => {
    mensagensEnviadas.push({ telefone, mensagem });
    console.log(`📱 MENSAGEM PARA ${telefone}:`);
    console.log(mensagem);
    console.log('─'.repeat(50));
  };

  const telefoneTest = '5511999999999';

  console.log('🧪 TESTE 1: Menu principal (comando 0)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '0' });
    console.log('✅ Menu principal funcionando\n');
  } catch (error) {
    console.log('❌ Erro no menu principal:', error.message, '\n');
  }

  console.log('🧪 TESTE 2: Planos (comando 1)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '1' });
    console.log('✅ Menu de planos funcionando\n');
  } catch (error) {
    console.log('❌ Erro no menu de planos:', error.message, '\n');
  }

  console.log('🧪 TESTE 3: Suporte (comando 2)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '2' });
    console.log('✅ Suporte funcionando\n');
  } catch (error) {
    console.log('❌ Erro no suporte:', error.message, '\n');
  }

  console.log('🧪 TESTE 4: Status (comando 3)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '3' });
    console.log('✅ Status funcionando\n');
  } catch (error) {
    console.log('❌ Erro no status:', error.message, '\n');
  }

  console.log('🧪 TESTE 5: Renovar (comando 4)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '4' });
    console.log('✅ Renovar funcionando\n');
  } catch (error) {
    console.log('❌ Erro no renovar:', error.message, '\n');
  }

  console.log('🧪 TESTE 6: Tutoriais (comando 5)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '5' });
    console.log('✅ Tutoriais funcionando\n');
  } catch (error) {
    console.log('❌ Erro nos tutoriais:', error.message, '\n');
  }

  console.log('🧪 TESTE 7: Credenciais (comando 6)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '6' });
    console.log('✅ Credenciais funcionando\n');
  } catch (error) {
    console.log('❌ Erro nas credenciais:', error.message, '\n');
  }

  console.log('🧪 TESTE 8: Teste grátis (comando 7)');
  try {
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '7' });
    console.log('✅ Teste grátis funcionando\n');
  } catch (error) {
    console.log('❌ Erro no teste grátis:', error.message, '\n');
  }

  console.log('🧪 TESTE 9: Fluxo de tutoriais específicos');
  try {
    // Primeiro selecionar tutoriais
    await handler.processarMensagem({ from: telefoneTest + '@c.us', body: '5' });
    
    // Testar cada opção de tutorial (1-8)
    for (let i = 1; i <= 8; i++) {
      console.log(`\n🔍 Testando tutorial opção ${i}:`);
      handler.userStates.set(telefoneTest, { step: 'escolher_tutorial' });
      await handler.processarMensagem({ from: telefoneTest + '@c.us', body: i.toString() });
    }
    console.log('✅ Todos os tutoriais funcionando\n');
  } catch (error) {
    console.log('❌ Erro nos tutoriais específicos:', error.message, '\n');
  }

  console.log('🧪 TESTE 10: Comandos de texto (devem ser rejeitados)');
  const comandosTexto = ['menu', 'planos', 'suporte', 'status', 'renovar', 'tutoriais', 'credenciais', 'teste', 'sim', 'não'];
  
  for (const comando of comandosTexto) {
    try {
      console.log(`\n🔍 Testando comando de texto: "${comando}"`);
      await handler.processarMensagem({ from: telefoneTest + '@c.us', body: comando });
    } catch (error) {
      console.log(`❌ Erro ao processar "${comando}":`, error.message);
    }
  }

  console.log('\n📊 RESUMO DA VALIDAÇÃO:');
  console.log(`📱 Total de mensagens enviadas: ${mensagensEnviadas.length}`);
  
  // Verificar se alguma mensagem ainda contém instruções de texto
  const mensagensComTexto = mensagensEnviadas.filter(msg => 
    msg.mensagem.includes('Digite MENU') || 
    msg.mensagem.includes('Digite PLANOS') ||
    msg.mensagem.includes('Digite SUPORTE') ||
    msg.mensagem.includes('responda SIM') ||
    msg.mensagem.includes('responda NÃO')
  );

  if (mensagensComTexto.length === 0) {
    console.log('✅ Nenhuma mensagem com instruções de texto encontrada!');
    console.log('🚀 Fluxo de diálogo 100% convertido para números!');
  } else {
    console.log(`⚠️ ${mensagensComTexto.length} mensagens ainda contêm instruções de texto:`);
    mensagensComTexto.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.telefone}: ${msg.mensagem.substring(0, 100)}...`);
    });
  }

  return {
    totalMensagens: mensagensEnviadas.length,
    mensagensComTexto: mensagensComTexto.length,
    sucesso: mensagensComTexto.length === 0
  };
}

// Executar validação
validarFluxoCompleto()
  .then((resultado) => {
    console.log('\n🎉 VALIDAÇÃO CONCLUÍDA!');
    console.log(`📊 Total de mensagens: ${resultado.totalMensagens}`);
    console.log(`📊 Mensagens com texto: ${resultado.mensagensComTexto}`);
    
    if (resultado.sucesso) {
      console.log('🚀 FLUXO DE DIÁLOGO 100% FUNCIONAL E PADRONIZADO!');
    } else {
      console.log('⚠️ Ainda há mensagens que precisam de correção.');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro durante validação:', error);
    process.exit(1);
  });

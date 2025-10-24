const MessageHandler = require('./whatsapp/messageHandler');

/**
 * Script para testar e debugar o fluxo de tutoriais
 * Especificamente as opções 5, 7 e 8 que estão quebradas
 */

async function testarFluxoTutoriais() {
  console.log('🔧 Testando fluxo de tutoriais...\n');

  // Simular um cliente fake para teste
  const clienteFake = {
    telefone: '5511999999999'
  };

  // Criar instância do MessageHandler sem WhatsApp real
  const messageHandler = {
    userStates: new Map(),
    credentials: {
      formatCredentialsMessage: () => 'Credenciais de teste'
    },
    enviarMensagem: async (telefone, mensagem) => {
      console.log(`📱 MENSAGEM PARA ${telefone}:`);
      console.log(mensagem);
      console.log('─'.repeat(50));
    }
  };

  // Importar a função de processamento de tutoriais
  const MessageHandlerClass = require('./whatsapp/messageHandler');
  const handler = new MessageHandlerClass(null);

  console.log('🧪 TESTE 1: Verificar mapeamento de tutoriais');
  const tutoriaisValidos = {
    '1': { nome: 'Samsung Smart TV', app: 'Lazer Play', tipo: 'samsung' },
    '2': { nome: 'Android TV / TV Box', app: 'Uniplay IPTV', tipo: 'android' },
    '3': { nome: 'LG Smart TV', app: 'Smarters Pro', tipo: 'lg' },
    '4': { nome: 'Roku TV', app: 'IPTV Player', tipo: 'roku' },
    '5': { nome: 'PC/Notebook', app: 'Purple Player', tipo: 'pc' },
    '6': { nome: 'SS IPTV', app: 'SS IPTV (adicionar playlist)', tipo: 'ssiptv' },
    '7': { nome: 'Celular Android', app: 'IPTV Smarters Pro', tipo: 'android_mobile' },
    '8': { nome: 'iPhone/iPad', app: 'IPTV Smarters Pro', tipo: 'ios_mobile' }
  };

  // Testar cada opção
  for (let i = 1; i <= 8; i++) {
    const opcao = i.toString();
    const tutorial = tutoriaisValidos[opcao];
    
    if (tutorial) {
      console.log(`✅ Opção ${i}: ${tutorial.nome} - ${tutorial.app} (${tutorial.tipo})`);
    } else {
      console.log(`❌ Opção ${i}: NÃO ENCONTRADA!`);
    }
  }

  console.log('\n🧪 TESTE 2: Simular seleção das opções problemáticas');
  
  // Testar opções específicas
  const opcoesProblematicas = ['5', '7', '8'];
  
  for (const opcao of opcoesProblematicas) {
    console.log(`\n🔍 Testando opção ${opcao}:`);
    
    try {
      // Simular estado do usuário
      handler.userStates.set('5511999999999', { step: 'escolher_tutorial' });
      
      // Tentar processar a seleção
      await handler.processarSelecaoTutorial('5511999999999', opcao);
      
      // Verificar estado após processamento
      const novoEstado = handler.userStates.get('5511999999999');
      console.log(`📊 Estado após processamento:`, novoEstado);
      
    } catch (error) {
      console.log(`❌ ERRO ao processar opção ${opcao}:`, error.message);
    }
  }

  console.log('\n🧪 TESTE 3: Verificar processamento de opções de instalação');
  
  // Simular fluxo completo para opção 5
  try {
    console.log('\n🔍 Testando fluxo completo opção 5 (PC):');
    
    // 1. Selecionar tutorial
    handler.userStates.set('5511999999999', { step: 'escolher_tutorial' });
    await handler.processarSelecaoTutorial('5511999999999', '5');
    
    // 2. Verificar estado
    const estado = handler.userStates.get('5511999999999');
    console.log('📊 Estado após seleção:', estado);
    
    // 3. Tentar processar opção de instalação
    if (estado && estado.step === 'opcao_instalacao') {
      console.log('✅ Estado correto para opção de instalação');
      await handler.processarOpcaoInstalacao('5511999999999', '1', estado.tipoTv);
    } else {
      console.log('❌ Estado incorreto após seleção de tutorial');
    }
    
  } catch (error) {
    console.log('❌ ERRO no fluxo completo:', error.message);
    console.log(error.stack);
  }
}

// Executar teste
testarFluxoTutoriais()
  .then(() => {
    console.log('\n✅ Teste de tutoriais concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro durante teste:', error);
    process.exit(1);
  });

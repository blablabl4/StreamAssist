/**
 * Criar Login de Teste para Cliente com Persistência de Sessão
 * Usa a automação IPTV para gerar credenciais de teste
 */

const { createTestIfEligible } = require('./utils/accountGates');
const PaymentAudit = require('./utils/paymentAudit');

async function criarTesteCliente() {
  console.log('🎯 CRIANDO LOGIN DE TESTE PARA CLIENTE');
  console.log('=' .repeat(50));
  
  const audit = new PaymentAudit();
  
  // Dados do cliente teste
  const clienteTeste = {
    telefone: '5511934489228', // Telefone que enviou mensagens
    pacote: 2, // Completo sem adultos
    anotacoes: 'Conta teste via bot - Cliente real'
  };
  
  console.log('📱 Cliente:', clienteTeste.telefone);
  console.log('📦 Pacote:', clienteTeste.pacote, '(Completo sem adultos)');
  console.log('📝 Anotações:', clienteTeste.anotacoes);
  
  try {
    console.log('\n🔄 Verificando elegibilidade e criando conta teste...');
    
    // Usar a função de criação de teste com verificação de cooldown
    const resultado = await createTestIfEligible(clienteTeste);
    
    if (resultado && resultado.success) {
      console.log('\n✅ CONTA TESTE CRIADA COM SUCESSO!');
      console.log('=' .repeat(50));
      console.log(`👤 Usuário: ${resultado.usuario}`);
      console.log(`🔑 Senha: ${resultado.senha}`);
      console.log(`📅 Vencimento: ${resultado.vencimento || 'N/A'}`);
      console.log(`📺 Tipo: ${resultado.tipo || 'teste'}`);
      console.log(`📦 Pacote: ${resultado.pacote || 2}`);
      
      // Registrar na auditoria
      audit.accountCreated('TESTE_' + Date.now(), clienteTeste.telefone, resultado);
      
      // Mostrar links IPTV
      if (resultado.links && resultado.links.length > 0) {
        console.log('\n🔗 LINKS IPTV DISPONÍVEIS:');
        resultado.links.forEach((link, index) => {
          console.log(`${index + 1}. ${link}`);
        });
      }
      
      // Instruções para o cliente
      console.log('\n📋 INSTRUÇÕES PARA O CLIENTE:');
      console.log('1. Use as credenciais acima no seu app IPTV');
      console.log('2. Configure o servidor com um dos links fornecidos');
      console.log('3. A conta teste tem duração limitada');
      console.log('4. Para conta oficial, faça o pagamento via PIX');
      
      // Salvar resultado em arquivo para referência
      const fs = require('fs');
      const path = require('path');
      
      const resultadoCompleto = {
        timestamp: new Date().toISOString(),
        cliente: clienteTeste,
        credenciais: resultado,
        status: 'sucesso'
      };
      
      const arquivoResultado = path.join(__dirname, 'data', 'ultimo-teste-criado.json');
      fs.writeFileSync(arquivoResultado, JSON.stringify(resultadoCompleto, null, 2));
      
      console.log(`\n💾 Resultado salvo em: ${arquivoResultado}`);
      
    } else if (resultado && resultado.reason === 'cooldown') {
      console.log('\n⏳ CONTA TESTE EM COOLDOWN');
      console.log('=' .repeat(50));
      console.log('❌ Este telefone já criou uma conta teste recentemente');
      console.log(`⏰ Tempo restante: ${resultado.remainingDays || 60} dias`);
      console.log('\n💡 ALTERNATIVAS:');
      console.log('1. Aguardar o período de cooldown');
      console.log('2. Criar conta oficial via pagamento PIX');
      console.log('3. Usar outro número de telefone');
      
      audit.log('TEST_COOLDOWN_BLOCKED', {
        telefone: clienteTeste.telefone,
        remainingDays: resultado.remainingDays || 60
      });
      
    } else {
      console.log('\n❌ ERRO NA CRIAÇÃO DA CONTA TESTE');
      console.log('=' .repeat(50));
      console.log('Motivo:', resultado?.error || 'Erro desconhecido');
      
      audit.log('TEST_CREATION_ERROR', {
        telefone: clienteTeste.telefone,
        error: resultado?.error || 'Erro desconhecido'
      });
    }
    
  } catch (error) {
    console.log('\n💥 ERRO TÉCNICO:');
    console.log('=' .repeat(50));
    console.log('Erro:', error.message);
    console.log('Stack:', error.stack);
    
    audit.log('TEST_TECHNICAL_ERROR', {
      telefone: clienteTeste.telefone,
      error: error.message
    });
  }
  
  console.log('\n✅ Processo concluído!');
}

// Executar criação de teste
criarTesteCliente().catch(console.error);

const fs = require('fs');
const path = require('path');

/**
 * Script para corrigir credenciais existentes que não foram salvas corretamente
 * no arquivo client-credentials.json
 */

async function corrigirCredenciaisExistentes() {
  console.log('🔧 Iniciando correção de credenciais existentes...\n');

  // Carregar arquivo de credenciais atual
  const credentialsFile = path.join(__dirname, 'data', 'client-credentials.json');
  let credentials = {};
  
  try {
    if (fs.existsSync(credentialsFile)) {
      credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
      console.log('📂 Arquivo de credenciais carregado');
    } else {
      console.log('📂 Arquivo de credenciais não existe, criando novo...');
    }
  } catch (error) {
    console.log('⚠️ Erro ao carregar credenciais existentes:', error.message);
    credentials = {};
  }

  // Verificar e corrigir credenciais do último teste criado
  const ultimoTesteFile = path.join(__dirname, 'data', 'ultimo-teste-criado.json');
  if (fs.existsSync(ultimoTesteFile)) {
    try {
      const ultimoTeste = JSON.parse(fs.readFileSync(ultimoTesteFile, 'utf8'));
      const telefone = ultimoTeste.cliente.telefone;
      const credenciaisData = ultimoTeste.credenciais;

      console.log(`📱 Processando cliente: ${telefone}`);
      
      // Verificar se já tem credenciais salvas
      if (!credentials[telefone] || !credentials[telefone].teste) {
        console.log(`   ➕ Adicionando credenciais de teste para ${telefone}`);
        
        if (!credentials[telefone]) {
          credentials[telefone] = {};
        }

        credentials[telefone]['teste'] = {
          usuario: credenciaisData.usuario,
          senha: credenciaisData.senha,
          links: credenciaisData.links || [],
          vencimento: credenciaisData.vencimento,
          pacote: credenciaisData.pacote || 2,
          userNumber: credenciaisData.userNumber,
          linkPrincipal: credenciaisData.linkPrincipal,
          createdAt: ultimoTeste.timestamp,
          lastAccessed: new Date().toISOString(),
          active: true
        };

        console.log(`   ✅ Credenciais de teste salvas para ${telefone}`);
        console.log(`   📋 Usuário: ${credenciaisData.usuario}`);
        console.log(`   🔐 Senha: ${credenciaisData.senha}`);
        console.log(`   📅 Vencimento: ${credenciaisData.vencimento}`);
      } else {
        console.log(`   ✅ Credenciais de teste já existem para ${telefone}`);
      }
    } catch (error) {
      console.log('⚠️ Erro ao processar último teste:', error.message);
    }
  }

  // Verificar outros arquivos de dados para credenciais perdidas
  const dataDir = path.join(__dirname, 'data');
  const auditDir = path.join(dataDir, 'audit');
  
  if (fs.existsSync(auditDir)) {
    const auditFiles = fs.readdirSync(auditDir).filter(f => f.endsWith('.json'));
    
    for (const file of auditFiles) {
      try {
        const auditData = JSON.parse(fs.readFileSync(path.join(auditDir, file), 'utf8'));
        
        // Procurar por eventos de criação de conta
        if (auditData.events) {
          for (const event of auditData.events) {
            if (event.type === 'account_created' && event.data && event.data.telefone) {
              const telefone = event.data.telefone;
              const respData = event.data.response;
              
              if (respData && respData.usuario && respData.senha) {
                console.log(`📱 Encontrada conta em auditoria: ${telefone}`);
                
                // Determinar tipo (teste ou oficial) baseado no contexto
                const tipo = respData.tipo || (respData.vencimento && respData.vencimento.includes('2025') ? 'teste' : 'oficial');
                
                if (!credentials[telefone] || !credentials[telefone][tipo]) {
                  console.log(`   ➕ Adicionando credenciais ${tipo} para ${telefone}`);
                  
                  if (!credentials[telefone]) {
                    credentials[telefone] = {};
                  }

                  credentials[telefone][tipo] = {
                    usuario: respData.usuario,
                    senha: respData.senha,
                    links: respData.links || [],
                    vencimento: respData.vencimento,
                    pacote: respData.pacote || 2,
                    userNumber: respData.userNumber,
                    linkPrincipal: respData.linkPrincipal,
                    createdAt: event.timestamp,
                    lastAccessed: new Date().toISOString(),
                    active: true
                  };

                  console.log(`   ✅ Credenciais ${tipo} salvas para ${telefone}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Erro ao processar arquivo de auditoria ${file}:`, error.message);
      }
    }
  }

  // Salvar arquivo atualizado
  try {
    fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));
    console.log('\n✅ Arquivo de credenciais atualizado com sucesso!');
    
    // Mostrar resumo
    const totalClientes = Object.keys(credentials).length;
    let totalTeste = 0;
    let totalOficial = 0;
    
    for (const telefone in credentials) {
      if (credentials[telefone].teste) totalTeste++;
      if (credentials[telefone].oficial) totalOficial++;
    }
    
    console.log('\n📊 RESUMO:');
    console.log(`   👥 Total de clientes: ${totalClientes}`);
    console.log(`   🧪 Contas de teste: ${totalTeste}`);
    console.log(`   💎 Contas oficiais: ${totalOficial}`);
    
  } catch (error) {
    console.log('\n❌ Erro ao salvar arquivo de credenciais:', error.message);
  }
}

// Executar correção
corrigirCredenciaisExistentes()
  .then(() => {
    console.log('\n🎯 Correção de credenciais concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro durante correção:', error);
    process.exit(1);
  });

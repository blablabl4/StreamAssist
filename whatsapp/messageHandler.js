const Database = require('../database/database');
const IPTVUtils = require('../utils/iptvUtils');
const { gerarCobrancaPix } = require('../controllers/paymentController');
const { createTestIfEligible, createOfficialWhenPaidBurst, createOfficialDirect } = require('../utils/accountGates');
const { burstCheckPaid } = require('../utils/paghiperClient');
const State = require('../utils/stateStore');
const Idem = require('../utils/idempotencyStore');
const Msg = require('../utils/messages');
const PaymentAudit = require('../utils/paymentAudit');
const CredentialsManager = require('../utils/credentialsManager');
const delay = (ms) => new Promise(res => setTimeout(res, ms));

const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/configLoader');

// Importação dinâmica dos módulos de fluxo
const flowsDir = path.join(__dirname, '../flows');
const flows = {};
fs.readdirSync(flowsDir).forEach(file => {
  if (file.endsWith('.js')) {
    const cmd = file.replace('Flow.js', '').toLowerCase();
    flows[cmd] = require(path.join(flowsDir, file));
  }
});

class MessageHandler {
  constructor(client) {
    this.client = client;
    this.db = new Database();
    this.iptvUtils = new IPTVUtils();
    this.userStates = new Map(); // Para controlar o estado da conversa
    this.audit = new PaymentAudit(); // Sistema de auditoria
    this.credentials = new CredentialsManager(); // Gerenciador de credenciais
  }

  async handleMessage(message) {
    const telefone = message.from.replace('@c.us', '');
    const texto = message.body.toLowerCase().trim();
    
    // Ignorar mensagens de grupos e status
    if (message.from.includes('@g.us') || message.from.includes('status@broadcast')) {
      return;
    }

    console.log(`Mensagem recebida de ${telefone}: ${message.body}`);

    try {
      // Buscar ou criar cliente
      let cliente = await this.db.buscarCliente(telefone);
      if (!cliente) {
        await this.db.criarCliente(telefone);
        cliente = await this.db.buscarCliente(telefone);
      }

      // Processar comandos
      await this.processarComando(message, cliente, texto);

    } catch (error) {
      logger.error({ event: 'erro_processarComando', telefone, error: error.message, stack: error.stack });
      await this.enviarMensagem(telefone, '❌ Ocorreu um erro. Tente novamente em alguns instantes.');
    }
  }

  async processarComando(message, cliente, texto) {
    logger.info({ event: 'processarComando', telefone: cliente.telefone, texto });
    const telefone = cliente.telefone;
    const userState = this.userStates.get(telefone) || { step: 'menu' };
    const context = {
      sendMessage: this.enviarMensagem.bind(this, telefone),
      userState,
      cliente,
      telefone,
      texto,
      // Adicione outras dependências/contexto conforme necessário
    };

    // Roteamento para flows: exemplo para 'menu' e 'planos'
    if (texto === '0' || texto === 'menu') {
      if (flows['mainmenu']) {
        logger.info({ event: 'route_flow', flow: 'mainMenu', telefone });
        await flows['mainmenu'](context);
        this.userStates.set(telefone, { step: 'menu' });
        return;
      }
    }
    if (texto === '1' || texto === 'planos') {
      if (flows['plans']) {
        logger.info({ event: 'route_flow', flow: 'plans', telefone });
        await flows['plans'](context);
        this.userStates.set(telefone, { step: 'escolher_plano' });
        return;
      }
    }
    if (texto === '2' || texto === 'status') {
      if (flows['status']) {
        logger.info({ event: 'route_flow', flow: 'status', telefone });
        context.db = this.db;
        await flows['status'](context);
        return;
      }
    }
    // Roteamento dinâmico para outros flows
    const comandosMapeados = {
      '4': 'renew', 'renovar': 'renew',
      '5': 'tutorial', 'tutoriais': 'tutorial',
      '6': 'trial', 'teste': 'trial'
    };
    const chaveFlow = comandosMapeados[texto?.toLowerCase()] || comandosMapeados[texto?.normalize?.('NFD').replace(/[^\w\s]/gi, '').toLowerCase()];
    if (chaveFlow && flows[chaveFlow]) {
      logger.info({ event: 'route_flow', flow: chaveFlow, telefone });
      await flows[chaveFlow](context);
      return;
    }
    logger.info({ event: 'fallback_legacy_flow', telefone, texto });
    // Fallback para fluxo antigo se não houver flow correspondente

    // TRATAMENTO GLOBAL PARA VOLTAR AO MENU
    if (texto === '0' || textoNormalizado === 'menu') {
      await this.mostrarMenu(telefone);
      this.userStates.set(telefone, { step: 'menu' });
      return;
    }

    // Geração automática de PIX ao escolher plano por número
    const planosMap = {
      '2': 'mensal',
      '3': 'trimestral', 
      '4': 'semestral',
      '5': 'anual'
    };
    
    // Aceitar comandos textuais equivalentes para planos
    const textoNormalizado = texto.normalize('NFD').replace(/[^\w\s]/gi, '').toLowerCase();
    const planosTextuais = {
      'mensal': '2',
      'trimestral': '3',
      'semestral': '4',
      'anual': '5'
    };
    const planoNum = planosMap[texto] || planosTextuais[textoNormalizado];
    if (planoNum) {
      const planoTipo = planosMap[texto];
      try {
        await this.enviarMensagem(telefone, 'Gerando cobrança PIX...');
        const cob = await gerarCobrancaPix(cliente, planoTipo);
        if (cob && cob.success) {
          // Persistir transactionId no estado
          State.setState(telefone, { transactionId: cob.txid, plano: planoTipo, pacote: 2 });
          // Mapear txid -> telefone para idempotência e rastreabilidade
          if (cob.txid) {
            Idem.set(cob.txid, { telefone, plano: planoTipo, pacote: 2, status: 'pending' });
            // Log de auditoria: PIX gerado
            this.audit.pixGenerated(cob.txid, telefone, cob.valor, planoTipo);
          }

          const venc = cob.vencimento ? new Date(cob.vencimento).toLocaleString('pt-BR') : '';
          const detalhes = `💳 PIX gerado para o plano *${planoTipo.toUpperCase()}*\n`
            + `Valor: R$ ${cob.valor?.toFixed ? cob.valor.toFixed(2) : cob.valor}\n`
            + (venc ? `Vencimento: ${venc}\n` : '')
            + `\n📋 Copia e Cola:\n${cob.qrCodeText || 'N/A'}\n`
            + (cob.qrCode ? `\n🖼️ QR Code (link):\n${cob.qrCode}` : '');

          await this.enviarMensagem(telefone, detalhes);
          await this.enviarMensagem(telefone, Msg.askPaymentConfirmation());
        } else {
          await this.enviarMensagem(telefone, `Não foi possível gerar o PIX. ${cob?.error ? '('+cob.error+')' : ''}`);
        }
      } catch (e) {
        console.error('Erro gerar PIX:', e);
        await this.enviarMensagem(telefone, Msg.genericError());
      }
      return;
    }



    // Comando 6: Consultar credenciais existentes
    if (texto === '6') {
      const credentialsMessage = this.credentials.formatCredentialsMessage(telefone);
      await this.enviarMensagem(telefone, credentialsMessage);
      return;
    }

    // Comando 7: Criar TESTE (uma vez a cada 60 dias)
    // Aceitar 'suporte' por texto
    if (texto === '7' || textoNormalizado === 'suporte') {
      await this.enviarMensagem(telefone, Msg.testCreating());
      const resp = await createTestIfEligible({ telefone, pacote: 2, anotacoes: 'Gerado via WhatsApp' });
      if (resp && resp.success) {
        // Salvar credenciais no gerenciador com dados completos
        const credenciaisParaSalvar = {
          usuario: resp.usuario,
          senha: resp.senha,
          links: resp.links || [],
          vencimento: resp.vencimento,
          pacote: resp.pacote || 2,
          userNumber: resp.userNumber,
          linkPrincipal: resp.linkPrincipal
        };
        
        const salvou = this.credentials.saveCredentials(telefone, credenciaisParaSalvar, 'teste');
        console.log(`📋 Salvamento de credenciais teste para ${telefone}: ${salvou ? 'SUCESSO' : 'FALHA'}`);
        
        // Enviar credenciais formatadas
        await this.enviarMensagem(telefone, Msg.credentials(resp));
      } else if (resp && resp.reason === 'cooldown') {
        await this.enviarMensagem(telefone, Msg.testNotAllowed(resp.remainingDays || 60));
      } else {
        await this.enviarMensagem(telefone, Msg.genericError());
      }
      return;
    }

    // Fluxo oficial: associar transaction_id e confirmar pagamento
    // Exemplo de uso: "TXID abc123" salva o transactionId e pergunta confirmação
    if (texto.startsWith('txid ')) {
      const parts = message.body.trim().split(/\s+/);
      const txid = parts[1];
      if (!txid) {
        this.audit.invalidTransactionId(telefone, txid);
        await this.enviarMensagem(telefone, 'Envie no formato: TXID <transaction_id>');
        return;
      }
      State.setState(telefone, { transactionId: txid });
      Idem.set(txid, { telefone, status: 'pending' });
      await this.enviarMensagem(telefone, Msg.askPaymentConfirmation());
      return;
    }

    // Verificar se usuário confirmou pagamento
    if (texto === '1') {
      const st = State.getState(telefone) || {};
      if (!st.transactionId) {
        this.audit.invalidTransactionId(telefone, null);
        await this.enviarMensagem(telefone, 'Não encontrei seu transaction_id. Envie: TXID <transaction_id>');
        return;
      }
      
      // Verificar se já foi processado (idempotência)
      const existing = Idem.get(st.transactionId);
      if (existing && existing.status === 'processed') {
        this.audit.duplicateAttemptBlocked(st.transactionId, telefone);
        await this.enviarMensagem(telefone, 'Esta transação já foi processada anteriormente.');
        return;
      }
      
      await this.enviarMensagem(telefone, 'Verificando pagamento na PagHiper...');
      this.audit.paymentCheckStarted(st.transactionId, telefone, 5);
      
      let check;
      try {
        check = await burstCheckPaid(st.transactionId, 5, 3000);
        this.audit.paymentCheckResult(st.transactionId, telefone, check);
      } catch (error) {
        this.audit.paymentCheckError(st.transactionId, telefone, error);
        await this.enviarMensagem(telefone, 'Erro ao verificar pagamento. Tente novamente em alguns minutos.');
        return;
      }
      if (check && check.paid) {
        // Marcar idempotência como pago e informar o cliente ANTES de abrir o navegador
        Idem.set(st.transactionId, { ...(Idem.get(st.transactionId) || {}), telefone, status: 'paid' });
        await this.enviarMensagem(telefone, Msg.paymentConfirmedProcessing());
        // Garantir que a mensagem seja entregue/visível antes de iniciar o navegador
        await delay(4000);

        // Agora sim, criar a conta oficial
        try {
          const resp = await createOfficialDirect({ telefone, pacote: st.pacote || 2, anotacoes: 'Cliente WhatsApp' });
          if (resp && resp.success) {
            // Marcar como processado para evitar duplicação
            Idem.set(st.transactionId, { ...(Idem.get(st.transactionId) || {}), status: 'processed' });
            this.audit.accountCreated(st.transactionId, telefone, resp);
            
            // Salvar credenciais no gerenciador com dados completos
            const credenciaisParaSalvar = {
              usuario: resp.usuario,
              senha: resp.senha,
              links: resp.links || [],
              vencimento: resp.vencimento,
              pacote: resp.pacote || st.pacote || 2,
              userNumber: resp.userNumber,
              linkPrincipal: resp.linkPrincipal
            };
            
            const salvou = this.credentials.saveCredentials(telefone, credenciaisParaSalvar, 'oficial');
            console.log(`📋 Salvamento de credenciais oficial para ${telefone}: ${salvou ? 'SUCESSO' : 'FALHA'}`);
            
            // Enviar credenciais formatadas
            await this.enviarMensagem(telefone, Msg.credentials(resp));
            State.clearState(telefone);
          } else {
            this.audit.accountCreationError(st.transactionId, telefone, new Error('Falha na criação da conta'));
            await this.enviarMensagem(telefone, 'Pagamento confirmado, mas houve um erro ao criar sua conta. Vamos tentar novamente em instantes.');
          }
        } catch (error) {
          this.audit.accountCreationError(st.transactionId, telefone, error);
          await this.enviarMensagem(telefone, 'Pagamento confirmado, mas houve um erro técnico. Nossa equipe foi notificada.');
        }
      } else {
        await this.enviarMensagem(telefone, Msg.paymentNotConfirmed());
      }
      return;
    }

    // Usuário disse que NÃO pagou
    if (texto === '2') {
      await this.enviarMensagem(telefone, Msg.paymentNotConfirmedShort());
      return;
    }





    // Comando 0: Menu principal
    // Aceitar 'menu' por texto
    if (texto === '0' || textoNormalizado === 'menu') {
      await this.mostrarMenu(telefone);
      this.userStates.set(telefone, { step: 'menu' });
      return;
    }

    // Comando 1: Planos
    if (texto === '1') {
      await this.mostrarPlanos(telefone);
      // O estado só muda para 'escolher_plano', cobrança só ocorre se o usuário escolher um plano depois
      this.userStates.set(telefone, { step: 'escolher_plano' });
      return;
    }

    // Comando 2: Status
    if (texto === '2') {
      await this.mostrarStatus(telefone, cliente.id);
      return;
    }

    // Comando 3: Credenciais
    // Aceitar 'credenciais' por texto
    if (texto === '3' || textoNormalizado === 'credenciais') {
      const credenciais = this.credentials.getCredentials(telefone);
      if (credenciais) {
        await this.enviarMensagem(telefone, this.credentials.formatCredentialsMessage(credenciais));
      } else {
        await this.enviarMensagem(telefone, 'Você ainda não possui credenciais IPTV. Digite *1* para ver os planos disponíveis.');
      }
      return;
    }

    // Comando 4: Renovar
    // Aceitar 'renovar' por texto
    if (texto === '4' || textoNormalizado === 'renovar') {
      await this.mostrarPlanos(telefone, true);
      this.userStates.set(telefone, { step: 'renovar_plano' });
      return;
    }

    // Comando 5: Tutoriais
    // Aceitar 'tutoriais' por texto
    if (texto === '5' || textoNormalizado === 'tutoriais') {
      await this.mostrarTutoriais(telefone);
      this.userStates.set(telefone, { step: 'escolher_tutorial' });
      return;
    }

    // Comando 6: Teste grátis
    if (texto === '6') {
      await this.mostrarPlanos(telefone);
      this.userStates.set(telefone, { step: 'escolher_plano' });
      return;
    }



    // Processar seleção de plano
    if (userState.step === 'escolher_plano' || userState.step === 'renovar_plano') {
      await this.processarSelecaoPlano(telefone, texto, cliente, userState.step === 'renovar_plano');
      return;
    }

    // Processar seleção de tutorial
    if (userState.step === 'escolher_tutorial') {
      await this.processarSelecaoTutorial(telefone, texto);
      return;
    }

    // Processar opção de instalação
    if (userState.step === 'opcao_instalacao') {
      await this.processarOpcaoInstalacao(telefone, texto, userState.tipoTv);
      return;
    }

    // Comando não reconhecido
    await this.enviarMensagem(telefone, 
      '❓ Comando não reconhecido.\n\nDigite *0* para ver o menu de opções disponíveis.'
    );
  }

  async mostrarMenu(telefone) {
    const menu = `🎬 *BEM-VINDO AO IPTV BOT* 🎬

Escolha uma opção digitando apenas o *NÚMERO*:

1️⃣ *PLANOS* - Ver planos disponíveis
2️⃣ *STATUS* - Verificar sua assinatura
3️⃣ *CREDENCIAIS* - Ver seus logins IPTV
4️⃣ *RENOVAR* - Renovar assinatura
5️⃣ *TUTORIAIS* - Como instalar IPTV
6️⃣ *TESTE GRÁTIS* - Conta teste limitada

📝 *COMO USAR:*
Digite apenas o número da opção (ex: *1*, *2*, *3*)

💡 *Dica:* Digite *0* para voltar ao menu principal.`;

    await this.enviarMensagem(telefone, menu);
  }

  async mostrarPlanos(telefone, isRenovacao = false) {
    const titulo = isRenovacao ? '🔄 *RENOVAÇÃO DE ASSINATURA*' : '📺 *ZielIPTV - PLANOS DISPONÍVEIS*';
    
    const planos = `${titulo}
🔥 *Qualidade máxima, sem travamentos. Testado e aprovado!*

Escolha digitando apenas o *NÚMERO*:

1️⃣ *CONTA TESTE* - GRÁTIS
✅ Teste gratuito por tempo limitado
✅ Todos os canais + filmes + séries
✅ Qualidade HD/4K
✅ Sem compromisso
⚠️ *Limitação:* 1 teste por cliente a cada 60 dias

2️⃣ *PLANO MENSAL* - R$ 35,00
✅ Ideal para testar o serviço
✅ Acesso completo por 30 dias
✅ Todos os canais + filmes + séries
✅ Qualidade HD/4K

3️⃣ *PLANO TRIMESTRAL* - R$ 90,00
💸 *ECONOMIZE R$ 15* (sai por R$ 30/mês)
✅ Acesso por 3 meses completos
✅ Melhor custo-benefício
✅ Estabilidade garantida

4️⃣ *PLANO SEMESTRAL* - R$ 170,00
💸 *ECONOMIZE R$ 40* (sai por R$ 28,33/mês)
✅ Acesso por 6 meses completos
✅ Maior economia
✅ Sem preocupações por meio ano

5️⃣ *PLANO ANUAL* - R$ 300,00
💸 *ECONOMIZE R$ 120* (sai por R$ 25/mês)
✅ Acesso por 12 meses completos
✅ MAIOR ECONOMIA DO ANO!
✅ Pagou e esqueceu por 1 ano
✅ Suporte prioritário

🔧 *Taxa de instalação técnica:* R$ 20,00
(Opcional - para quem quer instalação profissional)

💳 *Pagamento via PIX* - Ativação instantânea!
📝 Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, planos);
  }

  async mostrarSuporte(telefone) {
    const suporte = `🆘 *SUPORTE TÉCNICO* 🆘

📞 *Atendimento:*
• WhatsApp: (11) 99999-9999
• Telegram: @suporte_iptv
• Email: suporte@iptv.com

🕐 *Horário de atendimento:*
Segunda a Domingo: 8h às 22h

❓ *Dúvidas frequentes:*
• Como configurar o app
• Problemas de conexão
• Alteração de dados
• Cancelamento

⬅️ Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, suporte);
  }

  async mostrarTutoriais(telefone) {
    const tutoriais = `📺 *TUTORIAIS DE INSTALAÇÃO IPTV* 📺

Escolha digitando apenas o *NÚMERO*:

1️⃣ *SAMSUNG* - Smart TV Samsung
2️⃣ *ANDROID TV* - TV Box / Smart Android  
3️⃣ *LG* - Smart TV LG
4️⃣ *ROKU* - Roku TV
5️⃣ *PC* - Computador/Notebook
6️⃣ *SS IPTV* - Adicionar playlist
7️⃣ *CELULAR ANDROID* - Smartphone Android
8️⃣ *CELULAR IPHONE* - iPhone/iPad

📝 Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, tutoriais);
  }

  async processarSelecaoTutorial(telefone, texto) {
    // Mapeamento de números para tutoriais
    const tutoriaisValidos = {
      '1': {
        nome: 'Samsung Smart TV',
        app: 'Lazer Play',
        video: 'https://youtu.be/qlSRNVQgkIU?si=93w7CP7djeyIBd4h',
        tipo: 'samsung'
      },
      '2': {
        nome: 'Android TV / TV Box',
        app: 'Uniplay IPTV',
        video: 'https://www.youtube.com/watch?v=FAoP4uu3vWs',
        tipo: 'android'
      },
      '3': {
        nome: 'LG Smart TV',
        app: 'Smarters Pro',
        video: 'https://www.youtube.com/watch?v=2sMmOCtlhoo',
        tipo: 'lg'
      },
      '4': {
        nome: 'Roku TV',
        app: 'IPTV Player',
        video: 'https://www.youtube.com/watch?v=f_-1YmGawlE',
        tipo: 'roku'
      },
      '5': {
        nome: 'PC/Notebook',
        app: 'Purple Player',
        video: 'https://www.youtube.com/watch?v=qtjlLoBM1cw',
        tipo: 'pc'
      },
      '6': {
        nome: 'SS IPTV',
        app: 'SS IPTV (adicionar playlist)',
        video: 'https://www.youtube.com/watch?v=NSzrIep2ZjM',
        tipo: 'ssiptv'
      },
      '7': {
        nome: 'Celular Android',
        app: 'IPTV Smarters Pro',
        video: 'https://www.youtube.com/watch?v=kYBXTwHhPUc',
        tipo: 'android_mobile'
      },
      '8': {
        nome: 'iPhone/iPad',
        app: 'IPTV Smarters Pro',
        video: 'https://www.youtube.com/watch?v=mF8jJ5rKjgE',
        tipo: 'ios_mobile'
      }
    };

    const tutorialSelecionado = tutoriaisValidos[texto];
    
    if (!tutorialSelecionado) {
      await this.enviarMensagem(telefone, 
        '❌ Opção inválida. Digite um número de *1* a *8* conforme o menu de tutoriais.\n\nDigite *0* para voltar ao menu principal.'
      );
      this.userStates.set(telefone, { step: 'menu' });
      return;
    }

    // Mostrar opções de instalação
    const opcoes = `🔧 *INSTALAÇÃO ${tutorialSelecionado.nome.toUpperCase()}* 🔧

Escolha digitando apenas o *NÚMERO*:

1️⃣ *FAÇA VOCÊ MESMO* - GRATUITO
• Tutorial em vídeo passo a passo
• Aplicativo: ${tutorialSelecionado.app}
• Suporte via chat
• *GRATUITO*

2️⃣ *INSTALAÇÃO TÉCNICA* - R$ 20,00
• Técnico especializado
• Instalação remota via TeamViewer
• Configuração completa
• Garantia de funcionamento
• *R$ 20,00*

📝 Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, opcoes);
    
    // Salvar estado
    this.userStates.set(telefone, { 
      step: 'opcao_instalacao', 
      tipoTv: tutorialSelecionado.tipo,
      tutorial: tutorialSelecionado 
    });
  }

  async processarOpcaoInstalacao(telefone, texto, tipoTv) {
    const userState = this.userStates.get(telefone);
    const tutorial = userState.tutorial;

    if (texto === '1') {
    // Opção 1: Tutorial gratuito
    let mensagemTutorial = `🎯 *TUTORIAL GRATUITO* 🎯

📺 *Dispositivo:* ${tutorial.nome}
📱 *Aplicativo:* ${tutorial.app}

🎬 *VÍDEO TUTORIAL:*
${tutorial.video}`;

    // Tutoriais específicos por dispositivo
    if (tipoTv === 'samsung') {
      mensagemTutorial += `

📋 *PASSO A PASSO SAMSUNG:*

📺 *1. TV Samsung Antiga (até ~2016)*
✅ Pegue o controle da TV
✅ Pressione o botão *Menu*
✅ Vá em *Rede* → pressione OK
✅ Escolha *Configurações de Rede* → pressione OK
✅ Selecione *Tipo de Conexão*: Sem fio (Wi-Fi) ou Com fio (cabo) → pressione OK
✅ Quando chegar em *Configurações IP*, selecione *Manual*

🔧 *CONFIGURAR DNS:*
Vai aparecer: IP, Sub-rede, Gateway, DNS
Vá até o campo *DNS* → digite um desses números:

🌐 *DNS DISPONÍVEIS (teste um por vez):*
• 84.17.40.32
• 149.78.185.94
• 209.14.68.83
• 135.148.43.69

💡 *DICA:* Se um DNS não funcionar, teste o próximo da lista!

📺 *2. TV Samsung Nova (2017+)*
✅ Instale o app ${tutorial.app} na Smart TV
✅ Configure com suas credenciais IPTV
✅ Se não funcionar, mude o DNS conforme acima`;
    } else if (tipoTv === 'android_mobile') {
      mensagemTutorial += `

📋 *PASSO A PASSO CELULAR ANDROID:*

📱 *1. BAIXAR O APLICATIVO*
✅ Abra a *Google Play Store*
✅ Pesquise por "*IPTV Smarters Pro*"
✅ Baixe e instale o aplicativo
✅ Abra o app após a instalação

📱 *2. CONFIGURAR IPTV*
✅ Selecione "*Add New User*" ou "*Adicionar Usuário*"
✅ Escolha "*Login with Xtream Codes API*"
✅ Preencha os campos:
   • *Server URL*: [Seu servidor]
   • *Username*: [Seu usuário]
   • *Password*: [Sua senha]
✅ Toque em "*Add User*" ou "*Adicionar*"

📱 *3. ASSISTIR*
✅ Aguarde carregar as listas
✅ Escolha "*Live TV*" para canais ao vivo
✅ Escolha "*Movies*" para filmes
✅ Escolha "*Series*" para séries

💡 *DICAS IMPORTANTES:*
• Use Wi-Fi para melhor qualidade
• Mantenha o app sempre atualizado
• Em caso de travamento, feche e abra o app`;
    } else if (tipoTv === 'ios_mobile') {
      mensagemTutorial += `

📋 *PASSO A PASSO iPhone/iPad:*

📱 *1. BAIXAR O APLICATIVO*
✅ Abra a *App Store*
✅ Pesquise por "*IPTV Smarters Pro*"
✅ Baixe e instale o aplicativo
✅ Abra o app após a instalação

📱 *2. CONFIGURAR IPTV*
✅ Selecione "*Add New User*" ou "*Adicionar Usuário*"
✅ Escolha "*Login with Xtream Codes API*"
✅ Preencha os campos:
   • *Server URL*: [Seu servidor]
   • *Username*: [Seu usuário]
   • *Password*: [Sua senha]
✅ Toque em "*Add User*" ou "*Adicionar*"

📱 *3. ASSISTIR*
✅ Aguarde carregar as listas
✅ Escolha "*Live TV*" para canais ao vivo
✅ Escolha "*Movies*" para filmes
✅ Escolha "*Series*" para séries

💡 *DICAS IMPORTANTES:*
• Use Wi-Fi para melhor qualidade
• Permita notificações do app
• Para tela cheia, gire o dispositivo
• Em caso de travamento, feche e abra o app

🔒 *IMPORTANTE iOS:*
• Aceite as permissões solicitadas
• Se não funcionar, vá em Ajustes > Geral > Gerenciamento de Dispositivo`;
    } else {
      mensagemTutorial += `

📋 *PASSO A PASSO:*
1️⃣ Acesse o vídeo acima
2️⃣ Siga as instruções do tutorial
3️⃣ Use suas credenciais IPTV
4️⃣ Em caso de dúvidas, digite *0* para voltar ao menu`;
    }

    mensagemTutorial += `

✅ *SUAS CREDENCIAIS:*
Digite *6* para ver seus logins

💡 *Dica:* Tenha suas credenciais IPTV em mãos antes de começar!

📝 Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, mensagemTutorial);
      
    } else if (texto === '2') {
    // Opção 2: Instalação técnica paga
    const mensagemTecnico = `👨‍💻 *INSTALAÇÃO TÉCNICA* 👨‍💻

📺 *Dispositivo:* ${tutorial.nome}
💰 *Valor:* R$ 20,00

✅ *O QUE ESTÁ INCLUÍDO:*
• Instalação remota via TeamViewer
• Configuração completa do aplicativo
• Teste de funcionamento
• Explicação de como usar
• Garantia de 7 dias

⏰ *COMO FUNCIONA:*
1️⃣ Você paga R$ 20,00 via PIX
2️⃣ Agendamos horário (mesmo dia)
3️⃣ Técnico acessa seu dispositivo remotamente
4️⃣ Instalação completa em 15-30 minutos

📱 *PARA CONTRATAR:*
Digite *3* para contratar instalação técnica

📝 Digite *0* para voltar ao menu principal`;

    await this.enviarMensagem(telefone, mensagemTecnico);
    
  } else if (texto === '3') {
    // Processar contratação do técnico
    await this.processarContratacaoTecnico(telefone, tutorial);
  } else {
    await this.enviarMensagem(telefone, 
      '❌ Opção inválida. Digite *1* para tutorial gratuito, *2* para instalação técnica ou *0* para voltar ao menu.'
    );
    this.userStates.set(telefone, { step: 'menu' });
    return;
  }

  // Resetar estado após processamento
  this.userStates.set(telefone, { step: 'menu' });
}

  async processarContratacaoTecnico(telefone, tutorial) {
    const mensagemPagamento = `💳 *PAGAMENTO INSTALAÇÃO TÉCNICA* 💳

📺 *Serviço:* Instalação ${tutorial.nome}
💰 *Valor:* R$ 20,00

📱 *Para pagar:*
1. Abra o app do seu banco
2. Escaneie o QR Code abaixo
3. Confirme o pagamento

⏰ *Após o pagamento:*
• Entraremos em contato em até 2 horas
• Agendaremos horário para instalação
• Instalação no mesmo dia

🔄 *Gerando PIX...*`;

    await this.enviarMensagem(telefone, mensagemPagamento);
    
    // Aqui você pode integrar com a PagHiper para gerar cobrança de R$ 20,00
    // Similar ao processo de planos, mas para serviço técnico
    
    console.log(`Solicitação de instalação técnica: ${telefone} - ${tutorial.nome}`);
  }

  async mostrarStatus(telefone, clienteId) {
    try {
      // Buscar assinaturas ativas do cliente
      const assinaturas = await this.db.db.all(`
        SELECT * FROM assinaturas 
        WHERE cliente_id = ? AND status = 'ativa'
        ORDER BY data_vencimento DESC
      `, [clienteId]);

      if (assinaturas.length === 0) {
        await this.enviarMensagem(telefone, 
          '📋 *STATUS DA ASSINATURA*\n\n❌ Você não possui assinaturas ativas.\n\nDigite *1* para ver planos disponíveis.'
        );
        return;
      }

      let statusMsg = '📋 *STATUS DAS SUAS ASSINATURAS*\n\n';

      for (const assinatura of assinaturas) {
        const dataVencimento = new Date(assinatura.data_vencimento);
        const hoje = new Date();
        const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

        statusMsg += `📦 *Plano:* ${assinatura.plano.toUpperCase()}\n`;
        statusMsg += `💰 *Valor:* R$ ${assinatura.valor.toFixed(2)}\n`;
        statusMsg += `📅 *Vence em:* ${diasRestantes} dias (${dataVencimento.toLocaleDateString('pt-BR')})\n`;
        statusMsg += `✅ *Status:* ${assinatura.status.toUpperCase()}\n`;
        
        if (assinatura.usuario_iptv) {
          statusMsg += `👤 *Usuário:* ${assinatura.usuario_iptv}\n`;
          statusMsg += `🔐 *Senha:* ${assinatura.senha_iptv}\n`;
        }
        
        statusMsg += '\n---\n\n';
      }

      statusMsg += '⬅️ Digite *0* para voltar ao menu principal';
      await this.enviarMensagem(telefone, statusMsg);

    } catch (error) {
      console.error('Erro ao buscar status:', error);
      await this.enviarMensagem(telefone, '❌ Erro ao buscar informações. Tente novamente.');
    }
  }

  async processarSelecaoPlano(telefone, texto, cliente, isRenovacao) {
    // Mapeamento de números para planos
    const planosValidos = {
      '1': { nome: 'Teste', valor: 0, duracao: 3, economia: 0, tipo: 'teste' },
      '2': { nome: 'Mensal', valor: 35.00, duracao: 30, economia: 0, tipo: 'mensal' },
      '3': { nome: 'Trimestral', valor: 90.00, duracao: 90, economia: 15, tipo: 'trimestral' },
      '4': { nome: 'Semestral', valor: 170.00, duracao: 180, economia: 40, tipo: 'semestral' },
      '5': { nome: 'Anual', valor: 300.00, duracao: 365, economia: 120, tipo: 'anual' }
    };

    const planoSelecionado = planosValidos[texto];
    
    if (!planoSelecionado) {
      await this.enviarMensagem(telefone, 
        '❌ Opção inválida. Digite um número de *1* a *5* conforme o menu de planos.\n\nDigite *0* para voltar ao menu principal.'
      );
      this.userStates.set(telefone, { step: 'menu' });
      return;
    }

    // Processar conta teste (opção 1)
    if (planoSelecionado.tipo === 'teste') {
      await this.enviarMensagem(telefone, Msg.testCreating());
      const resp = await createTestIfEligible({ telefone, pacote: 2, anotacoes: 'Gerado via WhatsApp' });
      if (resp && resp.success) {
        this.credentials.saveCredentials(telefone, resp, 'teste');
        await this.enviarMensagem(telefone, Msg.credentials(resp));
      } else if (resp && resp.reason === 'cooldown') {
        await this.enviarMensagem(telefone, Msg.testNotAllowed(resp.remainingDays || 60));
      } else {
        await this.enviarMensagem(telefone, Msg.genericError());
      }
      this.userStates.set(telefone, { step: 'menu' });
      return;
    }

    // Gerar cobrança PIX para planos pagos
    await this.enviarMensagem(telefone, '⏳ Gerando cobrança PIX... Aguarde um momento.');

    try {
      const cobranca = await gerarCobrancaPix(cliente, planoSelecionado.tipo);

      if (!cobranca.success) {
        await this.enviarMensagem(telefone, `❌ Erro ao gerar cobrança: ${cobranca.error}`);
        return;
      }

      // Criar assinatura pendente
      const dataInicio = new Date();
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + planoSelecionado.duracao);

      const assinaturaId = await this.db.criarAssinatura(
        cliente.id,
        planoSelecionado.tipo,
        planoSelecionado.valor,
        dataInicio.toISOString().split('T')[0],
        dataVencimento.toISOString().split('T')[0]
      );

      // Criar transação
      await this.db.criarTransacao(
        cliente.id,
        assinaturaId,
        cobranca.txid,
        planoSelecionado.valor,
        cobranca.qrCode,
        cobranca.qrCodeText,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );

      // Criar mensagem de pagamento persuasiva
      let mensagemEconomia = '';
      if (planoSelecionado.economia > 0) {
        const valorMensal = planoSelecionado.valor / (planoSelecionado.duracao / 30);
        mensagemEconomia = `💸 *VOCÊ ESTÁ ECONOMIZANDO R$ ${planoSelecionado.economia.toFixed(2)}!*
📉 Sai por apenas R$ ${valorMensal.toFixed(2)}/mês

`;
      }
      
      const mensagemPagamento = `🔥 *PARABÉNS PELA ESCOLHA INTELIGENTE!* 🔥

📦 *Plano:* ${planoSelecionado.nome} (${planoSelecionado.duracao} dias)
💰 *Valor:* R$ ${planoSelecionado.valor.toFixed(2)}
${mensagemEconomia}
✅ *BENEFÍCIOS INCLUSOS:*
• +50.000 canais HD/4K
• Filmes e séries ilimitados
• Canais premium e adultos
• Sem travamentos
• Suporte 24h
• Ativação instantânea

📱 *PAGUE AGORA VIA PIX:*
1️⃣ Abra o app do seu banco
2️⃣ Escaneie o QR Code abaixo
3️⃣ Confirme o pagamento

⏰ *ATENÇÃO:* QR Code válido por 24h
🚀 *Após pagamento = Ativação IMEDIATA!*

📋 *PIX COPIA E COLA:*
${cobranca.qrCodeText}`;

      await this.enviarMensagem(telefone, mensagemPagamento);

      // Enviar QR Code como imagem se disponível
      if (cobranca.qrCode) {
        try {
          try {
            const media = await this.client.sendMessage(telefone + '@c.us', {
              media: cobranca.qrCode,
              caption: '📱 QR Code para pagamento PIX'
            });
          } catch (err) {
            await this.enviarMensagem(telefone, '⚠️ Não foi possível enviar o QR Code como imagem, mas você pode usar o PIX Copia e Cola acima normalmente.');
          }
        } catch (error) {
          console.error('Erro ao enviar QR Code:', error);
        }
      }

      // Resetar estado do usuário
      this.userStates.set(telefone, { step: 'menu' });

    } catch (error) {
      console.error('Erro ao processar seleção de plano:', error);
      await this.enviarMensagem(telefone, '❌ Erro interno. Tente novamente em alguns instantes.');
    }
  }

  async enviarMensagem(telefone, texto) {
    try {
      await this.client.sendMessage(telefone + '@c.us', texto);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }

  // Método para processar pagamentos aprovados
  async processarPagamentoAprovado(transactionId) {
    try {
      const transacao = await this.db.buscarTransacao(transactionId);
      if (!transacao) {
        console.error('Transação não encontrada:', transactionId);
        return;
      }

      // Atualizar status da transação
      await this.db.atualizarStatusTransacao(transactionId, 'aprovada');

      // Buscar cliente
      const cliente = await this.db.db.get('SELECT * FROM clientes WHERE id = ?', [transacao.cliente_id]);
      
      // Gerar credenciais IPTV
      const credenciais = this.iptvUtils.gerarCredenciais(cliente.telefone);
      
      // Criar usuário no servidor IPTV
      const resultadoIPTV = await this.iptvUtils.criarUsuarioIPTV(credenciais, transacao.plano);
      
      if (resultadoIPTV.success) {
        // Atualizar assinatura com credenciais
        await this.db.atualizarCredenciaisIPTV(
          transacao.assinatura_id,
          credenciais.usuario,
          credenciais.senha,
          credenciais.urlServidor
        );

        // Buscar dados da assinatura
        const assinatura = await this.db.db.get('SELECT * FROM assinaturas WHERE id = ?', [transacao.assinatura_id]);
        
        // Enviar credenciais por WhatsApp
        const mensagemCredenciais = this.iptvUtils.formatarMensagemCredenciais(
          credenciais,
          assinatura.plano,
          assinatura.data_vencimento
        );

        await this.enviarMensagem(cliente.telefone, mensagemCredenciais);
        
        console.log(`Credenciais enviadas para ${cliente.telefone}`);
      } else {
        console.error('Erro ao criar usuário IPTV:', resultadoIPTV.error);
        await this.enviarMensagem(cliente.telefone, 
          '❌ Pagamento aprovado, mas houve erro na ativação. Nosso suporte entrará em contato.'
        );
      }

    } catch (error) {
      console.error('Erro ao processar pagamento aprovado:', error);
    }
  }

  // Método para verificar vencimentos
  async verificarVencimentos() {
    try {
      const assinaturasVencendo = await this.db.buscarAssinaturasVencendo(3);
      
      for (const assinatura of assinaturasVencendo) {
        const dataVencimento = new Date(assinatura.data_vencimento);
        const hoje = new Date();
        const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

        const mensagem = this.iptvUtils.formatarMensagemVencimento(
          assinatura.nome,
          assinatura.data_vencimento,
          diasRestantes
        );

        await this.enviarMensagem(assinatura.telefone, mensagem);
        console.log(`Aviso de vencimento enviado para ${assinatura.telefone}`);
      }

    } catch (error) {
      console.error('Erro ao verificar vencimentos:', error);
    }
  }
}

module.exports = MessageHandler;

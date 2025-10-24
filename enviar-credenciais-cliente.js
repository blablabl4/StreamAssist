/**
 * Enviar Credenciais de Teste para o Cliente via WhatsApp
 * Envia as credenciais recém-criadas automaticamente
 */

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Msg = require('./utils/messages');

async function enviarCredenciaisCliente() {
  console.log('📱 ENVIANDO CREDENCIAIS PARA O CLIENTE VIA WHATSAPP');
  console.log('=' .repeat(60));
  
  // Ler as credenciais criadas
  const arquivoResultado = path.join(__dirname, 'data', 'ultimo-teste-criado.json');
  
  if (!fs.existsSync(arquivoResultado)) {
    console.log('❌ Arquivo de credenciais não encontrado');
    return;
  }
  
  const dadosCliente = JSON.parse(fs.readFileSync(arquivoResultado, 'utf8'));
  const telefone = dadosCliente.cliente.telefone + '@c.us';
  const credenciais = dadosCliente.credenciais;
  
  console.log('📱 Enviando para:', dadosCliente.cliente.telefone);
  console.log('👤 Usuário:', credenciais.usuario);
  console.log('🔑 Senha:', credenciais.senha);
  
  try {
    // Simular envio via cliente WhatsApp existente (usando o bot que já está rodando)
    // Como o bot já está conectado, vamos usar uma abordagem mais direta
    
    const mensagemCredenciais = `🎉 *CONTA TESTE IPTV CRIADA!*

👤 *Usuário:* ${credenciais.usuario}
🔑 *Senha:* ${credenciais.senha}
📺 *Tipo:* Conta Teste
📦 *Pacote:* Completo sem adultos
⏰ *Duração:* Limitada (teste)

🔗 *LINKS IPTV DISPONÍVEIS:*
Escolha um dos links abaixo para configurar no seu app:

${credenciais.links ? credenciais.links.map((link, i) => `${i + 1}. ${link}`).join('\n') : 'Links serão enviados em breve'}

📱 *COMO USAR:*
1. Baixe um app IPTV (VU Player, Smart IPTV, etc)
2. Configure com as credenciais acima
3. Use um dos links fornecidos
4. Aproveite o teste!

💰 *QUER CONTA OFICIAL?*
• Digite: *MENSAL*, *TRIMESTRAL*, *SEMESTRAL* ou *ANUAL*
• Pague o PIX gerado
• Receba conta oficial com período completo

❓ *PRECISA DE AJUDA?*
• Digite *SUPORTE* para falar conosco
• Digite *TUTORIAL* para ver como configurar

✅ Sua conta teste está ativa e pronta para uso!`;

    // Salvar mensagem para envio manual ou automático
    const mensagemParaEnvio = {
      telefone: dadosCliente.cliente.telefone,
      mensagem: mensagemCredenciais,
      timestamp: new Date().toISOString(),
      tipo: 'credenciais_teste'
    };
    
    const arquivoMensagem = path.join(__dirname, 'data', 'mensagem-para-envio.json');
    fs.writeFileSync(arquivoMensagem, JSON.stringify(mensagemParaEnvio, null, 2));
    
    console.log('\n✅ MENSAGEM PREPARADA PARA ENVIO!');
    console.log('📄 Salva em:', arquivoMensagem);
    console.log('\n📱 MENSAGEM A SER ENVIADA:');
    console.log('-'.repeat(60));
    console.log(mensagemCredenciais);
    console.log('-'.repeat(60));
    
    console.log('\n💡 PRÓXIMO PASSO:');
    console.log('A mensagem está pronta. Como o bot WhatsApp já está rodando,');
    console.log('você pode enviar manualmente ou integrar ao fluxo automático.');
    
  } catch (error) {
    console.log('❌ Erro ao preparar envio:', error.message);
  }
  
  console.log('\n✅ Processo concluído!');
}

// Executar envio
enviarCredenciaisCliente().catch(console.error);

/**
 * Seletor Inteligente de Links IPTV
 * Seleciona o melhor link M3U baseado no dispositivo/app do usuário
 */

class LinkSelector {
  constructor() {
    // Mapeamento de dispositivos/apps para formatos preferidos
    this.devicePreferences = {
      // Apps Mobile
      'vu player': { format: 'hls', type: 'mobile', priority: ['hls', 'ts', 'm3u'] },
      'xciptv': { format: 'hls', type: 'mobile', priority: ['hls', 'ts', 'm3u'] },
      'iptv smarters': { format: 'hls', type: 'mobile', priority: ['hls', 'ts', 'm3u'] },
      'gse smart iptv': { format: 'ts', type: 'mobile', priority: ['ts', 'hls', 'm3u'] },
      'perfect player': { format: 'ts', type: 'mobile', priority: ['ts', 'hls', 'm3u'] },
      
      // Smart TV
      'smart tv': { format: 'hls', type: 'tv', priority: ['hls', 'ts', 'm3u'] },
      'samsung tv': { format: 'hls', type: 'tv', priority: ['hls', 'ts', 'm3u'] },
      'lg tv': { format: 'hls', type: 'tv', priority: ['hls', 'ts', 'm3u'] },
      'android tv': { format: 'hls', type: 'tv', priority: ['hls', 'ts', 'm3u'] },
      'fire tv': { format: 'hls', type: 'tv', priority: ['hls', 'ts', 'm3u'] },
      
      // TV Box
      'tv box': { format: 'ts', type: 'box', priority: ['ts', 'hls', 'm3u'] },
      'mi box': { format: 'hls', type: 'box', priority: ['hls', 'ts', 'm3u'] },
      'chromecast': { format: 'hls', type: 'box', priority: ['hls', 'ts', 'm3u'] },
      
      // PC/Desktop
      'vlc': { format: 'm3u', type: 'desktop', priority: ['m3u', 'ts', 'hls'] },
      'kodi': { format: 'm3u', type: 'desktop', priority: ['m3u', 'ts', 'hls'] },
      'pc': { format: 'm3u', type: 'desktop', priority: ['m3u', 'ts', 'hls'] },
      'windows': { format: 'm3u', type: 'desktop', priority: ['m3u', 'ts', 'hls'] },
      'mac': { format: 'm3u', type: 'desktop', priority: ['m3u', 'hls', 'ts'] },
      
      // Roku
      'roku': { format: 'hls', type: 'roku', priority: ['hls', 'ts', 'm3u'] },
      
      // Default
      'default': { format: 'hls', type: 'generic', priority: ['hls', 'ts', 'm3u'] }
    };
  }

  /**
   * Seleciona o melhor link baseado no dispositivo/app informado
   * @param {Array} links - Array de links disponíveis
   * @param {string} deviceInfo - Informação do dispositivo/app (ex: "VU Player", "Smart TV Samsung")
   * @returns {Object} - Objeto com link recomendado e informações
   */
  selectBestLink(links, deviceInfo = '') {
    if (!links || links.length === 0) {
      return { error: 'Nenhum link disponível' };
    }

    // Normalizar entrada do usuário
    const normalizedDevice = deviceInfo.toLowerCase().trim();
    
    // Detectar dispositivo/app
    const detectedDevice = this.detectDevice(normalizedDevice);
    const preferences = this.devicePreferences[detectedDevice] || this.devicePreferences.default;
    
    // Categorizar links disponíveis
    const categorizedLinks = this.categorizeLinks(links);
    
    // Selecionar melhor link baseado na preferência
    const bestLink = this.findBestLink(categorizedLinks, preferences);
    
    // Preparar instruções específicas para o dispositivo
    const instructions = this.getInstructions(detectedDevice, bestLink);
    
    return {
      recommendedLink: bestLink.url,
      linkType: bestLink.type,
      device: detectedDevice,
      deviceType: preferences.type,
      instructions: instructions,
      alternativeLinks: this.getAlternativeLinks(categorizedLinks, bestLink),
      credentials: bestLink.credentials
    };
  }

  /**
   * Detecta o dispositivo/app baseado na entrada do usuário
   */
  detectDevice(input) {
    // Buscar correspondência exata ou parcial
    for (const device in this.devicePreferences) {
      if (input.includes(device) || device.includes(input)) {
        return device;
      }
    }
    
    // Detecção por palavras-chave
    if (input.includes('tv') || input.includes('televisão')) return 'smart tv';
    if (input.includes('celular') || input.includes('mobile') || input.includes('android')) return 'vu player';
    if (input.includes('pc') || input.includes('computador')) return 'pc';
    if (input.includes('box')) return 'tv box';
    
    return 'default';
  }

  /**
   * Categoriza os links por tipo
   */
  categorizeLinks(links) {
    const categorized = {
      hls: [],
      ts: [],
      m3u: [],
      short: [],
      apps: []
    };

    links.forEach(link => {
      if (typeof link === 'string') {
        if (link.includes('output=hls')) {
          categorized.hls.push({ url: link, type: 'hls', credentials: this.extractCredentials(link) });
        } else if (link.includes('output=ts')) {
          categorized.ts.push({ url: link, type: 'ts', credentials: this.extractCredentials(link) });
        } else if (link.includes('type=m3u')) {
          categorized.m3u.push({ url: link, type: 'm3u', credentials: this.extractCredentials(link) });
        } else if (link.includes('tinyurl.com') || link.includes('5664.in')) {
          categorized.short.push({ url: link, type: 'short', credentials: null });
        } else {
          categorized.apps.push({ url: link, type: 'app', credentials: null });
        }
      }
    });

    return categorized;
  }

  /**
   * Encontra o melhor link baseado nas preferências
   */
  findBestLink(categorizedLinks, preferences) {
    for (const format of preferences.priority) {
      if (categorizedLinks[format] && categorizedLinks[format].length > 0) {
        return categorizedLinks[format][0]; // Retorna o primeiro da categoria preferida
      }
    }
    
    // Fallback: retorna qualquer link disponível
    for (const category in categorizedLinks) {
      if (categorizedLinks[category].length > 0) {
        return categorizedLinks[category][0];
      }
    }
    
    return { url: '', type: 'none', credentials: null };
  }

  /**
   * Extrai credenciais do link
   */
  extractCredentials(link) {
    const usernameMatch = link.match(/username=([^&]+)/);
    const passwordMatch = link.match(/password=([^&]+)/);
    const serverMatch = link.match(/https?:\/\/([^\/]+)/);
    
    return {
      username: usernameMatch ? usernameMatch[1] : null,
      password: passwordMatch ? passwordMatch[1] : null,
      server: serverMatch ? serverMatch[1] : null
    };
  }

  /**
   * Gera instruções específicas para o dispositivo
   */
  getInstructions(device, bestLink) {
    const baseInstructions = {
      'vu player': [
        '📱 No VU Player:',
        '1. Abra o app VU Player',
        '2. Toque em "+" para adicionar playlist',
        '3. Cole a URL M3U recomendada',
        '4. Aguarde carregar os canais'
      ],
      'xciptv': [
        '📱 No XCIPTV:',
        '1. Abra o XCIPTV',
        '2. Vá em "Add Playlist"',
        '3. Selecione "M3U URL"',
        '4. Cole a URL e confirme'
      ],
      'smart tv': [
        '📺 Na Smart TV:',
        '1. Instale um app IPTV (Smart IPTV, SS IPTV)',
        '2. Configure com as credenciais:',
        `   • Servidor: ${bestLink.credentials?.server || 'N/A'}`,
        `   • Usuário: ${bestLink.credentials?.username || 'N/A'}`,
        `   • Senha: ${bestLink.credentials?.password || 'N/A'}`
      ],
      'vlc': [
        '💻 No VLC:',
        '1. Abra o VLC Media Player',
        '2. Vá em "Mídia" > "Abrir Fluxo de Rede"',
        '3. Cole a URL M3U',
        '4. Clique em "Reproduzir"'
      ],
      'default': [
        '📺 Configuração Geral:',
        '1. Use a URL M3U recomendada',
        '2. Se o app pedir credenciais separadas:',
        `   • Servidor: ${bestLink.credentials?.server || 'N/A'}`,
        `   • Usuário: ${bestLink.credentials?.username || 'N/A'}`,
        `   • Senha: ${bestLink.credentials?.password || 'N/A'}`
      ]
    };

    return baseInstructions[device] || baseInstructions.default;
  }

  /**
   * Retorna links alternativos
   */
  getAlternativeLinks(categorizedLinks, bestLink) {
    const alternatives = [];
    
    for (const category in categorizedLinks) {
      categorizedLinks[category].forEach(link => {
        if (link.url !== bestLink.url) {
          alternatives.push({
            url: link.url,
            type: link.type,
            description: this.getLinkDescription(link.type)
          });
        }
      });
    }
    
    return alternatives.slice(0, 3); // Máximo 3 alternativas
  }

  /**
   * Retorna descrição do tipo de link
   */
  getLinkDescription(type) {
    const descriptions = {
      'hls': 'HLS - Melhor para mobile e Smart TV',
      'ts': 'TS - Melhor para TV Box e alguns apps',
      'm3u': 'M3U - Melhor para PC e VLC',
      'short': 'Link encurtado - Fácil de digitar',
      'app': 'Link de aplicativo'
    };
    
    return descriptions[type] || 'Link alternativo';
  }
}

module.exports = LinkSelector;

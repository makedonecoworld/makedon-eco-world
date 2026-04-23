/**
 * Makedon Eco World – Qwen Agent
 * 🤖 AI агент за верификација на амбалажа преку компјутерска визија
 * 👁️ Qwen-VL (Alibaba Cloud) + локализација за балкански јазици
 * 📴 Офлајн фолбек со локален модел за слаб интернет
 * 📧 Интеграција: makedonecoworld@outlook.com
 */

// ===== КОНФИГУРАЦИЈА =====
const QWEN_CONFIG = {
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  model: 'qwen-vl-max',
  region: 'balkans',
  languages: ['mk', 'sq', 'sr', 'bg', 'en'],
  itemTypes: {
    plastic: { name_mk: 'пластично шише', deposit_mkd: 6, icon: '🥤' },
    glass: { name_mk: 'стаклено шише', deposit_mkd: 10, icon: '🍾' },
    aluminum: { name_mk: 'лименка', deposit_mkd: 8, icon: '🥫' },
    invalid: { name_mk: 'неприфатлив предмет', deposit_mkd: 0, icon: '❌' }
  },
  offlineMode: {
    enabled: true,
    confidenceThreshold: 0.7,
    conservativeAccept: true // Прифаќај со пониска сигурност офлајн
  }
};

// ===== ГЛАВНА КЛАСА =====
export class QwenAgent {
  constructor(options = {}) {
    this.apiKey = options.apiKey || import.meta?.env?.VITE_QWEN_KEY || 'mock-key';
    this.endpoint = QWEN_CONFIG.endpoint;
    this.model = QWEN_CONFIG.model;
    this.region = QWEN_CONFIG.region;
    this.languages = QWEN_CONFIG.languages;
    this.requestCount = 0;
    this.lastRequest = null;
    
    // Слушај за мрежни промени
    if (typeof navigator !== 'undefined') {
      this.offlineMode = !navigator.onLine;
      window.addEventListener('online', () => { this.offlineMode = false; });
      window.addEventListener('offline', () => { this.offlineMode = true; });
    }
  }

  /**
   * Верификувај предмет преку слика + метаподатоци
   * @param {string} imageData - Base64 слика или URL
   * @param {Object} metadata - Локација, временска ознака, уред, итн.
   * @returns {Promise<Object>} Резултат од верификацијата
   */
  async verifyItem(imageData, metadata = {}) {
    this.requestCount++;
    this.lastRequest = new Date();
    
    try {
      // 1. Ако сме онлајн, пробај со Qwen API
      if (!this.offlineMode && navigator.onLine) {
        return await this._callQwenAPI(imageData, metadata);
      }
      
      // 2. Офлајн режим: користи фолбек
      console.log('📴 Qwen Agent: Offline mode, using fallback');
      return await this._offlineFallback(imageData, metadata);
      
    } catch (error) {
      console.warn('Qwen verification failed, falling back to offline mode:', error);
      return await this._offlineFallback(imageData, metadata);
    }
  }

  /**
   * Повик кон Qwen-VL API (онлајн)
   * @private
   */
  async _callQwenAPI(imageData, metadata) {
    const prompt = this._buildPrompt(metadata);
    
    const payload = {
      model: this.model,
      input: {
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageData } },
            { type: 'text', text: prompt }
          ]
        }]
      },
      parameters: {
        result_format: 'json',
        temperature: 0.1 // Ниска температура за конзистентност
      }
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Region': this.region,
        'X-Request-ID': crypto?.randomUUID?.() || `req_${Date.now()}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000) // 15 секунди тајмаут
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Qwen API error ${response.status}: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return this._parseQwenResponse(result, metadata);
  }

  /**
   * Гради промпт со локализација за балкански пазар
   * @private
   */
  _buildPrompt(metadata) {
    const { language = 'mk', country = 'MK' } = metadata;
    
    return `
Ти си експерт за рециклирање на амбалажа за балканскиот пазар.

Задача: Анализирај ја сликата и одговори со СТРОГО структуриран JSON (без дополнителен текст):

{
  "is_valid": boolean,
  "item_type": "plastic" | "glass" | "aluminum" | "invalid",
  "barcode_detected": string | null,
  "brand_detected": string | null,
  "confidence_score": number (0.0-1.0),
  "deposit_value_mkd": number,
  "eco_points_earned": number,
  "message_mk": string,
  "message_${language}": string,
  "next_suggestion": "scan_more" | "view_points" | "invite_friend" | "try_again"
}

Правила:
- Прифаќај само: пластични шишиња, стаклени шишиња, алуминиумски лименки
- Одбиј: хартија, органски отпад, оштетена амбалажа, не-рециклирачки материјали
- Баркод: ако е видлив, врати го како стринг; ако не, врати null
- Сигурност: ако < 0.7, постави is_valid=false
- Јазик: генерирај пораки на македонски И на ${language}

Локални параметри:
- Земја: ${country}
- Валута: МКД
- Депозит вредности: пластично=6МКД, стакло=10МКД, алуминиум=8МКД
- 1 сисе = 1 EcoPoint

Метаподатоци: ${JSON.stringify(metadata)}

Врати САМО валиден JSON, без објаснувања.
`.trim();
  }

  /**
   * Парсира одговор од Qwen API
   * @private
   */
  _parseQwenResponse(apiResponse, metadata) {
    try {
      const content = apiResponse?.output?.choices?.[0]?.message?.content;
      let parsed;
      
      // Обиди се да парсираш како JSON
      if (typeof content === 'string') {
        // Извади го само JSON делот ако има дополнителен текст
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      } else {
        parsed = content;
      }
      
      // Валидирај го резултатот
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid response structure');
      }
      
      // Додади метаподатоци за трагање
      return {
        ...parsed,
        verified_at: new Date().toISOString(),
        agent_version: 'qwen-v1.0',
        region: this.region,
        request_id: apiResponse?.request_id || null
      };
      
    } catch (error) {
      console.error('Failed to parse Qwen response:', error);
      // Фолбек на конзервативен резултат
      return this._conservativeResult(metadata);
    }
  }

  /**
   * Офлајн фолбек со локален модел / хеуристика
   * @private
   */
  async _offlineFallback(imageData, metadata) {
    console.log('🔄 Qwen Agent: Using offline fallback');
    
    // Мокова логика за демо – во продукција: TensorFlow Lite модел
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Конзервативно прифаќање офлајн (подобро да прифатиме отколку да одбиеме)
    const conservative = QWEN_CONFIG.offlineMode.conservativeAccept;
    
    return {
      is_valid: conservative,
      item_type: 'plastic', // Претпостави најчест тип
      barcode_detected: null,
      brand_detected: null,
      confidence_score: conservative ? 0.75 : 0.5,
      deposit_value_mkd: QWEN_CONFIG.itemTypes.plastic.deposit_mkd,
      eco_points_earned: conservative ? 1 : 0,
      message_mk: conservative 
        ? '✅ Предметот е прифатен (офлајн режим). Поените ќе бидат финализирани при синхронизација.' 
        : '⚠️ Не сме сигурни во офлајн режим. Обидете се кога сте онлајн.',
      message_en: conservative
        ? '✅ Item accepted (offline mode). Points will be finalized upon sync.'
        : '⚠️ Uncertain in offline mode. Please try when online.',
      next_suggestion: conservative ? 'scan_more' : 'try_again',
      offline_mode: true,
      verified_at: new Date().toISOString(),
      agent_version: 'qwen-v1.0-offline'
    };
  }

  /**
   * Конзервативен резултат за грешки
   * @private
   */
  _conservativeResult(metadata) {
    return {
      is_valid: false,
      item_type: 'invalid',
      barcode_detected: null,
      brand_detected: null,
      confidence_score: 0,
      deposit_value_mkd: 0,
      eco_points_earned: 0,
      message_mk: '❌ Не можевме да го верификуваме предметот. Обидете се повторно со појасна слика.',
      message_en: '❌ Could not verify item. Please try again with a clearer image.',
      next_suggestion: 'try_again',
      error: 'parse_failed',
      verified_at: new Date().toISOString()
    };
  }

  /**
   * Детектирај јазик од браузер или метаподатоци
   * @public
   */
  detectLanguage(metadata = {}) {
    if (metadata.language && QWEN_CONFIG.languages.includes(metadata.language)) {
      return metadata.language;
    }
    
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
      if (QWEN_CONFIG.languages.includes(browserLang)) {
        return browserLang;
      }
    }
    
    return 'mk'; // Фолбек на македонски
  }

  /**
   * Форматирај порака според јазикот
   * @public
   */
  formatMessage(result, language = 'mk') {
    const key = `message_${language}`;
    return result[key] || result.message_mk || result.message_en || 'Processing...';
  }

  /**
   * Статистика за агентот (за аналитика)
   * @public
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequest: this.lastRequest,
      offlineMode: this.offlineMode,
      region: this.region,
      model: this.model
    };
  }
}

// ===== ГЛОБАЛЕН ИНСТАНЦА =====
export const qwenAgent = new QwenAgent();

// ===== АВТО-ИНИЦИЈАЛИЗАЦИЈА =====
if (typeof window !== 'undefined') {
  window.qwenAgent = qwenAgent;
  console.log('🤖 Qwen Agent initialized for Makedon Eco World');
  
  // Слушај за промени на јазикот (од eco-translate.js)
  window.addEventListener('eco:languageChanged', (e) => {
    console.log(`🌍 Qwen Agent: Language changed to ${e.detail.language}`);
  });
}

export default QwenAgent;

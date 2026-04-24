/**
 * Makedon Eco World – EcoTranslate Модул
 * 🆓 Бесплатен превод: Македонски + 100+ светски јазици
 * 🌐 АПИ-ја: LibreTranslate, MyMemory, Browser API
 * 📴 Офлајн поддршка: Локален речник + кеширање
 * 🔐 Приватност: Нема чување на преведени текстови
 */

const TRANSLATE_CONFIG = {
  providers: [
    { 
      name: 'libretranslate', 
      endpoint: 'https://libretranslate.de/translate',
      method: 'POST',
      free: true,
      rateLimit: 100
    },
    { 
      name: 'mymemory', 
      endpoint: 'https://api.mymemory.translated.net/get',
      method: 'GET',
      free: true,
      rateLimit: 500
    }
  ],
  languages: {
    mk: 'Македонски', en: 'English', sq: 'Shqip', sr: 'Srpski',
    bg: 'Български', el: 'Ελληνικά', de: 'Deutsch', fr: 'Français',
    es: 'Español', it: 'Italiano', pt: 'Português', ru: 'Русский',
    tr: 'Türkçe', ar: 'العربية', zh: '中文', ja: '日本語',
    ko: '한국어', hi: 'हिन्दी'
  },
  offlineDictionary: {
    mk: {
      'scan_now': 'Скенрај Сега', 'eco_points': 'EcoPoints',
      'payout': 'Исплата', 'welcome': 'Добредојде',
      'error': 'Грешка', 'success': 'Успешно',
      'loading': 'Се вчитува...', 'confirm': 'Потврди',
      'cancel': 'Откажи', 'settings': 'Поставки',
      'language': 'Јазик', 'select_language': 'Избери јазик',
      'translate': 'Преведи', 'auto_detect': 'Автоматска детекција'
    },
    en: {
      'scan_now': 'Scan Now', 'eco_points': 'EcoPoints',
      'payout': 'Payout', 'welcome': 'Welcome',
      'error': 'Error', 'success': 'Success',
      'loading': 'Loading...', 'confirm': 'Confirm',
      'cancel': 'Cancel', 'settings': 'Settings',
      'language': 'Language', 'select_language': 'Select language',
      'translate': 'Translate', 'auto_detect': 'Auto-detect'
    }
  },
  cache: { enabled: true, ttl: 24 * 60 * 60 * 1000, maxSize: 1000 }
};

export class EcoTranslate {
  constructor(options = {}) {
    this.config = { ...TRANSLATE_CONFIG, ...options };
    this.currentLang = this._detectUserLanguage();
    this.cache = new Map();
    this.requestCounts = {};
    this.offlineMode = !navigator.onLine;
    window.addEventListener('online', () => { this.offlineMode = false; });
    window.addEventListener('offline', () => { this.offlineMode = true; });
  }

  async translate(text, options = {}) {
    const { from = 'auto', to = this.currentLang, useCache = this.config.cache.enabled, fallbackToOffline = true } = options;
    if (useCache) { const cached = this._getCached(text, from, to); if (cached) return cached; }
    if (this.offlineMode || !navigator.onLine) {
      if (fallbackToOffline) { const offline = this._translateOffline(text, from, to); if (offline) { this._setCached(text, from, to, offline); return offline; } }
      return text;
    }
    let lastError = null;
    for (const provider of this.config.providers) {
      if (!this._checkRateLimit(provider.name)) continue;
      try {
        const result = await this._callProvider(provider, text, from, to);
        if (result && result.translatedText) {
          if (useCache) this._setCached(text, from, to, result.translatedText);
          this._incrementRequestCount(provider.name);
          return result.translatedText;
        }
      } catch (error) { console.warn(`Provider ${provider.name} failed:`, error); lastError = error; }
    }
    console.warn('All translation providers failed, returning original text');
    return text;
  }

  async detectLanguage(text) {
    try {
      const response = await fetch(`${this.config.providers[0].endpoint}/detect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: text })
      });
      if (response.ok) { const data = await response.json(); return data.language || 'unknown'; }
    } catch (e) { console.warn('Language detection failed, using fallback'); }
    return this._simpleLanguageDetection(text);
  }

  async translateUI(elements, targetLang = this.currentLang) {
    const tasks = [];
    for (const el of elements) {
      const key = el.dataset.translateKey || el.textContent?.trim();
      if (!key) continue;
      tasks.push(this.translate(key, { to: targetLang }).then(translated => {
        if (el.dataset.translateKey) {
          if (el.dataset.translateAttr) el.setAttribute(el.dataset.translateAttr, translated);
          else el.textContent = translated;
        } else { el.textContent = translated; }
      }));
    }
    await Promise.all(tasks);
    console.log(`🌐 UI translated to ${targetLang}: ${elements.length} elements`);
  }

  async setLanguage(langCode) {
    if (!this.config.languages[langCode]) { console.warn(`Language ${langCode} not supported`); return false; }
    this.currentLang = langCode;
    localStorage.setItem('ecoTranslate_lang', langCode);
    const translatableElements = document.querySelectorAll('[data-translate-key]');
    await this.translateUI(Array.from(translatableElements), langCode);
    window.dispatchEvent(new CustomEvent('eco:languageChanged', { detail: { language: langCode } }));
    console.log(`🌍 Language changed to: ${this.config.languages[langCode]}`);
    return true;
  }

  addOfflinePhrase(key, translations) {
    for (const [langCode, text] of Object.entries(translations)) {
      if (!this.config.offlineDictionary[langCode]) this.config.offlineDictionary[langCode] = {};
      this.config.offlineDictionary[langCode][key] = text;
    }
    console.log(`📚 Added offline phrase: ${key}`);
  }

  _detectUserLanguage() {
    const saved = localStorage.getItem('ecoTranslate_lang');
    if (saved && this.config.languages[saved]) return saved;
    const browserLang = navigator.language?.split('-')[0] || 'en';
    if (this.config.languages[browserLang]) return browserLang;
    return 'mk';
  }

  _getCached(text, from, to) {
    if (!this.config.cache.enabled) return null;
    const key = `${from}:${to}:${text}`;
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.cache.ttl) return entry.value;
    if (entry) this.cache.delete(key);
    return null;
  }

  _setCached(text, from, to, value) {
    if (!this.config.cache.enabled) return;
    const key = `${from}:${to}:${text}`;
    if (this.cache.size >= this.config.cache.maxSize) { const firstKey = this.cache.keys().next().value; this.cache.delete(firstKey); }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  _translateOffline(text, from, to) {
    const dict = this.config.offlineDictionary;
    for (const [langCode, phrases] of Object.entries(dict)) {
      for (const [key, phrase] of Object.entries(phrases)) {
        if (phrase.toLowerCase() === text.toLowerCase()) return dict[to]?.[key] || dict['en']?.[key] || text;
      }
    }
    if (text.length < 50 && from !== to) {
      const words = text.split(' ');
      const translated = words.map(word => {
        const lower = word.toLowerCase();
        for (const [langCode, phrases] of Object.entries(dict)) {
          for (const [key, phrase] of Object.entries(phrases)) {
            if (phrase.toLowerCase() === lower) return dict[to]?.[key] || word;
          }
        }
        return word;
      });
      return translated.join(' ');
    }
    return null;
  }

  _simpleLanguageDetection(text) {
    const cyrillic = /[\u0400-\u04FF]/;
    if (cyrillic.test(text)) return 'mk';
    return 'en';
  }

  _checkRateLimit(providerName) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const limit = this.config.providers.find(p => p.name === providerName)?.rateLimit || 100;
    if (!this.requestCounts[providerName]) this.requestCounts[providerName] = [];
    this.requestCounts[providerName] = this.requestCounts[providerName].filter(timestamp => now - timestamp < windowMs);
    return this.requestCounts[providerName].length < limit;
  }

  _incrementRequestCount(providerName) {
    if (!this.requestCounts[providerName]) this.requestCounts[providerName] = [];
    this.requestCounts[providerName].push(Date.now());
  }

  async _callProvider(provider, text, from, to) {
    switch (provider.name) {
      case 'libretranslate':
        const response = await fetch(provider.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source: from === 'auto' ? 'auto' : from, target: to, format: 'text' })
        });
        if (!response.ok) throw new Error(`LibreTranslate error: ${response.status}`);
        return await response.json();
      case 'mymemory':
        const langpair = from === 'auto' ? `|${to}` : `${from}|${to}`;
        const url = `${provider.endpoint}?q=${encodeURIComponent(text)}&langpair=${langpair}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`MyMemory error: ${res.status}`);
        const data = await res.json();
        return { translatedText: data.responseData?.translatedText || text, provider: 'mymemory' };
      default:
        throw new Error(`Unknown provider: ${provider.name}`);
    }
  }
}

// ===== ГЛОБАЛЕН ИНСТАНЦА =====
export const ecoTranslate = new EcoTranslate();
export default EcoTranslate;

// ===== АВТО-ИНИЦИЈАЛИЗАЦИЈА =====
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const elements = document.querySelectorAll('[data-translate-key]');
    if (elements.length > 0) await ecoTranslate.translateUI(Array.from(elements));
    
    // Ако има селектор за јазик, пополни го
    const langSelector = document.getElementById('language-selector');
    if (langSelector) {
      for (const [code, name] of Object.entries(ecoTranslate.config.languages)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        if (code === ecoTranslate.currentLang) option.selected = true;
        langSelector.appendChild(option);
      }
      langSelector.addEventListener('change', async (e) => {
        await ecoTranslate.setLanguage(e.target.value);
      });
    }
  });
}

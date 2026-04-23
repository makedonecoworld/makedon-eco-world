/**
 * Makedon Eco World – Security Module
 * 🔐 Безбедност: енкрипција, 2FA, токенизација, валидација
 * 🌐 Компатибилен: браузер + сервер
 * 📴 Офлајн поддршка: локални крипто функции
 */

// ===== ГЛОБАЛНИ КОНСТАНТИ =====
const SECURITY_CONFIG = {
  encryption: {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    saltLength: 16
  },
  totp: {
    period: 30, // секунди
    digits: 6,
    algorithm: 'SHA-1'
  },
  validation: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[\d\s\-()]{10,}$/,
    strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  }
};

// ===== ГЛАВЕН МОДУЛ =====
export const Security = {
  
  // ===== ЕНКРИПЦИЈА / ДЕ-ЕНКРИПЦИЈА =====
  
  /**
   * Енкриптирај податоци со AES-GCM
   * @param {Object} data - Податоци за енкрипција
   * @param {string} key - Енкрипциски клуч (мин. 32 бајти за AES-256)
   * @returns {Promise<Object>} { iv: Uint8Array, data: Uint8Array }
   */
  async encrypt(data, key) {
    if (!key || key.length < 32) throw new Error('Key must be at least 32 bytes for AES-256');
    
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: SECURITY_CONFIG.encryption.algorithm, length: SECURITY_CONFIG.encryption.keyLength },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(SECURITY_CONFIG.encryption.ivLength));
    const encrypted = await crypto.subtle.encrypt(
      { name: SECURITY_CONFIG.encryption.algorithm, iv },
      cryptoKey,
      encoder.encode(JSON.stringify(data))
    );
    
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
  },

  /**
   * Декриптирај податоци со AES-GCM
   * @param {Object} encrypted { iv, data }
   * @param {string} key - Енкрипциски клуч
   * @returns {Promise<Object>} Декриптирани податоци
   */
  async decrypt(encrypted, key) {
    if (!key || key.length < 32) throw new Error('Key must be at least 32 bytes for AES-256');
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: SECURITY_CONFIG.encryption.algorithm, length: SECURITY_CONFIG.encryption.keyLength },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: SECURITY_CONFIG.encryption.algorithm, iv: new Uint8Array(encrypted.iv) },
      cryptoKey,
      new Uint8Array(encrypted.data)
    );
    
    return JSON.parse(decoder.decode(decrypted));
  },

  // ===== ТОКЕНИЗАЦИЈА НА КАРТИЧКИ =====

  /**
   * Токенизирај број на картичка (за безбедно чување)
   * @param {string} cardNumber - Број на картичка
   * @returns {Object} { token, last4, brand, fingerprint }
   */
  tokenizeCard(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    const last4 = cleaned.slice(-4);
    const brand = this.detectCardBrand(cleaned);
    
    // Генерирај уникатен токен (не реверзибилен)
    const fingerprint = this._generateFingerprint(cleaned);
    const token = `tok_${brand}_${fingerprint}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    
    return { token, last4, brand, fingerprint };
  },

  /**
   * Детектирај бренд на картичка од бројот
   * @param {string} number - Број на картичка
   * @returns {string} 'visa' | 'mastercard' | 'amex' | 'unknown'
   */
  detectCardBrand(number) {
    const n = number.replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^6(?:011|5)/.test(n)) return 'discover';
    return 'unknown';
  },

  // ===== 2FA / TOTP =====

  /**
   * Генерирај TOTP код (за 2-факторска автентикација)
   * @param {string} secret - Base32 секрет (20 карактери)
   * @returns {Promise<Object>} { code, expires_in }
   */
  async generate2FACode(secret) {
    // Mock TOTP за демо – во продукција користи библиотека како 'otpauth'
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return { code, expires_in: SECURITY_CONFIG.totp.period };
  },

  /**
   * Верифицирај TOTP код
   * @param {string} code - Кориснички код (6 цифри)
   * @param {string} secret - Base32 секрет
   * @returns {Promise<boolean>} Дали кодот е валиден
   */
  async verify2FACode(code, secret) {
    // Mock верификација за демо
    if (!/^\d{6}$/.test(code)) return false;
    
    // Во продукција: спореди го кодот со TOTP алгоритам + временски прозорец
    return true;
  },

  // ===== ВАЛИДАЦИЈА НА ВЛЕЗ =====

  /**
   * Валидирај е-пошта адреса
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    return SECURITY_CONFIG.validation.email.test(email?.trim());
  },

  /**
   * Валидирај телефонски број
   * @param {string} phone
   * @returns {boolean}
   */
  isValidPhone(phone) {
    return SECURITY_CONFIG.validation.phone.test(phone?.trim());
  },

  /**
   * Валидирај силна лозинка
   * @param {string} password
   * @returns {boolean}
   */
  isStrongPassword(password) {
    return SECURITY_CONFIG.validation.strongPassword.test(password);
  },

  /**
   * Санитизирај влез од корисник (защита од XSS)
   * @param {string} input
   * @returns {string}
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>\"'&]/g, char => ({
        '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
      }[char]))
      .trim();
  },

  /**
   * Генерирај безбеден токен за е-маил верификација
   * @param {string} email
   * @param {string} purpose - 'verify' | 'reset' | 'login'
   * @param {number} expiryHours - Валидност во часови
   * @returns {string}
   */
  generateEmailToken(email, purpose = 'verify', expiryHours = 24) {
    const payload = {
      email: email.toLowerCase().trim(),
      purpose,
      exp: Date.now() + (expiryHours * 60 * 60 * 1000),
      jti: crypto.randomUUID()
    };
    
    // Base64 encode + UUID за едноставен токен (во продукција: JWT)
    const encoded = btoa(JSON.stringify(payload));
    const signature = this._generateFingerprint(encoded + purpose).slice(0, 8);
    
    return `${encoded}.${signature}`;
  },

  /**
   * Верифицирај токен од е-маил линк
   * @param {string} token
   * @returns {Object} { valid: boolean, email?: string, error?: string }
   */
  verifyEmailToken(token) {
    try {
      const [encoded, signature] = token.split('.');
      if (!encoded || !signature) throw new Error('Invalid token format');
      
      const payload = JSON.parse(atob(encoded));
      
      // Провери го потписот
      const expectedSig = this._generateFingerprint(encoded + payload.purpose).slice(0, 8);
      if (signature !== expectedSig) throw new Error('Invalid signature');
      
      // Провери го истекувањето
      if (payload.exp < Date.now()) throw new Error('Token expired');
      
      return { valid: true, email: payload.email, purpose: payload.purpose };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },

  // ===== ПОМОШНИ МЕТОДИ =====

  /**
   * Генерирај уникатен "отпечаток" од стринг (за токенизација)
   * @private
   */
  _generateFingerprint(input) {
    // Mock fingerprint – во продукција користи crypto.subtle.digest('SHA-256', ...)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).padStart(8, '0');
  },

  /**
   * Генерирај случаен безбеден стринг (за клучеви, салт, итн.)
   * @param {number} length - Должина во бајти
   * @returns {string} Hex стринг
   */
  generateRandomHex(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

// ===== ГЛОБАЛНА ИНСТАЛација (за лесен пристап) =====
if (typeof window !== 'undefined') {
  window.ecoSecurity = Security;
  console.log('🔐 Security module initialized for Makedon Eco World');
}

export default Security;

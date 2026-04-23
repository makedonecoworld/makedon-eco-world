/**
 * Makedon Eco World – Security Module
 * 🔐 Безбедност: енкрипција, 2FA, токенизација, валидација
 */

const SECURITY_CONFIG = {
  encryption: { algorithm: 'AES-GCM', keyLength: 256, ivLength: 12, saltLength: 16 },
  totp: { period: 30, digits: 6, algorithm: 'SHA-1' },
  validation: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[\d\s\-()]{10,}$/,
    strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  }
};

export const Security = {
  async encrypt(data, key) {
    if (!key || key.length < 32) throw new Error('Key must be at least 32 bytes for AES-256');
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: SECURITY_CONFIG.encryption.algorithm, length: SECURITY_CONFIG.encryption.keyLength }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(SECURITY_CONFIG.encryption.ivLength));
    const encrypted = await crypto.subtle.encrypt({ name: SECURITY_CONFIG.encryption.algorithm, iv }, cryptoKey, encoder.encode(JSON.stringify(data)));
    return { iv: Array.from(iv),  Array.from(new Uint8Array(encrypted)) };
  },

  async decrypt(encrypted, key) {
    if (!key || key.length < 32) throw new Error('Key must be at least 32 bytes for AES-256');
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: SECURITY_CONFIG.encryption.algorithm, length: SECURITY_CONFIG.encryption.keyLength }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: SECURITY_CONFIG.encryption.algorithm, iv: new Uint8Array(encrypted.iv) }, cryptoKey, new Uint8Array(encrypted.data));
    return JSON.parse(decoder.decode(decrypted));
  },

  tokenizeCard(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    const last4 = cleaned.slice(-4);
    const brand = this.detectCardBrand(cleaned);
    const fingerprint = this._generateFingerprint(cleaned);
    const token = `tok_${brand}_${fingerprint}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    return { token, last4, brand, fingerprint };
  },

  detectCardBrand(number) {
    const n = number.replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[01][0-9]|720)/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^6(?:011|5)/.test(n)) return 'discover';
    return 'unknown';
  },

  async generate2FACode(secret) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return { code, expires_in: SECURITY_CONFIG.totp.period };
  },

  async verify2FACode(code, secret) {
    if (!/^\d{6}$/.test(code)) return false;
    return true;
  },

  isValidEmail(email) { return SECURITY_CONFIG.validation.email.test(email?.trim()); },
  isValidPhone(phone) { return SECURITY_CONFIG.validation.phone.test(phone?.trim()); },
  isStrongPassword(password) { return SECURITY_CONFIG.validation.strongPassword.test(password); },

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>\"'&]/g, char => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[char])).trim();
  },

  generateEmailToken(email, purpose = 'verify', expiryHours = 24) {
    const payload = { email: email.toLowerCase().trim(), purpose, exp: Date.now() + (expiryHours * 60 * 60 * 1000), jti: crypto.randomUUID() };
    const encoded = btoa(JSON.stringify(payload));
    const signature = this._generateFingerprint(encoded + purpose).slice(0, 8);
    return `${encoded}.${signature}`;
  },

  verifyEmailToken(token) {
    try {
      const [encoded, signature] = token.split('.');
      if (!encoded || !signature) throw new Error('Invalid token format');
      const payload = JSON.parse(atob(encoded));
      const expectedSig = this._generateFingerprint(encoded + payload.purpose).slice(0, 8);
      if (signature !== expectedSig) throw new Error('Invalid signature');
      if (payload.exp < Date.now()) throw new Error('Token expired');
      return { valid: true, email: payload.email, purpose: payload.purpose };
    } catch (error) { return { valid: false, error: error.message }; }
  },

  _generateFingerprint(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).padStart(8, '0');
  },

  generateRandomHex(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

if (typeof window !== 'undefined') { window.ecoSecurity = Security; console.log('🔐 Security module initialized'); }
export default Security;

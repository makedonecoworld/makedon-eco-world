/**
 * Makedon Eco World – Email + Payment Integration
 * 📧 Централен е-маил: makedonecoworld@outlook.com
 * 💳 Поддржани системи: Stripe, PayPal, Visa Direct, Mastercard Send
 * 🔐 Безбедност: 2FA, токенизација, енкрипција, вебхукови
 */

// ===== КОНФИГУРАЦИЈА =====
const PAYMENT_CONFIG = {
  contactEmail: 'makedonecoworld@outlook.com',
  platformFeePercent: 0.03,
  baseValueEur: 0.018,
  minPayout: { MK: 100, DE: 5, NO: 50, US: 3, global: 5 },
  exchangeRates: { MKD: 61.5, EUR: 1, USD: 1.08, NOK: 11.2 },
  providers: {
    stripe: { enabled: true, currency: 'eur' },
    paypal: { enabled: true, currency: 'eur' },
    visa: { enabled: true, currency: 'usd' },
    mastercard: { enabled: true, currency: 'eur' }
  }
};

// ===== EMAIL SERVICE =====
export class EmailService {
  constructor({ fromEmail, apiKey, provider = 'sendgrid' }) {
    this.fromEmail = fromEmail || PAYMENT_CONFIG.contactEmail;
    this.apiKey = apiKey;
    this.provider = provider;
  }

  async send({ to, subject, html, text, priority = 'normal', meta = {} }) {
    // Mock за демо – во продукција замени со реален API повик
    console.log(`📧 Sending ${priority} email to ${to}: ${subject}`);
    
    // Лог за агентите
    if (window.ecoAgents?.log) {
      window.ecoAgents.log('email_sent', { to, subject, meta });
    }
    
    return { success: true, messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2,9)}` };
  }

  // Шаблони за е-маил пораки
  getTemplates() {
    return {
      welcome: (user) => ({
        subject: '🌱 Добредојде во Makedon Eco World!',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#2ecc71,#3498db);padding:30px;text-align:center;border-radius:16px 16px 0 0">
              <h1 style="color:#fff;margin:0">🌍 Makedon Eco World</h1>
            </div>
            <div style="padding:30px;background:#f8f9fa;border-radius:0 0 16px 16px">
              <h2 style="color:#2c3e50">Здраво, ${user.name}! 👋</h2>
              <p>Ти благодариме што се регистрира. Секој собрани предмет = 1 EcoPoint = Глобална вредност.</p>
              <div style="background:#fff;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #2ecc71">
                <strong>🎁 Твој стартен бонус:</strong> 10 бесплатни EcoPoints!
              </div>
              <p style="color:#666;font-size:.9rem">📧 ${PAYMENT_CONFIG.contactEmail}</p>
            </div>
          </div>
        `
      }),
      payout_initiated: (data) => ({
        subject: '💸 Исплатата е во тек – Makedon Eco World',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#3498db,#2ecc71);padding:25px;text-align:center">
              <h1 style="color:#fff;margin:0">✅ Исплата Иницирана</h1>
            </div>
            <div style="padding:30px;background:#f8f9fa">
              <p><strong>Здраво, ${data.userName}!</strong></p>
              <p>Вашата исплата е успешно обработена:</p>
              <div style="background:#fff;padding:20px;border-radius:12px;margin:20px 0">
                <table style="width:100%"><tr><td>Износ:</td><td><strong>${data.netAmount} ${data.currency}</strong></td></tr><tr><td>Метод:</td><td>${data.method}</td></tr><tr><td>ID:</td><td><code>${data.transactionId}</code></td></tr></table>
              </div>
              <p style="color:#666">Ќе пристигне за: ${data.eta}</p>
            </div>
          </div>
        `
      }),
      payout_completed: (data) => ({
        subject: '🎉 Парите пристигнаа! – Makedon Eco World',
        html: `
          <div style="text-align:center;max-width:600px;margin:0 auto;font-family:Arial">
            <div style="background:linear-gradient(135deg,#2ecc71,#27ae60);padding:40px;border-radius:16px 16px 0 0"><h1 style="color:#fff">🎉 Парите Пристигнаа!</h1></div>
            <div style="padding:30px;background:#f8f9fa;border-radius:0 0 16px 16px">
              <p style="font-size:1.2rem"><strong>${data.netAmount} ${data.currency}</strong> сега се на вашата сметка.</p>
              <p style="color:#666">Трансакција: <code>${data.transactionId}</code></p>
            </div>
          </div>
        `
      }),
      security_alert: (data) => ({
        subject: '🔐 Безбедносно Известување – Makedon Eco World',
        html: `
          <div style="font-family:Arial;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#e74c3c,#c0392b);padding:25px;text-align:center"><h1 style="color:#fff">🔐 Безбедносно Известување</h1></div>
            <div style="padding:30px;background:#f8f9fa">
              <p><strong>Акција:</strong> ${data.action}</p>
              <p><strong>Време:</strong> ${data.timestamp}</p>
              <p><strong>Локација:</strong> ${data.location}</p>
              <p style="color:#666;font-size:.9rem">Ако ова не беше ти, промени ја лозинката веднаш.</p>
            </div>
          </div>
        `
      })
    };
  }
}

// ===== PAYMENT ORCHESTRATOR =====
export class PaymentOrchestrator {
  constructor({ emailService, stripeKey, paypalConfig, visaConfig, mastercardConfig }) {
    this.email = emailService;
    this.stripeKey = stripeKey;
    this.paypal = paypalConfig;
    this.visa = visaConfig;
    this.mastercard = mastercardConfig;
  }

  async createPayout({ userEmail, userName, amount, currency, method, ecoPoints, meta = {} }) {
    // 1. Валидација
    if (!this._validateEmail(userEmail)) throw new Error('Invalid email');
    if (!['stripe','paypal','visa','mastercard'].includes(method)) throw new Error(`Unsupported: ${method}`);

    // 2. Пресметка на износи
    const calculations = this._calculateAmounts(amount, currency, method);
    
    // 3. Креирај трансакција (мокова)
    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
      userEmail, userName, ecoPoints, method, currency,
      gross: calculations.gross, fee: calculations.fee, tax: calculations.tax, net: calculations.net,
      status: 'pending', created_at: new Date().toISOString(), ...meta
    };

    try {
      // 4. Обработка според методот
      let payoutResult;
      switch(method) {
        case 'stripe': payoutResult = await this._processStripe(transaction); break;
        case 'paypal': payoutResult = await this._processPayPal(transaction); break;
        case 'visa': payoutResult = await this._processVisa(transaction); break;
        case 'mastercard': payoutResult = await this._processMastercard(transaction); break;
      }

      // 5. Ажурирај статус
      transaction.status = payoutResult.status;
      transaction.transactionId = payoutResult.id;

      // 6. Испрати е-маил потврда
      const templates = this.email.getTemplates();
      await this.email.send({
        to: userEmail,
        ...templates.payout_initiated({
          userName, netAmount: calculations.net.toFixed(2), currency,
          method: this._formatMethodName(method), transactionId: payoutResult.id,
          eta: payoutResult.eta || '1-3 работни дена'
        })
      });

      // 7. Лог за агентите
      if (window.ecoAgents?.log) {
        window.ecoAgents.log('payout_initiated', { transaction, userEmail });
      }

      return { success: true, transactionId: payoutResult.id, status: payoutResult.status, message: 'Исплатата е успешно иницирана.' };

    } catch (error) {
      console.error('Payout failed:', error);
      transaction.status = 'failed';
      transaction.error = error.message;
      
      // Испрати известување за грешка
      const templates = this.email.getTemplates();
      await this.email.send({
        to: userEmail, priority: 'high',
        ...templates.security_alert({
          userName, action: 'Неуспешна исплата',
          timestamp: new Date().toLocaleString('mk-MK'),
          location: 'Makedon Eco World Platform', device: 'Web/Mobile'
        })
      });
      
      throw new Error(`Исплатата не успеа: ${error.message}`);
    }
  }

  // ===== Stripe =====
  async _processStripe(tx) {
    // Mock – во продукција: fetch('/api/stripe/transfers', ...)
    await new Promise(r => setTimeout(r, 800));
    return { id: `stripe_${tx.id}`, status: 'processing', eta: '1-3 работни дена' };
  }

  // ===== PayPal =====
  async _processPayPal(tx) {
    // Mock – во продукција: PayPal Payouts API
    await new Promise(r => setTimeout(r, 800));
    return { id: `paypal_${tx.id}`, status: 'pending', eta: 'Моментално до 24 часа' };
  }

  // ===== Visa Direct =====
  async _processVisa(tx) {
    // Mock – во продукција: Visa Direct API (сервер-сајд)
    await new Promise(r => setTimeout(r, 800));
    return { id: `visa_${tx.id}`, status: 'processing', eta: 'Моментално до 30 минути' };
  }

  // ===== Mastercard Send =====
  async _processMastercard(tx) {
    // Mock – во продукција: Mastercard Send API (сервер-сајд)
    await new Promise(r => setTimeout(r, 800));
    return { id: `mc_${tx.id}`, status: 'processing', eta: 'Моментално до 1 час' };
  }

  // ===== Помошни методи =====
  _validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  
  _calculateAmounts(amount, currency, method) {
    const gross = amount;
    const fee = gross * PAYMENT_CONFIG.platformFeePercent;
    const taxRate = currency === 'MKD' ? 0 : currency === 'EUR' ? 0.19 : 0.15;
    const tax = (gross - fee) * taxRate;
    const net = gross - fee - tax;
    return { gross, fee, tax, net };
  }
  
  _formatMethodName(method) {
    const names = { stripe:'Stripe Direct', paypal:'PayPal', visa:'Visa Direct', mastercard:'Mastercard Send' };
    return names[method] || method;
  }
}

// ===== ГЛОБАЛЕН ИНСТАНЦА =====
export const createPaymentIntegration = async ({ emailApiKey, stripeKey, paypalConfig, visaConfig, mastercardConfig }) => {
  const emailService = new EmailService({ fromEmail: PAYMENT_CONFIG.contactEmail, apiKey: emailApiKey });
  const orchestrator = new PaymentOrchestrator({ emailService, stripeKey, paypalConfig, visaConfig, mastercardConfig });
  return { email: emailService, payments: orchestrator };
};

// ===== EXPORTS =====
export default { EmailService, PaymentOrchestrator, createPaymentIntegration, PAYMENT_CONFIG };

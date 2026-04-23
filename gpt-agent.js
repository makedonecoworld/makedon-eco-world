/**
 * Makedon Eco World – GPT Agent
 * 💬 Конверзациски AI за персонализирани пораки + поддршка 24/7
 * 🎮 Гејмификација енгин: нивоа, беџови, предизвици, лидерборди
 * 🌐 Локализација: автоматски превод преку eco-translate.js
 * 📧 Интеграција: makedonecoworld@outlook.com
 */

// ===== КОНФИГУРАЦИЈА =====
const GPT_CONFIG = {
  model: 'gpt-4-turbo',
  temperature: 0.7, // Креативност за персонализација
  maxTokens: 500,
  languages: ['mk', 'en', 'sq', 'sr', 'bg'],
  
  // Нивоа и гејмификација
  levels: [
    { name: 'Еко-Новач', threshold: 0, icon: '🌱', color: '#2ecc71', perks: ['Добредојдовен бонус: 10 поени'] },
    { name: 'Зелен Херој', threshold: 50, icon: '🌿', color: '#27ae60', perks: ['+5% бонус поени', 'Пристап до ексклузивни предизвици'] },
    { name: 'Планетарен Чувач', threshold: 200, icon: '🌳', color: '#16a085', perks: ['+10% бонус поени', 'Приоритетна поддршка', 'Ексклузивни беџови'] },
    { name: 'Глобален Лидер', threshold: 500, icon: '🌍', color: '#1abc9c', perks: ['+20% бонус поени', 'Личен менаџер', 'Покани за бета функции'] }
  ],
  
  // Беџови (достижнувања)
  badges: [
    { id: 'first_scan', name_mk: 'Прв Чекор', name_en: 'First Step', icon: '👣', condition: (stats) => stats.totalScans >= 1 },
    { id: 'first_hero', name_mk: 'Прв Херој', name_en: 'First Hero', icon: '🏆', condition: (stats) => stats.totalPoints >= 50 },
    { id: 'daily_champion', name_mk: 'Дневен Шампион', name_en: 'Daily Champion', icon: '🔥', condition: (stats) => stats.todayScans >= 5 },
    { id: 'social_eco', name_mk: 'Социјален Еко-Лидер', name_en: 'Social Eco Leader', icon: '👥', condition: (stats) => stats.invitedFriends >= 3 },
    { id: 'planet_saver', name_mk: 'Чувач на Планетата', name_en: 'Planet Saver', icon: '🌍', condition: (stats) => stats.totalPoints >= 200 },
    { id: 'perfect_week', name_mk: 'Совршена Недела', name_en: 'Perfect Week', icon: '⭐', condition: (stats) => stats.weeklyStreak >= 7 }
  ],
  
  // Предизвици (за ангажирање)
  challenges: [
    { id: 'daily_5', name_mk: '5 шишиња денес', name_en: '5 bottles today', reward: 5, condition: (stats) => stats.todayScans < 5 },
    { id: 'weekly_20', name_mk: '20 шишиња оваа недела', name_en: '20 bottles this week', reward: 25, condition: (stats) => stats.weeklyScans < 20 },
    { id: 'invite_3', name_mk: 'Покани 3 пријатели', name_en: 'Invite 3 friends', reward: 30, condition: (stats) => stats.invitedFriends < 3 },
    { id: 'first_payout', name_mk: 'Прва исплата', name_en: 'First payout', reward: 10, condition: (stats) => !stats.hasPayout }
  ]
};

// ===== ГЛАВНА КЛАСА =====
export class GPTAgent {
  constructor(options = {}) {
    this.apiKey = options.apiKey || import.meta?.env?.VITE_OPENAI_KEY || 'mock-key';
    this.endpoint = options.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.model = GPT_CONFIG.model;
    this.userContext = options.userContext || { name: 'Пријателе', totalPoints: 0, country: 'MK', language: 'mk' };
    this.conversationHistory = [];
    this.maxHistoryLength = 10; // Зачувај ги последните 10 пораки за контекст
  }

  /**
   * Генерирај персонализиран одговор за корисникот
   * @param {string} userMessage - Порака од корисникот
   * @param {Object} options - Дополнителни опции
   * @returns {Promise<Object>} Структуриран одговор со порака, акција и гејмификација
   */
  async generateResponse(userMessage, options = {}) {
    const { 
      includeGamification = true, 
      includeSuggestions = true,
      language = this.userContext.language || 'mk'
    } = options;

    // 1. Ажурирај го контекстот со најнови податоци
    this._updateUserContext();

    // 2. Подготви го системскиот промпт
    const systemPrompt = this._buildSystemPrompt(language);

    // 3. Подготви ги пораките за API (или мокова логика)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-this.maxHistoryLength),
      { role: 'user', content: userMessage }
    ];

    try {
      // 4. Онлајн: повик кон OpenAI API
      if (!this.offlineMode && navigator?.onLine && this.apiKey !== 'mock-key') {
        return await this._callOpenAIAPI(messages, language, includeGamification, includeSuggestions);
      }
      
      // 5. Офлајн/мокова логика за демо
      console.log('💬 GPT Agent: Using mock response for demo');
      return this._generateMockResponse(userMessage, language, includeGamification, includeSuggestions);
      
    } catch (error) {
      console.warn('GPT response failed, using mock fallback:', error);
      return this._generateMockResponse(userMessage, language, includeGamification, includeSuggestions);
    }
  }

  /**
   * Гради системски промпт со контекст за корисникот
   * @private
   */
  _buildSystemPrompt(language) {
    const { name, totalPoints, country, level } = this.userContext;
    const currentLevel = this._getCurrentLevel(totalPoints);
    const nextLevel = this._getNextLevel(totalPoints);
    const progress = nextLevel 
      ? Math.min(100, Math.round((totalPoints - currentLevel.threshold) / (nextLevel.threshold - currentLevel.threshold) * 100))
      : 100;

    return `
Ти си пријателски, мотивирачки и еколошки свесен асистент за **Makedon Eco World**.

КОРИСНИЧКИ КОНТЕКСТ:
• Име: ${name}
• Вкупно поени: ${totalPoints} EcoPoints
• Тековно ниво: ${currentLevel.icon} ${currentLevel.name}
• Напредок кон следно ниво: ${progress}% (${nextLevel ? nextLevel.name : 'MAX'})
• Земја: ${country}
• Јазик за одговор: ${language.toUpperCase()}

ПРАВИЛА ЗА ОДГОВОР:
1. ОДГОВАРАЈ НА ${language.toUpperCase()} ЈАЗИК (освен ако корисникот не побара друго)
2. Биди краток, топол и мотивирачки (макс 3-4 реченици + емоџи)
3. Предложи конкретен, акционен следен чекор (скенирај, конвертирај, покани, итн.)
4. Користи емоџија умерено (макс 2-3 по порака)
5. НИКОГАШ не давај финансиски совети – препрати на платежниот систем за тоа
6. Ако корисникот е фрустриран, биди емпатичен и понуди алтернатива

ФОРМАТ НА ОДГОВОР (строго JSON, без дополнителен текст):
{
  "message": "текст на порака на ${language} јазик",
  "suggested_action": {
    "type": "scan" | "convert" | "invite" | "challenge" | "learn" | "settings",
    "label": "текст за копче на ${language}",
    "deep_link": "ecopoints://... (опционално)"
  },
  "gamification": {
    "show_confetti": boolean,
    "badge_unlocked": { "id": string, "name": string, "icon": string } | null,
    "level_progress": { "current": string, "next": string | "MAX", "percent": number },
    "active_challenges": [ { "id": string, "name": string, "reward": number, "progress": number } ]
  },
  "tone": "celebratory" | "encouraging" | "neutral" | "empathetic"
}

ПРИМЕР ЗА ОДГОВОР (на македонски):
{
  "message": "Здраво Санде! 🌱 Одлично напредуваш кон 'Планетарен Чувач'! Имаш 127 EcoPoints – уште 73 до следното ниво. Што сакаш да направиш денес?",
  "suggested_action": { "type": "scan", "label": "Скенрај ново шише →", "deep_link": "ecopoints://scan" },
  "gamification": {
    "show_confetti": false,
    "badge_unlocked": null,
    "level_progress": { "current": "Зелен Херој", "next": "Планетарен Чувач", "percent": 63.5 },
    "active_challenges": [ { "id": "daily_5", "name": "5 шишиња денес", "reward": 5, "progress": 2 } ]
  },
  "tone": "encouraging"
}
`.trim();
  }

  /**
   * Повик кон OpenAI API (онлајн)
   * @private
   */
  async _callOpenAIAPI(messages, language, includeGamification, includeSuggestions) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: GPT_CONFIG.temperature,
        max_tokens: GPT_CONFIG.maxTokens
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error ${response.status}: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    try {
      const parsed = JSON.parse(content);
      // Додади метаподатоци
      return {
        ...parsed,
        generated_at: new Date().toISOString(),
        agent_version: 'gpt-v1.0',
        model_used: this.model
      };
    } catch (parseError) {
      console.error('Failed to parse GPT response as JSON:', parseError);
      return this._generateMockResponse(messages[messages.length-1].content, language, includeGamification, includeSuggestions);
    }
  }

  /**
   * Мокова логика за демо/офлајн режим
   * @private
   */
  _generateMockResponse(userMessage, language, includeGamification, includeSuggestions) {
    const { name, totalPoints } = this.userContext;
    const currentLevel = this._getCurrentLevel(totalPoints);
    const nextLevel = this._getNextLevel(totalPoints);
    const progress = nextLevel 
      ? Math.min(100, Math.round((totalPoints - currentLevel.threshold) / (nextLevel.threshold - currentLevel.threshold) * 100))
      : 100;

    // Паметно одлучување за тон и порака
    const lowerMsg = userMessage.toLowerCase();
    let message, tone, actionType, actionLabel;

    if (lowerMsg.includes('здраво') || lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      message = language === 'mk' 
        ? `Здраво ${name}! 🌱 Добро дојде назад. Твоето ниво: ${currentLevel.icon} ${currentLevel.name}. Што сакаш да направиш денес?`
        : `Hello ${name}! 🌱 Welcome back. Your level: ${currentLevel.icon} ${currentLevel.name}. What would you like to do today?`;
      tone = 'encouraging';
      actionType = 'scan';
      actionLabel = language === 'mk' ? 'Скенрај ново шише →' : 'Scan a new bottle →';
      
    } else if (lowerMsg.includes('поени') || lowerMsg.includes('points') || lowerMsg.includes('заработ')) {
      const nextThreshold = nextLevel?.threshold || currentLevel.threshold;
      const needed = nextThreshold - totalPoints;
      message = language === 'mk'
        ? `Имаш ${totalPoints} EcoPoints! 💚 ${needed > 0 ? `Уште ${needed} до ${nextLevel.name}!` : 'Честитки, го достигна највисокото ниво! 🎉'}`
        : `You have ${totalPoints} EcoPoints! 💚 ${needed > 0 ? `${needed} more to reach ${nextLevel.name}!` : 'Congratulations, you reached the highest level! 🎉'}`;
      tone = 'celebratory';
      actionType = 'convert';
      actionLabel = language === 'mk' ? 'Види опции за конверзија →' : 'See conversion options →';
      
    } else if (lowerMsg.includes('исплат') || lowerMsg.includes('payout') || lowerMsg.includes('пари')) {
      message = language === 'mk'
        ? '💰 За исплата: оди во 'Моите Поени' → 'Конвертирај'. Поддржуваме: Stripe, PayPal, Visa, Mastercard. Минимален праг: 100 МКД.'
        : '💰 For payout: go to 'My Points' → 'Convert'. We support: Stripe, PayPal, Visa, Mastercard. Minimum threshold: €5.';
      tone = 'neutral';
      actionType = 'convert';
      actionLabel = language === 'mk' ? 'Започни исплата →' : 'Start payout →';
      
    } else if (lowerMsg.includes('предизвик') || lowerMsg.includes('challenge') || lowerMsg.includes('беџ')) {
      message = language === 'mk'
        ? '🎮 Активни предизвици: • 5 шишиња денес (+5 поени) • Покани 3 пријатели (+30 поени). Ајде да ги освоиме!'
        : '🎮 Active challenges: • 5 bottles today (+5 points) • Invite 3 friends (+30 points). Let\'s conquer them!';
      tone = 'encouraging';
      actionType = 'challenge';
      actionLabel = language === 'mk' ? 'Види сите предизвици →' : 'See all challenges →';
      
    } else if (lowerMsg.includes('помош') || lowerMsg.includes('help') || lowerMsg.includes('проблем')) {
      message = language === 'mk'
        ? '🤝 Тука сум да помогнам! Прашај ме за: • Како да скенирам • Како да конвертирам поени • Безбедност • Партнерства. Или пишувај на: makedonecoworld@outlook.com'
        : '🤝 I\'m here to help! Ask me about: • How to scan • How to convert points • Security • Partnerships. Or email: makedonecoworld@outlook.com';
      tone = 'empathetic';
      actionType = 'learn';
      actionLabel = language === 'mk' ? 'Отвори Центар за Помош →' : 'Open Help Center →';
      
    } else {
      // Генерички одговор
      message = language === 'mk'
        ? `Разбирам, ${name}! 🌱 Како можам да ти помогнам денес? Можеш да: скенираш шише, видиш поени, поканиш пријател или научиш нешто ново.`
        : `I understand, ${name}! 🌱 How can I help you today? You can: scan a bottle, check points, invite a friend, or learn something new.`;
      tone = 'neutral';
      actionType = 'scan';
      actionLabel = language === 'mk' ? 'Започни со скенирање →' : 'Start scanning →';
    }

    // Гејмификација податоци (ако се бараат)
    const gamification = includeGamification ? {
      show_confetti: totalPoints > 0 && totalPoints % 50 === 0 && !userMessage.includes('здрав'),
      badge_unlocked: this._checkNewBadges(),
      level_progress: {
        current: currentLevel.name,
        next: nextLevel?.name || 'MAX',
        percent: progress
      },
      active_challenges: this._getActiveChallenges().slice(0, 2)
    } : null;

    // Предложена акција (ако се бара)
    const suggested_action = includeSuggestions ? {
      type: actionType,
      label: actionLabel,
      deep_link: `ecopoints://${actionType}`
    } : null;

    // Зачувај ја пораката во историја
    this._addToHistory({ role: 'user', content: userMessage });
    this._addToHistory({ role: 'assistant', content: message });

    return {
      message,
      ...(suggested_action && { suggested_action }),
      ...(gamification && { gamification }),
      tone,
      generated_at: new Date().toISOString(),
      agent_version: 'gpt-v1.0-mock',
      language
    };
  }

  /**
   * Ажурирај го корисничкиот контекст со најнови податоци
   * @private
   */
  _updateUserContext() {
    // Во продукција: преземи ги најновите податоци од бекенд
    // За демо: користи ги постоечките
    if (typeof window !== 'undefined' && window.ecoState) {
      this.userContext = { ...this.userContext, ...window.ecoState };
    }
  }

  /**
   * Врати го тековното ниво според поените
   * @private
   */
  _getCurrentLevel(points) {
    return GPT_CONFIG.levels.slice().reverse().find(l => points >= l.threshold) || GPT_CONFIG.levels[0];
  }

  /**
   * Врати го следното ниво (или null ако е макс)
   * @private
   */
  _getNextLevel(points) {
    return GPT_CONFIG.levels.find(l => l.threshold > points) || null;
  }

  /**
   * Провери дали корисникот отклучил нов беџ
   * @private
   */
  _checkNewBadges() {
    // Мокова логика – во продукција: спореди со базата на отклучени беџови
    const stats = {
      totalScans: this.userContext.totalScans || Math.floor(this.userContext.totalPoints / 2),
      totalPoints: this.userContext.totalPoints,
      todayScans: this.userContext.todayScans || 0,
      invitedFriends: this.userContext.invitedFriends || 0,
      hasPayout: this.userContext.hasPayout || false,
      weeklyStreak: this.userContext.weeklyStreak || 0
    };

    for (const badge of GPT_CONFIG.badges) {
      if (badge.condition(stats)) {
        // Врати го првиот отклучен беџ што не е веќе прикажан
        return {
          id: badge.id,
          name: this.userContext.language === 'mk' ? badge.name_mk : badge.name_en,
          icon: badge.icon
        };
      }
    }
    return null;
  }

  /**
   * Врати ги активните предизвици за корисникот
   * @private
   */
  _getActiveChallenges() {
    const stats = {
      todayScans: this.userContext.todayScans || 0,
      weeklyScans: this.userContext.weeklyScans || 0,
      invitedFriends: this.userContext.invitedFriends || 0,
      hasPayout: this.userContext.hasPayout || false
    };

    return GPT_CONFIG.challenges
      .filter(ch => ch.condition(stats))
      .map(ch => ({
        id: ch.id,
        name: this.userContext.language === 'mk' ? ch.name_mk : ch.name_en,
        reward: ch.reward,
        progress: ch.id === 'daily_5' ? stats.todayScans :
                  ch.id === 'weekly_20' ? stats.weeklyScans :
                  ch.id === 'invite_3' ? stats.invitedFriends : 0
      }));
  }

  /**
   * Додади порака во историјата на конверзација
   * @private
   */
  _addToHistory(message) {
    this.conversationHistory.push(message);
    // Ограничи ја должината на историјата
    if (this.conversationHistory.length > this.maxHistoryLength * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
    }
  }

  /**
   * Ресетирај ја историјата на конверзација (за нова сесија)
   * @public
   */
  resetConversation() {
    this.conversationHistory = [];
    console.log('💬 GPT Agent: Conversation history reset');
  }

  /**
   * Постави нов кориснички контекст
   * @public
   */
  setUserContext(context) {
    this.userContext = { ...this.userContext, ...context };
    console.log('💬 GPT Agent: User context updated', this.userContext);
  }

  /**
   * Врати статистика за агентот (за аналитика)
   * @public
   */
  getStats() {
    return {
      conversationLength: this.conversationHistory.length,
      userLevel: this._getCurrentLevel(this.userContext.totalPoints).name,
      activeChallenges: this._getActiveChallenges().length,
      language: this.userContext.language
    };
  }
}

// ===== ГЛОБАЛЕН ИНСТАНЦА =====
export const gptAgent = new GPTAgent();

// ===== АВТО-ИНИЦИЈАЛИЗАЦИЈА =====
if (typeof window !== 'undefined') {
  window.gptAgent = gptAgent;
  console.log('💬 GPT Agent initialized for Makedon Eco World');
  
  // Слушај за промени на јазикот (од eco-translate.js)
  window.addEventListener('eco:languageChanged', (e) => {
    gptAgent.setUserContext({ language: e.detail.language });
    console.log(`🌍 GPT Agent: Language changed to ${e.detail.language}`);
  });
  
  // Слушај за ажурирања на поени (од главната апликација)
  window.addEventListener('eco:pointsUpdated', (e) => {
    gptAgent.setUserContext({ totalPoints: e.detail.points });
  });
}

export default GPTAgent;

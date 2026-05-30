class SiteTranslator {
    constructor() {
        this.serverUrl = '/api';
        this.cache = new Map();
        this.isTranslating = false;
        this.targetLang = localStorage.getItem('settings_language') || 'ru';
        this.originalTexts = new Map();
        this.pageTranslated = false;
        this.aiMessagesObserver = null;
        
        this.startAIMessagesWatcher();
    }
    
    startAIMessagesWatcher() {
        if (this.aiMessagesObserver) return;
        
        this.aiMessagesObserver = new MutationObserver((mutations) => {
            let hasNewAIMessage = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && node.classList) {
                            if (node.classList.contains('universal-msg') && 
                                (node.classList.contains('ai') || node.classList.contains('assistant'))) {
                                hasNewAIMessage = true;
                                break;
                            }
                            if (node.querySelector && node.querySelector('.universal-msg.ai')) {
                                hasNewAIMessage = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (hasNewAIMessage && this.targetLang !== 'ru' && !this.isTranslating) {
                setTimeout(() => this.translateAIMessages(), 100);
            }
        });
        
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            this.aiMessagesObserver.observe(chatContainer, {
                childList: true,
                subtree: true
            });
        } else {
            const waitForChat = setInterval(() => {
                const container = document.getElementById('chatMessages');
                if (container) {
                    this.aiMessagesObserver.observe(container, {
                        childList: true,
                        subtree: true
                    });
                    clearInterval(waitForChat);
                }
            }, 500);
        }
    }
    
    async translateAIMessages() {
        if (this.targetLang === 'ru') return;
        
        const aiMessages = document.querySelectorAll('.universal-msg.ai, .assistant-message, [data-sender="ai"]');
        const textsToTranslate = [];
        const elementsToTranslate = [];
        
        for (const msg of aiMessages) {
            if (msg.hasAttribute('data-translated')) continue;
            
            const textDiv = msg.querySelector('.message-text') || msg;
            let originalText = textDiv.textContent?.trim();
            
            if (originalText && !this.isAISystemMessage(originalText)) {
                const cacheKey = `${originalText}_${this.targetLang}`;
                if (!this.cache.has(cacheKey)) {
                    textsToTranslate.push(originalText);
                    elementsToTranslate.push({ element: textDiv, original: originalText, msgElement: msg });
                } else {
                    const cached = this.cache.get(cacheKey);
                    if (cached && textDiv.textContent !== cached) {
                        textDiv.textContent = cached;
                        msg.setAttribute('data-translated', 'true');
                    }
                }
            }
        }
        
        if (textsToTranslate.length === 0) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/translate/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    texts: textsToTranslate, 
                    from: 'ru', 
                    to: this.targetLang 
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.translations) {
                for (const item of data.translations) {
                    if (item.translated && item.translated !== item.original) {
                        this.cache.set(`${item.original}_${this.targetLang}`, item.translated);
                        
                        for (const { element, original, msgElement } of elementsToTranslate) {
                            if (original === item.original) {
                                element.textContent = item.translated;
                                msgElement.setAttribute('data-translated', 'true');
                                break;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Translator: AI translation error', error);
        }
    }
    
    isAISystemMessage(text) {
        const systemPatterns = [
            /виртуальный помощник/i,
            /здравствуйте/i,
            /чем могу помочь/i,
            /пожалуйста, оцените/i,
            /спасибо за обращение/i,
            /заявка #\d+/i
        ];
        return systemPatterns.some(pattern => pattern.test(text));
    }
    
    async translateSingleAIMessage(messageElement, text) {
        if (this.targetLang === 'ru' || !text) return text;
        
        const cacheKey = `${text}_${this.targetLang}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/translate/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    texts: [text], 
                    from: 'ru', 
                    to: this.targetLang 
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.translations?.[0]?.translated) {
                const translated = data.translations[0].translated;
                this.cache.set(cacheKey, translated);
                return translated;
            }
        } catch (error) {
            console.error('Translator: Single message error', error);
        }
        
        return text;
    }
    
    resetPageTranslationFlag() {
        this.pageTranslated = false;
        const translatedMessages = document.querySelectorAll('[data-translated]');
        translatedMessages.forEach(msg => msg.removeAttribute('data-translated'));
    }
    
    syncLanguage() {
        const savedLang = localStorage.getItem('settings_language') || 'ru';
        if (this.targetLang !== savedLang) {
            this.targetLang = savedLang;
            this.pageTranslated = false;
            const translatedMessages = document.querySelectorAll('[data-translated]');
            translatedMessages.forEach(msg => msg.removeAttribute('data-translated'));
        }
        return this.targetLang;
    }
    
    saveOriginalTexts() {
        const navLinks = document.querySelectorAll('.nav-links a');
        for (const link of navLinks) {
            if (!link.hasAttribute('data-original')) {
                const text = link.textContent;
                if (text) {
                    link.setAttribute('data-original', text);
                    this.originalTexts.set(link, text);
                }
            }
        }
        
        const i18nElements = document.querySelectorAll('[data-i18n]');
        for (const el of i18nElements) {
            if (!el.hasAttribute('data-original')) {
                let text = '';
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    text = el.placeholder || '';
                } else {
                    text = el.textContent || '';
                }
                if (text) {
                    el.setAttribute('data-original', text);
                    this.originalTexts.set(el, text);
                }
            }
        }
        
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        for (const el of placeholderElements) {
            if (!el.hasAttribute('data-original-placeholder')) {
                const text = el.placeholder || '';
                if (text) {
                    el.setAttribute('data-original-placeholder', text);
                    this.originalTexts.set(el, text);
                }
            }
        }
    }
    
    applyCachedTranslations(targetLang) {
        let appliedCount = 0;
        
        const navLinks = document.querySelectorAll('.nav-links a');
        for (const link of navLinks) {
            const original = link.getAttribute('data-original');
            if (original) {
                const cacheKey = `${original}_${targetLang}`;
                const cached = this.cache.get(cacheKey);
                if (cached && link.textContent !== cached) {
                    link.textContent = cached;
                    appliedCount++;
                }
            }
        }
        
        const i18nElements = document.querySelectorAll('[data-i18n]');
        for (const el of i18nElements) {
            const original = el.getAttribute('data-original');
            if (original) {
                const cacheKey = `${original}_${targetLang}`;
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        if (el.placeholder !== cached) {
                            el.placeholder = cached;
                            appliedCount++;
                        }
                    } else {
                        if (el.textContent !== cached) {
                            el.textContent = cached;
                            appliedCount++;
                        }
                    }
                }
            }
        }
        
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        for (const el of placeholderElements) {
            const original = el.getAttribute('data-original-placeholder');
            if (original) {
                const cacheKey = `${original}_${targetLang}`;
                const cached = this.cache.get(cacheKey);
                if (cached && el.placeholder !== cached) {
                    el.placeholder = cached;
                    appliedCount++;
                }
            }
        }
        
        return appliedCount;
    }
    
    collectTextsToTranslate(targetLang) {
        const textsToTranslate = [];
        const elementsToTranslate = [];
        const seenTexts = new Set();
        
        const navLinks = document.querySelectorAll('.nav-links a');
        for (const link of navLinks) {
            const original = link.getAttribute('data-original');
            if (original && original.trim() && !seenTexts.has(original)) {
                const cacheKey = `${original}_${targetLang}`;
                if (!this.cache.has(cacheKey)) {
                    seenTexts.add(original);
                    textsToTranslate.push(original);
                    elementsToTranslate.push({ element: link, original, type: 'text' });
                }
            }
        }
        
        const i18nElements = document.querySelectorAll('[data-i18n]');
        for (const el of i18nElements) {
            let original = '';
            let type = 'text';
            
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                original = el.getAttribute('data-original') || el.placeholder || '';
                type = 'placeholder';
            } else {
                original = el.getAttribute('data-original') || el.textContent || '';
                type = 'text';
            }
            
            if (original && original.trim() && !seenTexts.has(original)) {
                const cacheKey = `${original}_${targetLang}`;
                if (!this.cache.has(cacheKey)) {
                    seenTexts.add(original);
                    textsToTranslate.push(original);
                    elementsToTranslate.push({ element: el, original, type });
                }
            }
        }
        
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        for (const el of placeholderElements) {
            const original = el.getAttribute('data-original-placeholder') || el.placeholder || '';
            if (original && original.trim() && !seenTexts.has(original)) {
                const cacheKey = `${original}_${targetLang}`;
                if (!this.cache.has(cacheKey)) {
                    seenTexts.add(original);
                    textsToTranslate.push(original);
                    elementsToTranslate.push({ element: el, original, type: 'placeholder' });
                }
            }
        }
        
        return { textsToTranslate, elementsToTranslate };
    }
    
    resetToRussian() {
        for (const [element, originalText] of this.originalTexts) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.hasAttribute('data-i18n-placeholder') || element.hasAttribute('data-i18n')) {
                    element.placeholder = originalText;
                }
            } else {
                if (element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE') {
                    element.textContent = originalText;
                }
            }
        }
        
        document.querySelectorAll('.nav-links a').forEach(link => {
            const original = link.getAttribute('data-original');
            if (original) link.textContent = original;
        });
        
        const aiMessages = document.querySelectorAll('.universal-msg.ai, .assistant-message');
        for (const msg of aiMessages) {
            const original = msg.querySelector('.message-text')?.getAttribute('data-original') || 
                          msg.getAttribute('data-original-text');
            if (original) {
                const textDiv = msg.querySelector('.message-text') || msg;
                textDiv.textContent = original;
                msg.removeAttribute('data-translated');
            }
        }
        
        this.targetLang = 'ru';
        this.pageTranslated = false;
        localStorage.setItem('settings_language', 'ru');
        
        const langSelect = document.getElementById('globalLanguageSelect');
        if (langSelect) langSelect.value = 'ru';
    }
    
    async translatePage(targetLang) {
        this.syncLanguage();
        
        if (this.pageTranslated && this.targetLang === targetLang) {
            if (targetLang !== 'ru') {
                await this.translateAIMessages();
            }
            return;
        }
        
        if (this.isTranslating) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!this.isTranslating) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
            if (this.pageTranslated) return;
        }
        
        if (targetLang === 'ru') {
            this.resetToRussian();
            return;
        }
        
        const cachedCount = this.applyCachedTranslations(targetLang);
        const { textsToTranslate, elementsToTranslate } = this.collectTextsToTranslate(targetLang);
        
        if (textsToTranslate.length === 0) {
            this.pageTranslated = true;
            this.targetLang = targetLang;
            await this.translateAIMessages();
            return;
        }
        
        this.isTranslating = true;
        this.saveOriginalTexts();
        
        try {
            const response = await fetch(`${this.serverUrl}/translate/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    texts: textsToTranslate, 
                    from: 'ru', 
                    to: targetLang 
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.translations) {
                let translatedCount = 0;
                for (const item of data.translations) {
                    if (item.translated && item.translated !== item.original) {
                        this.cache.set(`${item.original}_${targetLang}`, item.translated);
                        
                        for (const { element, original, type } of elementsToTranslate) {
                            if (original === item.original) {
                                if (type === 'placeholder') {
                                    element.placeholder = item.translated;
                                } else {
                                    element.textContent = item.translated;
                                }
                                translatedCount++;
                                break;
                            }
                        }
                    }
                }
                
                this.pageTranslated = true;
                await this.translateAIMessages();
            }
            
            this.targetLang = targetLang;
            localStorage.setItem('settings_language', targetLang);
            
            const langSelect = document.getElementById('globalLanguageSelect');
            if (langSelect) langSelect.value = targetLang;
            
        } catch (error) {
            console.error('Translator: Page translation error', error);
        } finally {
            this.isTranslating = false;
        }
    }
    
    async forceTranslate(targetLang) {
        this.pageTranslated = false;
        this.cache.clear();
        await this.translatePage(targetLang);
    }
    
    async translateCurrentAIMessages() {
        if (this.targetLang === 'ru') return;
        await this.translateAIMessages();
    }
}

// Создаём глобальный экземпляр
window.translator = new SiteTranslator();

// Функция для ручного перевода сообщений AI
window.translateAIMessages = () => window.translator.translateCurrentAIMessages();

// ==========================================
// ГЛОБАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
// ==========================================

function initGlobalLanguageSelector() {
    const langSelect = document.getElementById('globalLanguageSelect');
    if (!langSelect) {
        setTimeout(initGlobalLanguageSelector, 100);
        return;
    }
    
    const savedLang = localStorage.getItem('settings_language') || 'ru';
    langSelect.value = savedLang;
    window.translator.syncLanguage();
    
    langSelect.addEventListener('change', async (e) => {
        const newLang = e.target.value;
        
        const app = document.getElementById('app');
        if (app) app.style.opacity = '0.5';
        
        try {
            await window.translator.forceTranslate(newLang);
        } catch (error) {
            console.error('Translator: Language change error', error);
        } finally {
            if (app) app.style.opacity = '1';
        }
    });
}

async function syncLanguageOnPageLoad() {
    window.translator.syncLanguage();
    const savedLang = localStorage.getItem('settings_language') || 'ru';
    
    window.translator.resetPageTranslationFlag();
    
    if (savedLang !== 'ru') {
        await window.translator.translatePage(savedLang);
    }
}

// Обёртка loadPage
if (typeof window.loadPage === 'function') {
    const originalLoadPage = window.loadPage;
    window.loadPage = async function(pageName, ticketId = null) {
        await originalLoadPage(pageName, ticketId);
        await syncLanguageOnPageLoad();
    };
}

// Инициализация
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initGlobalLanguageSelector();
        setTimeout(syncLanguageOnPageLoad, 200);
    });
} else {
    initGlobalLanguageSelector();
    setTimeout(syncLanguageOnPageLoad, 200);
}

window.applyGlobalTranslations = async (lang) => window.translator.forceTranslate(lang);
window.getCurrentLanguage = () => window.translator.targetLang;
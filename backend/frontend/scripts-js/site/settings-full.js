const API_URL = '';

const translations = {
    ru: {
        settingsTitle: "Настройки сайта", tabGeneral: "Общие", tabSecurity: "Безопасность", tabNotifications: "Уведомления",
        generalSettings: "Общие настройки", themeLabel: "Тема оформления",
        lightTheme: "Светлая", darkTheme: "Тёмная", securitySettings: "Безопасность", changePasswordTitle: "Смена пароля",
        oldPasswordLabel: "Старый пароль", oldPasswordPlaceholder: "••••••••", newPasswordLabel: "Новый пароль",
        newPasswordPlaceholder: "Придумайте новый пароль", confirmPasswordLabel: "Повторите новый пароль",
        confirmPasswordPlaceholder: "Повторите пароль", savePasswordBtn: "Сохранить пароль",
        twoFactorAuth: "Двухфакторная аутентификация", twoFactorDesc: "Защитите свой аккаунт с помощью кода из email",
        enable2faBtn: "Включить 2FA", dangerZone: "Опасная зона", deleteAccountBtn: "Удалить аккаунт",
        notificationSettings: "Уведомления", emailNotificationsLabel: "Email-уведомления о новых заявках",
        pushNotificationsLabel: "Push-уведомления в браузере", testPushBtn: "Проверить уведомление",
        confirmDeleteTitle: "Подтверждение удаления", confirmDeleteText: "Вы уверены? Это действие необратимо!",
        passwordForDeleteLabel: "Введите пароль для подтверждения", passwordPlaceholder: "Ваш пароль",
        cancelBtn: "Отмена", confirmDeleteBtn: "Удалить", verify2faTitle: "Подтверждение 2FA",
        verify2faText: "Введите код из 6 цифр, отправленный на вашу почту", codePlaceholder: "000000",
        verifyBtn: "Подтвердить", resendCodeBtn: "Отправить код повторно",
        msgPasswordSaved: "Пароль успешно изменён", msgPasswordError: "Ошибка при смене пароля",
        msgPasswordsMismatch: "Пароли не совпадают", msgPasswordShort: "Пароль должен быть не менее 6 символов",
        msgOldPasswordRequired: "Введите старый пароль", msg2faEnabled: "2FA успешно включена",
        msg2faError: "Ошибка при включении 2FA", msgCodeSent: "Код отправлен на почту",
        msgCodeVerified: "Код подтверждён", msgCodeError: "Неверный код", msgAccountDeleted: "Аккаунт удалён",
        msgDeleteError: "Ошибка при удалении аккаунта", msgPasswordRequired: "Введите пароль",
        msgNotificationsSaved: "Настройки уведомлений сохранены", msgPushPermissionDenied: "Разрешение отклонено",
        msgPushNotSupported: "Push-уведомления не поддерживаются", msgPushTestBody: "Тестовое уведомление",
        siteHome: "Главная", siteTickets: "Заявки", siteProfile: "Профиль", siteSettings: "Настройки",
        siteLogin: "Вход", siteRegister: "Регистрация", siteLogout: "Выход", siteDashboard: "Панель управления",
        siteWelcome: "Добро пожаловать", siteLoading: "Загрузка...", siteError: "Ошибка", siteSuccess: "Успешно",
        siteSave: "Сохранить", siteCancel: "Отмена", siteDelete: "Удалить", siteEdit: "Редактировать",
        siteCreate: "Создать", siteBack: "Назад", siteNext: "Далее", siteSearch: "Поиск",
        siteFilter: "Фильтр", siteSort: "Сортировка", siteRefresh: "Обновить", siteClose: "Закрыть",
        siteYes: "Да", siteNo: "Нет", siteConfirm: "Подтвердить", siteDecline: "Отклонить",
        siteStatus: "Статус", dateCreated: "Дата создания", dateUpdated: "Дата обновления",
        ticketNew: "Новая заявка", ticketInProgress: "В работе", ticketResolved: "Решена", ticketClosed: "Закрыта",
        languageRussian: "Русский", languageEnglish: "Английский"
    },
    en: {
        settingsTitle: "Site Settings", tabGeneral: "General", tabSecurity: "Security", tabNotifications: "Notifications",
        generalSettings: "General Settings", themeLabel: "Theme",
        lightTheme: "Light", darkTheme: "Dark", securitySettings: "Security", changePasswordTitle: "Change Password",
        oldPasswordLabel: "Old Password", oldPasswordPlaceholder: "••••••••", newPasswordLabel: "New Password",
        newPasswordPlaceholder: "Create new password", confirmPasswordLabel: "Confirm New Password",
        confirmPasswordPlaceholder: "Repeat password", savePasswordBtn: "Save Password",
        twoFactorAuth: "Two-Factor Authentication", twoFactorDesc: "Protect your account with email code",
        enable2faBtn: "Enable 2FA", dangerZone: "Danger Zone", deleteAccountBtn: "Delete Account",
        notificationSettings: "Notifications", emailNotificationsLabel: "Email notifications for new tickets",
        pushNotificationsLabel: "Browser push notifications", testPushBtn: "Test Notification",
        confirmDeleteTitle: "Confirm Deletion", confirmDeleteText: "Are you sure? This action is irreversible!",
        passwordForDeleteLabel: "Enter password to confirm", passwordPlaceholder: "Your password",
        cancelBtn: "Cancel", confirmDeleteBtn: "Delete", verify2faTitle: "2FA Verification",
        verify2faText: "Enter 6-digit code sent to your email", codePlaceholder: "000000",
        verifyBtn: "Verify", resendCodeBtn: "Resend Code",
        msgPasswordSaved: "Password changed successfully", msgPasswordError: "Error changing password",
        msgPasswordsMismatch: "Passwords do not match", msgPasswordShort: "Password must be at least 6 characters",
        msgOldPasswordRequired: "Enter old password", msg2faEnabled: "2FA enabled successfully",
        msg2faError: "Error enabling 2FA", msgCodeSent: "Code sent to email", msgCodeVerified: "Code verified",
        msgCodeError: "Invalid code", msgAccountDeleted: "Account deleted", msgDeleteError: "Error deleting account",
        msgPasswordRequired: "Enter password", msgNotificationsSaved: "Notification settings saved",
        msgPushPermissionDenied: "Push permission denied", msgPushNotSupported: "Push not supported", msgPushTestBody: "Test notification",
        siteHome: "Home", siteTickets: "Tickets", siteProfile: "Profile", siteSettings: "Settings",
        siteLogin: "Login", siteRegister: "Register", siteLogout: "Logout", siteDashboard: "Dashboard",
        siteWelcome: "Welcome", siteLoading: "Loading...", siteError: "Error", siteSuccess: "Success",
        siteSave: "Save", siteCancel: "Cancel", siteDelete: "Delete", siteEdit: "Edit",
        siteCreate: "Create", siteBack: "Back", siteNext: "Next", siteSearch: "Search",
        siteFilter: "Filter", siteSort: "Sort", siteRefresh: "Refresh", siteClose: "Close",
        siteYes: "Yes", siteNo: "No", siteConfirm: "Confirm", siteDecline: "Decline",
        siteStatus: "Status", dateCreated: "Created Date", dateUpdated: "Updated Date",
        ticketNew: "New Ticket", ticketInProgress: "In Progress", ticketResolved: "Resolved", ticketClosed: "Closed",
        languageRussian: "Russian", languageEnglish: "English"
    }
};

// Глобальные переменные
let currentLang = localStorage.getItem('settings_language') || 'ru';
let isDarkTheme = localStorage.getItem('settings_darkTheme') === 'true';
let pushEnabled = localStorage.getItem('settings_pushEnabled') === 'true';
let emailNotificationsEnabled = localStorage.getItem('settings_emailNotificationsEnabled') !== 'false';
let resendTimer = null;
let isTranslating = false;
let observer = null;

// Функция перевода
function t(key) {
    return translations[currentLang]?.[key] || key;
}

// === ГЛАВНАЯ ФУНКЦИЯ: Сохранение состояния всех элементов ===
function saveAllSettings() {
    // Сохраняем язык
    const langSelect = document.getElementById('languageSelect');
    if (langSelect && langSelect.value) {
        localStorage.setItem('settings_language', langSelect.value);
        currentLang = langSelect.value;
    }
    
    // Сохраняем тему
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        localStorage.setItem('settings_darkTheme', themeToggle.checked);
        isDarkTheme = themeToggle.checked;
    }
    
    // Сохраняем email уведомления
    const emailToggle = document.getElementById('emailNotificationsToggle');
    if (emailToggle) {
        localStorage.setItem('settings_emailNotificationsEnabled', emailToggle.checked);
        emailNotificationsEnabled = emailToggle.checked;
    }
    
    // Сохраняем push уведомления
    const pushToggle = document.getElementById('pushNotificationsToggle');
    if (pushToggle) {
        localStorage.setItem('settings_pushEnabled', pushToggle.checked);
        pushEnabled = pushToggle.checked;
    }
    
    console.log('Settings saved:', {
        language: currentLang,
        darkTheme: isDarkTheme,
        emailNotifications: emailNotificationsEnabled,
        pushEnabled: pushEnabled
    });
}

// === ВОССТАНОВЛЕНИЕ ВСЕХ НАСТРОЕК ===
function restoreAllSettings() {
    // Восстанавливаем язык
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        const savedLang = localStorage.getItem('settings_language') || 'ru';
        langSelect.value = savedLang;
        currentLang = savedLang;
        applyTranslations(currentLang);
    }
    
    // Восстанавливаем тему
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const savedTheme = localStorage.getItem('settings_darkTheme') === 'true';
        themeToggle.checked = savedTheme;
        isDarkTheme = savedTheme;
        
        if (isDarkTheme) {
            document.documentElement.classList.add('dark-theme');
            if (document.body) document.body.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
            if (document.body) document.body.classList.remove('dark-theme');
        }
    }
    
    // Восстанавливаем email уведомления
    const emailToggle = document.getElementById('emailNotificationsToggle');
    if (emailToggle) {
        const savedEmail = localStorage.getItem('settings_emailNotificationsEnabled') !== 'false';
        emailToggle.checked = savedEmail;
        emailNotificationsEnabled = savedEmail;
    }
    
    // Восстанавливаем push уведомления
    const pushToggle = document.getElementById('pushNotificationsToggle');
    if (pushToggle) {
        const savedPush = localStorage.getItem('settings_pushEnabled') === 'true';
        pushToggle.checked = savedPush;
        pushEnabled = savedPush;
    }
    
    console.log('Settings restored:', {
        language: currentLang,
        darkTheme: isDarkTheme,
        emailNotifications: emailNotificationsEnabled,
        pushEnabled: pushEnabled
    });
}

// Применение настроек при загрузке страницы
(function applySettingsOnLoad() {
    const lang = localStorage.getItem('settings_language') || 'ru';
    const isDark = localStorage.getItem('settings_darkTheme') === 'true';
    currentLang = lang;
    isDarkTheme = isDark;
    
    if (isDark) {
        document.documentElement.classList.add('dark-theme');
        if (document.body) document.body.classList.add('dark-theme');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Сначала восстанавливаем все настройки
    restoreAllSettings();
    
    // Затем инициализируем компоненты
    initLanguage();
    initTheme();
    //loadNotificationSettings();
    attachEventListeners();
    
    // Включаем observer только после полной загрузки
    setTimeout(() => {
        observeDynamicContent();
    }, 1000);
});

// Навешивание обработчиков событий
function attachEventListeners() {
    // Селектор языка - сохраняем при изменении
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
            saveAllSettings(); // Сохраняем все настройки
        });
    }
    
    // Переключатель темы - сохраняем при изменении
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            toggleTheme();
            saveAllSettings(); // Сохраняем все настройки
        });
    }
    
    // Email уведомления - сохраняем при изменении
    const emailToggle = document.getElementById('emailNotificationsToggle');
    if (emailToggle) {
        emailToggle.addEventListener('change', () => {
            saveNotificationSettings();
            saveAllSettings(); // Сохраняем все настройки
        });
    }
    
    // Push уведомления - сохраняем при изменении
    const pushToggle = document.getElementById('pushNotificationsToggle');
    if (pushToggle) {
        pushToggle.addEventListener('change', () => {
            togglePushNotifications();
            saveAllSettings(); // Сохраняем все настройки
        });
    }
    
    // Кнопки вкладок
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.getAttribute('data-tab');
            if (tabName) openTab(e, tabName);
        });
    });
    
    // Кнопка смены пароля
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', changePassword);
    }
    
    // Кнопка включения 2FA
    const enable2faBtn = document.getElementById('enable2faBtn');
    if (enable2faBtn) {
        enable2faBtn.addEventListener('click', enable2FA);
    }
    
    // Кнопка удаления аккаунта
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', showDeleteAccountModal);
    }
    
    // Кнопка тестового уведомления
    const testPushBtn = document.getElementById('testPushBtn');
    if (testPushBtn) {
        testPushBtn.addEventListener('click', testPushNotification);
    }
    
    // Кнопки модальных окон
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteAccountModal);
    }
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteAccount);
    }
    
    const cancel2faBtn = document.getElementById('cancel2faBtn');
    if (cancel2faBtn) {
        cancel2faBtn.addEventListener('click', close2faModal);
    }
    
    const verify2faBtn = document.getElementById('verify2faBtn');
    if (verify2faBtn) {
        verify2faBtn.addEventListener('click', verify2FA);
    }
    
    const resend2faBtn = document.getElementById('resend2faBtn');
    if (resend2faBtn) {
        resend2faBtn.addEventListener('click', resend2FACode);
    }
    
    // Сохраняем настройки перед уходом со страницы
    window.addEventListener('beforeunload', () => {
        saveAllSettings();
    });
    
    // Закрытие модальных окон по клику на фон
    window.onclick = (e) => { 
        const deleteModal = document.getElementById('deleteAccountModal');
        const faModal = document.getElementById('2faVerifyModal');
        
        if (e.target === deleteModal) closeDeleteAccountModal(); 
        if (e.target === faModal) close2faModal(); 
    };
}

// Наблюдение за динамическим контентом
function observeDynamicContent() {
    if (observer) observer.disconnect();
    
    observer = new MutationObserver((mutations) => {
        let needsUpdate = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute && (node.hasAttribute('data-i18n') || 
                            node.querySelector && node.querySelector('[data-i18n]'))) {
                            needsUpdate = true;
                            break;
                        }
                    }
                }
                if (needsUpdate) break;
            }
        }
        
        if (needsUpdate && !isTranslating) {
            applyTranslations(currentLang);
            restoreAllSettings(); // Восстанавливаем настройки для новых элементов
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

function initLanguage() { 
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = currentLang;
        applyTranslations(currentLang);
    } else {
        applyTranslations(currentLang);
    }
}

function changeLanguage(lang) {
    if (isTranslating) {
        setTimeout(() => changeLanguage(lang), 100);
        return;
    }
    
    currentLang = lang;
    localStorage.setItem('settings_language', lang);
    applyTranslations(lang);
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

function applyTranslations(lang) {
    if (isTranslating) return;
    
    isTranslating = true;
    
    const translationsObj = translations[lang];
    if (!translationsObj) {
        isTranslating = false;
        return;
    }

    // Перевод элементов с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translationsObj[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) {
                    el.placeholder = translationsObj[key];
                }
            } else if (el.tagName === 'SELECT') {
                Array.from(el.options).forEach(option => {
                    const optionKey = option.getAttribute('data-i18n');
                    if (optionKey && translationsObj[optionKey]) {
                        option.textContent = translationsObj[optionKey];
                    }
                });
            } else {
                el.textContent = translationsObj[key];
            }
        }
    });

    // Перевод placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translationsObj[key]) el.placeholder = translationsObj[key];
    });

    // Перевод title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (translationsObj[key]) el.title = translationsObj[key];
    });

    // Перевод value кнопок
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
        const key = el.getAttribute('data-i18n-value');
        if (translationsObj[key]) el.value = translationsObj[key];
    });
    
    isTranslating = false;
}

function initTheme() { 
    const themeToggle = document.getElementById('themeToggle');
    if (isDarkTheme) { 
        document.documentElement.classList.add('dark-theme');
        if (document.body) document.body.classList.add('dark-theme'); 
        if (themeToggle) themeToggle.checked = true; 
    } else {
        if (themeToggle) themeToggle.checked = false;
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    localStorage.setItem('settings_darkTheme', isDarkTheme);

    if (isDarkTheme) {
        document.documentElement.classList.add('dark-theme');
        if (document.body) document.body.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
        if (document.body) document.body.classList.remove('dark-theme');
    }

    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isDark: isDarkTheme } }));
}

function openTab(evt, tabName) {
    const tabContents = document.querySelectorAll(".tab-content");
    const tabLinks = document.querySelectorAll(".tab-link");
    
    if (tabContents) tabContents.forEach(c => c.classList.remove("active"));
    if (tabLinks) tabLinks.forEach(l => l.classList.remove("active"));
    
    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.classList.add("active");
    
    if (evt && evt.currentTarget) evt.currentTarget.classList.add("active");
}

async function changePassword() {
    const oldP = document.getElementById('oldPassword')?.value;
    const newP = document.getElementById('newPassword')?.value;
    const confirmP = document.getElementById('confirmPassword')?.value;
    const msg = document.getElementById('passwordMessage');
    
    if (!msg) return;
    msg.className = 'message-box'; 
    msg.textContent = '';
    
    if (!oldP) { showMessage(msg, t('msgOldPasswordRequired'), 'error'); return; }
    if (newP.length < 6) { showMessage(msg, t('msgPasswordShort'), 'error'); return; }
    if (newP !== confirmP) { showMessage(msg, t('msgPasswordsMismatch'), 'error'); return; }
    
    try {
        const r = await fetch(`/api/auth/change-password`, { 
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            credentials: 'include', 
            body: JSON.stringify({oldPassword: oldP, newPassword: newP}) 
        });
        const res = await r.json();
        if (r.ok) { 
            showMessage(msg, t('msgPasswordSaved'), 'success'); 
            const oldPasswordInput = document.getElementById('oldPassword');
            const newPasswordInput = document.getElementById('newPassword');
            const confirmPasswordInput = document.getElementById('confirmPassword');
            
            if (oldPasswordInput) oldPasswordInput.value = ''; 
            if (newPasswordInput) newPasswordInput.value = ''; 
            if (confirmPasswordInput) confirmPasswordInput.value = ''; 
        } else {
            showMessage(msg, res.message || t('msgPasswordError'), 'error');
        }
    } catch(e) { 
        console.error(e); 
        showMessage(msg, t('msgPasswordError'), 'error'); 
    }
}

async function enable2FA() {
    const msg = document.getElementById('2faMessage');
    if (!msg) return;
    
    msg.className = 'message-box'; 
    msg.textContent = '';
    
    try {
        const r = await fetch(`/api/auth/enable-2fa`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            credentials: 'include' 
        });
        const res = await r.json();
        if (r.ok) { 
            showMessage(msg, t('msgCodeSent'), 'success'); 
            const modal = document.getElementById('2faVerifyModal');
            if (modal) modal.style.display = 'block';
        } else {
            showMessage(msg, res.message || t('msg2faError'), 'error');
        }
    } catch(e) { 
        console.error(e);
        showMessage(msg, t('msg2faError'), 'error');
    }
}

function close2faModal() { 
    const modal = document.getElementById('2faVerifyModal');
    const input = document.getElementById('2faCodeInput');
    const verifyMsg = document.getElementById('2faVerifyMessage');
    
    if (modal) modal.style.display = 'none';
    if (input) input.value = '';
    if (verifyMsg) verifyMsg.textContent = '';
}

async function verify2FA() {
    const codeInput = document.getElementById('2faCodeInput');
    const code = codeInput ? codeInput.value : '';
    const msg = document.getElementById('2faVerifyMessage');
    
    if (!msg) return;
    
    msg.className = 'message-box'; 
    msg.textContent = '';
    
    if (!code || code.length !== 6) { 
        showMessage(msg, t('msgCodeError'), 'error'); 
        return; 
    }
    
    try {
        const r = await fetch(`/api/auth/verify-2fa`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            credentials: 'include', 
            body: JSON.stringify({code}) 
        });
        const res = await r.json();
        if (r.ok) { 
            showMessage(msg, t('msgCodeVerified'), 'success'); 
            setTimeout(() => { 
                close2faModal(); 
                const faMessage = document.getElementById('2faMessage');
                if (faMessage) showMessage(faMessage, t('msg2faEnabled'), 'success'); 
            }, 1500); 
        } else {
            showMessage(msg, res.message || t('msgCodeError'), 'error');
        }
    } catch(e) { 
        console.error(e);
        showMessage(msg, t('msgCodeError'), 'error');
    }
}

async function resend2FACode() {
    const btn = document.getElementById('resend2faBtn');
    if (!btn) return;

    btn.disabled = true;
    let s = 60;

    if (resendTimer) clearInterval(resendTimer);
    
    resendTimer = setInterval(() => {
        if (btn) {
            btn.textContent = `${s} сек.`;
            s--;
            if (s < 0) {
                clearInterval(resendTimer);
                btn.disabled = false;
                btn.textContent = t('resendCodeBtn');
            }
        }
    }, 1000);

    try {
        await fetch(`/api/auth/enable-2fa`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include'
        });
    } catch(e) {
        console.error('Resend 2FA code error:', e);
    }
}

function showDeleteAccountModal() { 
    const modal = document.getElementById('deleteAccountModal');
    const input = document.getElementById('deletePasswordInput');
    const msg = document.getElementById('deleteMessage');
    
    if (modal) modal.style.display = 'block';
    if (input) input.value = '';
    if (msg) msg.textContent = '';
}

function closeDeleteAccountModal() { 
    const modal = document.getElementById('deleteAccountModal');
    if (modal) modal.style.display = 'none';
}

async function deleteAccount() {
    const pwdInput = document.getElementById('deletePasswordInput');
    const pwd = pwdInput ? pwdInput.value : '';
    const msg = document.getElementById('deleteMessage');
    
    if (!msg) return;
    
    msg.className = 'message-box'; 
    msg.textContent = '';
    
    if (!pwd) { 
        showMessage(msg, t('msgPasswordRequired'), 'error'); 
        return; 
    }
    
    try {
        const r = await fetch(`/api/auth/delete-account`, {
            method: 'DELETE', 
            headers: {'Content-Type': 'application/json'}, 
            credentials: 'include', 
            body: JSON.stringify({password: pwd}) 
        });
        const res = await r.json();
        if (r.ok) { 
            showMessage(msg, t('msgAccountDeleted'), 'success'); 
            setTimeout(() => window.location.href = '/htmls/auth/login-client.html', 2000); 
        } else {
            showMessage(msg, res.message || t('msgDeleteError'), 'error');
        }
    } catch(e) { 
        console.error(e);
        showMessage(msg, t('msgDeleteError'), 'error');
    }
}


async function saveNotificationSettings() {
    const emailToggle = document.getElementById('emailNotificationsToggle');
    const en = emailToggle ? emailToggle.checked : false;
    localStorage.setItem('settings_emailNotificationsEnabled', en);
    try { 
        await fetch(`/api/notifications/settings`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            credentials: 'include', 
            body: JSON.stringify({emailNotificationsEnabled: en}) 
        }); 
        const msg = document.getElementById('notificationMessage');
        if (msg) showMessage(msg, t('msgNotificationsSaved'), 'success');
    } catch(e) { 
        console.error('Error saving notification settings:', e);
    }
}

async function togglePushNotifications() {
    const tgl = document.getElementById('pushNotificationsToggle');
    if (!tgl) return;
    
    pushEnabled = tgl.checked;
    if (pushEnabled && !('Notification' in window)) { 
        alert(t('msgPushNotSupported')); 
        tgl.checked = false; 
        pushEnabled = false; 
        return; 
    }
    if (pushEnabled && Notification.permission === 'default') { 
        const p = await Notification.requestPermission(); 
        if (p !== 'granted') { 
            alert(t('msgPushPermissionDenied')); 
            tgl.checked = false; 
            pushEnabled = false; 
        } 
    }
    localStorage.setItem('settings_pushEnabled', pushEnabled);
}

function testPushNotification() {
    if (!pushEnabled) { 
        alert(t('pushNotificationsLabel') + ': OFF'); 
        return; 
    }
    if (!('Notification' in window)) { 
        alert(t('msgPushNotSupported')); 
        return; 
    }
    if (Notification.permission === 'granted') {
        new Notification(t('testPushBtn'), {body: t('msgPushTestBody')});
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { 
            if (p === 'granted') {
                new Notification(t('testPushBtn'), {body: t('msgPushTestBody')});
            }
        });
    }
}

function showMessage(el, text, type) { 
    if (!el) return;
    el.textContent = text; 
    el.className = `message-box ${type}`; 
    setTimeout(() => {
        if (el) {
            el.textContent = '';
            el.className = 'message-box';
        }
    }, 3000);
}

window.globalTranslations = translations;
window.applyGlobalTranslations = applyTranslations;
window.getCurrentLanguage = () => currentLang;
window.changeGlobalLanguage = changeLanguage;



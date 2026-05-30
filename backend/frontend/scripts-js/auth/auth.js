// ========== УПРАВЛЕНИЕ COOKIES/TOKEN ==========
class TokenStorageManager {
    constructor() {
        this.storageMethod = null; // 'cookies' или 'localstorage'
        this.init();
    }

    init() {
        // Проверяем, был ли уже сделан выбор
        const savedMethod = localStorage.getItem('tokenStorageMethod');
        if (savedMethod === 'cookies' || savedMethod === 'localstorage') {
            this.storageMethod = savedMethod;
            this.applyStorageMethod();
        } else {
            this.showCookieConsentModal();
        }
    }

    showCookieConsentModal() {
        // Проверяем, не показано ли уже модальное окно
        if (document.getElementById('cookieConsentModal')) return;
        
        const modalHtml = `
            <div id="cookieConsentModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 20000;">
                <div style="background: #1e293b; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 1px solid #334155;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 48px;">🍪</div>
                        <h2 style="color: #f1f5f9; margin: 16px 0 8px 0;">Использование cookies</h2>
                        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
                            Мы используем cookies для хранения токена авторизации. 
                            Использовать cookies?.
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <div style="background: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;" id="cookieChoice">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="font-size: 24px;">🍪</div>
                                <div>
                                    <div style="color: #f1f5f9; font-weight: bold; margin-bottom: 4px;">Да</div>
                                    <div style="color: #64748b; font-size: 12px;">Токен будет храниться в httpOnly cookies (более безопасно)</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: #0f172a; border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s;" id="localStorageChoice">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="font-size: 24px;">💾</div>
                                <div>
                                    <div style="color: #f1f5f9; font-weight: bold; margin-bottom: 4px;">Нет</div>
                                    <div style="color: #64748b; font-size: 12px;">Токен будет храниться в локальном хранилище</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button id="confirmCookieChoice" style="width: 100%; padding: 12px; background: #8b5cf6; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; transition: background 0.2s;" 
                        onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">
                        Подтвердить выбор
                    </button>
                    
                    <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 16px;">
                        Вы можете изменить выбор в любой момент в настройках
                    </p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('cookieConsentModal');
        const cookieChoice = document.getElementById('cookieChoice');
        const localStorageChoice = document.getElementById('localStorageChoice');
        const confirmBtn = document.getElementById('confirmCookieChoice');
        
        let selectedChoice = null;
        
        cookieChoice.addEventListener('click', () => {
            selectedChoice = 'cookies';
            cookieChoice.style.border = '2px solid #8b5cf6';
            cookieChoice.style.background = '#1e293b';
            localStorageChoice.style.border = 'none';
            localStorageChoice.style.background = '#0f172a';
        });
        
        localStorageChoice.addEventListener('click', () => {
            selectedChoice = 'localstorage';
            localStorageChoice.style.border = '2px solid #8b5cf6';
            localStorageChoice.style.background = '#1e293b';
            cookieChoice.style.border = 'none';
            cookieChoice.style.background = '#0f172a';
        });
        
        confirmBtn.addEventListener('click', () => {
            if (selectedChoice) {
                this.storageMethod = selectedChoice;
                localStorage.setItem('tokenStorageMethod', selectedChoice);
                this.applyStorageMethod();
                modal.remove();
                showNotification(`Выбран способ хранения: ${selectedChoice === 'cookies' ? 'Cookies' : 'LocalStorage'}`, 'success');
            } else {
                showNotification('Пожалуйста, выберите способ хранения токена', 'warning');
            }
        });
    }
    
    applyStorageMethod() {
        // Устанавливаем глобальный флаг
        window.tokenStorageMethod = this.storageMethod;
        
        // Настраиваем fetch заголовки в зависимости от выбора
        if (this.storageMethod === 'cookies') {
            console.log('🔐 Используем cookies для хранения токена');
        } else {
            console.log('💾 Используем localStorage для хранения токена');
        }
    }
    
    getAuthHeaders() {
        if (this.storageMethod === 'cookies') {
            return {
                'Content-Type': 'application/json',
                'credentials': 'include'
            };
        } else {
            const token = localStorage.getItem('accessToken');
            return {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                'credentials': 'omit'
            };
        }
    }
    
    async fetchWithAuth(url, options = {}) {
        const headers = this.getAuthHeaders();
        
        const fetchOptions = {
            ...options,
            headers: {
                ...options.headers,
                ...headers
            }
        };
        
        if (this.storageMethod === 'cookies') {
            fetchOptions.credentials = 'include';
        } else {
            delete fetchOptions.credentials;
        }
        
        return fetch(url, fetchOptions);
    }
}

// Инициализируем менеджер
const tokenManager = new TokenStorageManager();

// Функция показа уведомлений
function showNotification(message, type = 'error') {
    const oldNotify = document.getElementById('custom-notification');
    if (oldNotify) oldNotify.remove();

    const notify = document.createElement('div');
    notify.id = 'custom-notification';
    notify.className = `notification ${type}`;
    notify.innerText = message;
    
    Object.assign(notify.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backgroundColor: type === 'success' ? '#4CAF50' : (type === 'warning' ? '#FF9800' : '#F44336'),
        transition: 'opacity 0.3s ease'
    });

    document.body.appendChild(notify);

    setTimeout(() => {
        notify.style.opacity = '0';
        setTimeout(() => notify.remove(), 300);
    }, 3000);
}

// Валидация email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Валидация пароля
function isValidPassword(password) {
    return password && password.length >= 6;
}

// ========== АВТОРИЗАЦИЯ ==========
async function AuthClient(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('emailform')?.value.trim();
    const password = document.getElementById('passwordform')?.value;

    if (!email || !password) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }

    const url = '/api/auth/login';

    try {
        let response;
        
        if (window.tokenStorageMethod === 'cookies') {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
        } else {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }

        if (response.ok) {
            // ✅ ПРОВЕРКА: заблокирован ли пользователь
            if (data.user && data.user.is_active === false) {
                showNotification('Ваш аккаунт заблокирован. Обратитесь к администратору.', 'error');
                // Если токен всё равно пришёл - удаляем его
                if (window.tokenStorageMethod === 'localstorage' && data.token) {
                    localStorage.removeItem('accessToken');
                }
                return;
            }
            
            sessionStorage.removeItem('loginAttempts');
            
            if (window.tokenStorageMethod === 'localstorage' && data.token) {
                localStorage.setItem('accessToken', data.token);
            }
            
            if (data && data.user && data.user.full_name) {
                showNotification(`Добро пожаловать, ${data.user.full_name}!`, 'success');
                setTimeout(() => {
                    window.location.href = '/frontend/main-module.html';
                }, 1000);
            } else {
                showNotification('Вход выполнен, перенаправление...', 'success');
                setTimeout(() => {
                    window.location.href = '/frontend/main-module.html';
                }, 1000);
            }
        } else {
            let loginAttempts = sessionStorage.getItem('loginAttempts') ? parseInt(sessionStorage.getItem('loginAttempts')) : 0;
            loginAttempts++;
            sessionStorage.setItem('loginAttempts', loginAttempts);
            
            let errorMessage = data?.error || data?.message || 'Неверные email или пароль';
            
            
            if (errorMessage.toLowerCase().includes('заблокирован') || 
                errorMessage.toLowerCase().includes('blocked')) {
                errorMessage = 'Ваш аккаунт заблокирован. Обратитесь к администратору.';
            }
            
            showNotification(errorMessage, 'error');

            if (loginAttempts >= 3) {
                const link = document.getElementById('forgotPasswordLink');
                if (link) link.style.display = 'block';
                showNotification('Забыли пароль? Нажмите на ссылку ниже', 'warning');
            }
        }
    } catch (networkError) {
        showNotification('Ошибка соединения с сервером. Попробуйте позже.', 'error');
    }
}

// Регистрация
async function registerClient(event) {
    if (event) event.preventDefault();
    
    const url = '/api/auth/register';
    const full_name = document.getElementById('registerfullnameUser')?.value.trim();
    const phone = document.getElementById('registerphoneUser')?.value.trim();
    const email = document.getElementById('registeremailUser')?.value.trim();
    const password = document.getElementById('registerpasswordUser')?.value;

    if (!email || !password || !full_name) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Некорректный Email', 'error');
        return;
    }
    
    if (!isValidPassword(password)) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    const dataUser = { email, password, full_name, phone: phone || null };

    try {
        let response;
        
        if (window.tokenStorageMethod === 'cookies') {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataUser),
                credentials: 'include'
            });
        } else {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataUser)
            });
        }
        
        let data;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        
        if (response.ok) {
            // Для localStorage - сохраняем токен
            if (window.tokenStorageMethod === 'localstorage' && data.token) {
                localStorage.setItem('accessToken', data.token);
            }
            
            localStorage.setItem('verifyEmail', email);
            showNotification('Регистрация успешна! Введите код из почты.', 'success');
            
            setTimeout(() => {
                window.location.href = '/htmls/auth/verification-email-client.html';
            }, 1500);
        } else {
            const errorMsg = data?.error || data?.message || 'Ошибка регистрации';
            showNotification(errorMsg, 'error');
        }
    } catch (networkError) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Авторизация персонала
async function authpersonal(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('emailpersonal')?.value.trim();
    const password = document.getElementById('passwordpersonal')?.value;
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const url = "/api/auth/login";
    const dataper = { email, password };
    
    try {
        let response;
        
        if (window.tokenStorageMethod === 'cookies') {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataper),
                credentials: 'include'
            });
        } else {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataper)
            });
        }
        
        let data;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        
        if (response.ok && data?.user) {
            
            if (data.user.is_active === false) {
                showNotification('Ваш аккаунт заблокирован. Обратитесь к администратору.', 'error');
                if (window.tokenStorageMethod === 'localstorage' && data.token) {
                    localStorage.removeItem('accessToken');
                }
                return;
            }
            
            // Для localStorage - сохраняем токен
            if (window.tokenStorageMethod === 'localstorage' && data.token) {
                localStorage.setItem('accessToken', data.token);
            }
            
            const role_id = data.user.role_id;
            const userData = {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.full_name,
                role_id: role_id,
                is_active: data.user.is_active
            };
            
            let redirectUrl = '/';
            let storageKey = '';
            
            if (role_id == 2) {
                storageKey = 'operatorData';
                sessionStorage.setItem('operator_id', data.user.id);
                sessionStorage.setItem('operator_name', data.user.full_name);
                redirectUrl = '/operator-dashboard.html';
            } else if (role_id == 3) {
                storageKey = 'expertData';
                sessionStorage.setItem('expert_id', data.user.id);
                sessionStorage.setItem('expert_name', data.user.full_name);
                redirectUrl = '/expert-dashboard.html';
            } else if (role_id == 4) {
                storageKey = 'adminData';
                sessionStorage.setItem('admin_id', data.user.id);
                sessionStorage.setItem('admin_name', data.user.full_name);
                redirectUrl = '/admin-dashboard.html';
            } else {
                showNotification('Нет доступа. Обратитесь к администратору.', 'error');
                return;
            }
            
            localStorage.setItem(storageKey, JSON.stringify(userData));
            showNotification(`Добро пожаловать, ${data.user.full_name}!`, 'success');
            
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            let errorMessage = data?.error || data?.message || data?.detail || 'Неверные email или пароль';
            
            
            if (errorMessage.toLowerCase().includes('заблокирован') || 
                errorMessage.toLowerCase().includes('blocked')) {
                errorMessage = 'Ваш аккаунт заблокирован. Обратитесь к администратору.';
            }
            
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Выход из системы
async function logout() {
    try {
        if (window.tokenStorageMethod === 'cookies') {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            document.cookie.split(";").forEach(cookie => {
                document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
        } else {
            localStorage.removeItem('accessToken');
        }
        
        localStorage.removeItem('operatorData');
        localStorage.removeItem('expertData');
        localStorage.removeItem('adminData');
        sessionStorage.clear();
        
        showNotification('Вы вышли из системы', 'success');
        setTimeout(() => {
            window.location.href = '/htmls/auth/login-client.html';
        }, 1000);
    } catch (error) {
        showNotification('Ошибка при выходе', 'error');
    }
}

// Проверка кода верификации
async function verifyCode(event) {
    if (event) event.preventDefault();
    
    let code = '';
    for (let i = 1; i <= 6; i++) {
        const digit = document.getElementById(`digit${i}`)?.value;
        if (!digit) {
            showNotification('Введите все 6 цифр кода', 'error');
            return;
        }
        code += digit;
    }
    
    const email = localStorage.getItem('verifyEmail');

    if (!email) {
        showNotification('Email не найден. Пожалуйста, зарегистрируйтесь заново.', 'error');
        setTimeout(() => {
            window.location.href = '/htmls/auth/register-client.html';
        }, 2000);
        return;
    }

    const indicator = document.getElementById('verificationIndicator');
    if (indicator) indicator.style.display = 'block';

    try {
        let response;
        
        if (window.tokenStorageMethod === 'cookies') {
            response = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, email }),
                credentials: 'include'
            });
        } else {
            const token = localStorage.getItem('accessToken');
            response = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ code, email })
            });
        }

        const data = await response.json();

        if (response.ok) {
            showNotification('Email подтвержден!', 'success');
            localStorage.removeItem('verifyEmail');
            
            const redirectUrl = data.redirect || '/htmls/auth/login-client.html';
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1500);
        } else {
            let errorMsg = data.error || data.message || 'Неверный код';
            
            if (errorMsg.includes('пользователь') || errorMsg.includes('email')) {
                errorMsg = 'Пользователь с таким email не найден. Зарегистрируйтесь заново.';
                localStorage.removeItem('verifyEmail');
            }
            
            showNotification(errorMsg, 'error');
            if (indicator) indicator.style.display = 'none';
        }
    } catch (err) {
        showNotification('Ошибка соединения с сервером', 'error');
        if (indicator) indicator.style.display = 'none';
    }
}

// Восстановление пароля
async function forgotPasswordHandler() {
    const emailInput = document.getElementById('forgotEmailInput');
    if (!emailInput) return;

    const email = emailInput.value.trim();
    
    if (!email || !isValidEmail(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }
    
    const url = '/api/auth/forgot-password';
    const btn = document.querySelector('#forgotForm button');
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Отправка...';
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Ссылка для сброса пароля отправлена на почту!', 'success');
            emailInput.value = '';
            
            setTimeout(() => {
                window.location.href = '/htmls/auth/login-client.html';
            }, 2000);
        } else {
            showNotification(data.error || data.message || 'Ошибка отправки', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Отправить ссылку';
            }
        }
    } catch (err) {
        showNotification('Ошибка соединения с сервером', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Отправить ссылку';
        }
    }
}

// Сброс пароля
async function resetPassword(event) {
    if (event) event.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showNotification('Ссылка недействительна или истекла', 'error');
        return;
    }

    const newPassword = document.getElementById('newPasswordInput')?.value;
    const confirmPassword = document.getElementById('confirmPasswordInput')?.value;

    if (!newPassword || newPassword.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Пароль успешно изменен!', 'success');
            
            if (document.getElementById('newPasswordInput')) {
                document.getElementById('newPasswordInput').value = '';
                document.getElementById('confirmPasswordInput').value = '';
            }

            setTimeout(() => {
                window.location.href = '/htmls/auth/login-client.html';
            }, 2000);
        } else {
            showNotification(data.error || data.message || 'Ошибка сброса пароля', 'error');
        }
    } catch (networkError) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Повторная отправка кода
async function resendVerificationCode() {
    const email = localStorage.getItem('verifyEmail');

    if (!email) {
        showNotification('Email не найден. Зарегистрируйтесь заново.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Новый код отправлен на почту!', 'success');
        } else {
            const match = data.error?.match(/подождите (\d+) секунд/);
            if (match && match[1]) {
                const waitTime = parseInt(match[1], 10);
                showNotification(`Слишком часто. Попробуйте через ${waitTime} сек.`, 'warning');
            } else {
                showNotification(data.error || 'Ошибка при отправке кода', 'error');
            }
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Инициализация DOM
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.code-digit');
    const resendLink = document.getElementById('resend-link');
    
    if (inputs.length > 0 && inputs[0]) inputs[0].focus();
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            if (value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            
            let allFilled = true;
            let code = '';
            inputs.forEach(inp => {
                if (!inp.value) allFilled = false;
                code += inp.value;
            });
            if (allFilled && code.length === 6) verifyCode(null);
        });
        
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
        
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6);
            if (/^\d+$/.test(pasteData)) {
                const digits = pasteData.split('');
                inputs.forEach((inp, i) => {
                    if (digits[i]) inp.value = digits[i];
                });
                const nextEmpty = inputs.find(inp => !inp.value);
                if (nextEmpty) nextEmpty.focus();
                else inputs[inputs.length - 1].focus();
                if (pasteData.length === 6) verifyCode(null);
            }
        });
    });
    
    if (resendLink) {
        resendLink.addEventListener('click', async function(e) {
            e.preventDefault();
            await resendVerificationCode();
        });
    }
});

// Экспорт глобальных функций
window.AuthClient = AuthClient;
window.registerClient = registerClient;
window.authpersonal = authpersonal;
window.verifyCode = verifyCode;
window.forgotPasswordHandler = forgotPasswordHandler;
window.resetPassword = resetPassword;
window.resendVerificationCode = resendVerificationCode;
window.logout = logout;
window.showNotification = showNotification;
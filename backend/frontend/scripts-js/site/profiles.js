(function() {
    let isProfileInitialized = false;
    let currentAvatarUrl = null;
    
    // Основная функция инициализации профиля
    window.initProfilePage = async function(forceReload = false) {
        // Проверяем, что мы на странице профиля
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) {
            return false;
        }
        
        isProfileInitialized = true;
        
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');
        const fullNameInput = document.getElementById('fullNameInput');
        const phoneInput = document.getElementById('phoneInput');
        const emailInput = document.getElementById('emailInput');
        const userFullNameH3 = document.getElementById('userFullName');
        const registerDateSpan = document.getElementById('registerDate');
        const logoutBtn = document.getElementById('logoutBtn');

        // Функция загрузки профиля
        async function loadProfile() {
            try {
                const response = await fetch('/api/profile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    cache: 'no-cache'
                });
                
                if (response.status === 401) {
                    console.log('Не авторизован');
                    window.location.href = '/htmls/auth/login-client.html';
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const user = await response.json();
                console.log('Профиль загружен:', user);
                
                // Обновляем поля
                if (fullNameInput) fullNameInput.value = user.full_name || '';
                if (phoneInput) phoneInput.value = user.phone || '';
                if (emailInput) emailInput.value = user.email || '';
                if (userFullNameH3) userFullNameH3.textContent = user.full_name || 'Пользователь';
                
                // Форматируем дату
                if (registerDateSpan && user.created_at) {
                    const date = new Date(user.created_at);
                    registerDateSpan.textContent = date.toLocaleDateString('ru-RU');
                }
                
                // Сохраняем текущий URL аватара
                currentAvatarUrl = user.avatar_url;
                
                // Обновляем аватар, если есть
                if (avatarPreview && user.avatar_url) {
                    avatarPreview.src = user.avatar_url;
                } else if (avatarPreview) {
                    const name = user.full_name || 'User';
                    avatarPreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8a2be2&color=fff&size=128`;
                }
                
            } catch (error) {
                console.error('Ошибка загрузки профиля:', error);
                if (avatarPreview) {
                    avatarPreview.src = 'https://ui-avatars.com/api/?name=User&background=8a2be2&color=fff&size=128';
                }
            }
        }
        
        // Сохранение формы (без клонирования!)
        if (profileForm) {
            // Убираем старый обработчик
            profileForm.onsubmit = null;
            
            profileForm.onsubmit = async function(e) {
                e.preventDefault();
                
                const fullNameInput_new = document.getElementById('fullNameInput');
                const phoneInput_new = document.getElementById('phoneInput');
                const fullName = fullNameInput_new?.value.trim();
                
                if (!fullName) {
                    alert('Введите ФИО');
                    return;
                }
                
                const btn = this.querySelector('.btn-save');
                const originalText = btn?.textContent;
                if (btn) {
                    btn.textContent = 'Сохранение...';
                    btn.disabled = true;
                }
                
                try {
                    const response = await fetch('/api/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            full_name: fullName,
                            phone: phoneInput_new?.value || null
                        })
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Ошибка сервера');
                    }
                    
                    const updated = await response.json();
                    const userFullNameH3_new = document.getElementById('userFullName');
                    if (userFullNameH3_new) userFullNameH3_new.textContent = updated.full_name;
                    
                    // Обновляем информацию в сайдбаре
                    const userInfoEl = document.getElementById('userInfo');
                    if (userInfoEl) userInfoEl.textContent = updated.full_name;
                    
                    // Обновляем аватар в сайдбаре
                    const userAvatarEl = document.getElementById('userAvatar');
                    if (userAvatarEl && updated.full_name) {
                        const initials = updated.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        userAvatarEl.textContent = initials;
                    }
                    
                    alert('✅ Профиль обновлен');
                    
                    // Перезагружаем профиль
                    await loadProfile();
                    
                } catch (error) {
                    console.error('Ошибка:', error);
                    alert('❌ ' + error.message);
                } finally {
                    if (btn) {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            };
        }
        
        // Выход (без клонирования)
        if (logoutBtn) {
            logoutBtn.onclick = function() {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                }).finally(() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/htmls/auth/login-client.html';
                });
            };
        }
        
        // Загружаем данные
        await loadProfile();
        
        return true;
    };
    
    // Функция сброса и переинициализации
    window.resetAndInitProfile = async function() {
        isProfileInitialized = false;
        currentAvatarUrl = null;
        await window.initProfilePage(true);
    };
    
    // Слушаем изменения в SPA
    if (window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
            const profileForm = document.getElementById('profileForm');
            if (profileForm) {
                if (!isProfileInitialized) {
                    window.initProfilePage();
                }
            } else {
                if (isProfileInitialized) {
                    isProfileInitialized = false;
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    // Перехватываем pushState
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        isProfileInitialized = false;
        currentAvatarUrl = null;
        setTimeout(() => {
            if (document.getElementById('profileForm')) {
                window.initProfilePage();
            }
        }, 150);
    };
    
    // Перехватываем replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        isProfileInitialized = false;
        currentAvatarUrl = null;
        setTimeout(() => {
            if (document.getElementById('profileForm')) {
                window.initProfilePage();
            }
        }, 150);
    };
    
    window.addEventListener('popstate', function() {
        isProfileInitialized = false;
        currentAvatarUrl = null;
        setTimeout(() => {
            if (document.getElementById('profileForm')) {
                window.initProfilePage();
            }
        }, 150);
    });
  
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.initProfilePage(), 100));
    } else {
        setTimeout(() => window.initProfilePage(), 100);
    }
    
})();
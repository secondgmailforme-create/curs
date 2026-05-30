-- =============================================
-- 1. РОЛИ
-- =============================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- =============================================
-- 2. ПОЛЬЗОВАТЕЛИ (мягкое удаление)
-- =============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    role_id INTEGER REFERENCES roles(id) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT FALSE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

-- =============================================
-- 3. Токены пользователя
-- =============================================

CREATE TABLE user_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 4. Коды пользователя
-- =============================================

CREATE TABLE verification_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 5. Измененный пароль
-- =============================================

CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 7. СТАТУСЫ ЗАЯВОК
-- =============================================
CREATE TABLE statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    deleted_at TIMESTAMP NULL
);

-- =============================================
-- 8. КАТЕГОРИИ (привязка к эксперту)
-- =============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    expert_id INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 9. ЗАЯВКИ 
-- =============================================
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    client_id INTEGER REFERENCES users(id) NOT NULL,
    operator_id INTEGER REFERENCES users(id),
    expert_id INTEGER REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id),
    status_id INTEGER REFERENCES statuses(id) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- =============================================
-- 6. Сообщения из чата
-- =============================================

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    sender VARCHAR(50), -- 'client', 'ai', 'operator'
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 10. КОММЕНТАРИИ
-- =============================================

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    text TEXT NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);


-- =============================================
-- 10.1 ОЦЕНКИ ОПЕРАТОРОВ/ЭКСПЕРТОВ
-- =============================================
CREATE TABLE ticket_ratings (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES users(id) NOT NULL,
    operator_id INTEGER REFERENCES users(id),
    expert_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticket_id)
);


-- =============================================
-- 11. ВЛОЖЕНИЯ (ФАЙЛЫ)
-- =============================================
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    filesize INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 12. ИСТОРИЯ ИЗМЕНЕНИЙ 
-- =============================================
CREATE TABLE ticket_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    old_status_id INTEGER,
    new_status_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 13. ЖУРНАЛ ДЕЙСТВИЙ
-- =============================================
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 14. УВЕДОМЛЕНИЯ
-- =============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 15. ДАННЫЕ ДЛЯ AI
-- =============================================
CREATE TABLE ai_training_data (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    input_text TEXT NOT NULL,
    output_text TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- ИНДЕКСЫ
-- =============================================
CREATE INDEX idx_tickets_status ON tickets(status_id);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_client ON tickets(client_id);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_logs_user ON logs(user_id);
CREATE INDEX idx_logs_created ON logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- =============================================
-- АВТО-ОБНОВЛЕНИЕ updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- КОММЕНТАРИИ 
-- =============================================
COMMENT ON TABLE tickets IS 'Основная таблица заявок';
COMMENT ON COLUMN tickets.priority IS 'low / medium / high — для цветов (green/yellow/red)';
COMMENT ON COLUMN users.deleted_at IS 'Мягкое удаление';
COMMENT ON COLUMN ticket_history.old_data IS 'JSONB старых значений (аудит)';
COMMENT ON TABLE ai_training_data IS 'Данные для AI (RAG / дообучение)';

-- =============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ 
-- =============================================
INSERT INTO roles (name) VALUES
('client'),
('operator'),
('expert'),
('admin');

INSERT INTO statuses (code, name) VALUES
('new', 'Новая'),
('in_progress_operator', 'В работе (оператор)'),
('waiting_for_operator', 'Ожидает оператора'),
('waiting_for_expert', 'Ожидает эксперта'),
('in_progress_expert', 'В работе (эксперт)'),
('escalated', 'Передана администратору'),
('resolved', 'Решена'),
('canceled', 'Отменена');

INSERT INTO categories (name) VALUES
('Оплата'),
('Доставка'),
('Техподдержка'),
('Консультация'),
('Возврат');


-- =============================================
-- Аккаунт админа - логин testadmin2@mail.com, пароль - 12345678
-- =============================================

INSERT INTO users (email, phone, role_id, password_hash, full_name, is_verified) VALUES
('testadmin2@mail.com', '+79999999999', '4', '$2b$10$zqP.DCIOpDCj4v.g4r8f2uh/JMpp/t8pWoDgCoyRZiMKdd.PUwR5q', 'Петр Петрович Петрович', 'TRUE');

-- =============================================
-- ДОПОЛНИТЕЛЬНЫЕ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ
-- =============================================
-- Индексы для оптимизации поиска пользователей
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);

-- Индексы для оптимизации заявок
CREATE INDEX IF NOT EXISTS idx_tickets_operator ON tickets(operator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_expert ON tickets(expert_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted ON tickets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tickets_composite_status_client ON tickets(status_id, client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_composite_expert_status ON tickets(expert_id, status_id) WHERE expert_id IS NOT NULL;

-- Индексы для комментариев и вложений
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_mime_type ON attachments(mime_type);

-- Индексы для токенов и кодов
CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires ON user_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

-- Индексы для AI и истории
CREATE INDEX IF NOT EXISTS idx_ai_training_ticket ON ai_training_data(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_category ON ai_training_data(category_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_user ON ticket_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_changed ON ticket_history(changed_at);

-- Индексы для чата и логов
CREATE INDEX IF NOT EXISTS idx_chat_messages_ticket ON chat_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON logs(entity_type, entity_id);


-- Индексы для рейтингов
CREATE INDEX idx_ticket_ratings_ticket ON ticket_ratings(ticket_id);
CREATE INDEX idx_ticket_ratings_operator ON ticket_ratings(operator_id);
CREATE INDEX idx_ticket_ratings_expert ON ticket_ratings(expert_id);
CREATE INDEX idx_ticket_ratings_client ON ticket_ratings(client_id);
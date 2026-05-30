const nodemailer = require('nodemailer'); //импортируем библиотеку по работе с почтой
const escapeHtml = require('escape-html'); // импортируем библиотеку для экранирования HTML
//Сервис по email
class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true', 
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            family:4
        });
    }

    //Базовый метод для отправка mail
    async sendMail(to, subject, html) {
        try {
            const info = await this.transporter.sendMail({
                from: `"Call Center Support" <${process.env.SMTP_FROM}>`,
                to,
                subject,
                html
            });
            console.log('Email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Email error:', error);
            throw new Error('Failed to send email');
        }
    }

    //Метод для отправки сообщения от сброса пароля
    // backend/services/EmailService.js

async sendResetPasswordEmail(email, token) {

    const safeEmail = escapeHtml(email);
    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${encodeURIComponent(token)}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Сброс пароля',
        html: `
            <h2>Сброс пароля</h2>
            <p>Вы запросили сброс пароля. Нажмите на кнопку ниже:</p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:white;text-decoration:none;border-radius:5px;">Сбросить пароль</a>
            <p>Или скопируйте ссылку: ${resetLink}</p>
            <p>Ссылка действительна 1 час.</p>
            <p>Запрос сделан для email: ${safeEmail}</p>
        `
    };

    await this.transporter.sendMail(mailOptions);
}

    //Метод для отправки приветсвенного сообщения
    async sendWelcomeEmail(to, name) {
        const safeName = escapeHtml(name);
        const html = `
            <h2>Добро пожаловать в Call Center Support!</h2>
            <p>Здравствуйте, ${safeName}!</p>
            <p>Вы успешно зарегистрированы в системе поддержки.</p>
            <p>Теперь вы можете создавать заявки и отслеживать их статус.</p>
            <a href="${process.env.FRONTEND_URL}/login">Войти в систему</a>
        `;
        return await this.sendMail(to, 'Добро пожаловать', html);
    }

    //Метод для отправки сообщения создания заявки
    async sendTicketCreatedEmail(to, ticketId, title) {
        const safeTitle = escapeHtml(title);
        const ticketUrl = `${process.env.FRONTEND_URL}/tickets/${ticketId}`;
        const html = `
            <h2>Заявка создана</h2>
            <p>Ваша заявка #${ticketId} "${safeTitle}" была решена.</p>
            <p>Отслеживайте статус: <a href="${ticketUrl}">${ticketUrl}</a></p>
        `;
        return await this.sendMail(to, `Заявка #${ticketId} создана`, html);
    }

    //Метод для отправки сообщения о решенной заявки
    async sendTicketResolvedEmail(to, ticketId, title) {
        const safeTitle = escapeHtml(title);
        const ticketUrl = `${process.env.FRONTEND_URL}/tickets/${ticketId}`;
        const html = `
            <h2>Заявка решена</h2><p>Ваша заявка #${ticketId} "${title}" была решена.</p>
            <p>Посмотреть результат: <a href="${ticketUrl}">${ticketUrl}</a></p>
        `;
        return await this.sendMail(to, `Заявка #${ticketId} решена`, html);
    }

    //Метод для отправки кода для регистрации
    async sendVerificationCode(email, code) {
        const html = `
            <h2>Подтверждение регистрации</h2>
            <p>Ваш код подтверждения: <b>${escapeHtml(code)}</b></p>
            <p>Код действителен 15 минут.</p>
        `;
        await this.sendMail(email,'Ваш код подтверждения для Call Center', html);
    }

    async sendWelcomeWithPasswordEmail(email, name, password) {
        const safeName = escapeHtml(name);
        const safePassword = escapeHtml(password);
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Добро пожаловать в Call Center Support!</h2>
                <p>Здравствуйте, <strong>${safeName}</strong>!</p>
                <p>Вам создана учетная запись в системе поддержки.</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Ваши данные для входа:</h3>
                    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                    <p><strong>Пароль:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px;">${safePassword}</code></p>
                </div>
                
                <p>Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
                
                <a href="${process.env.FRONTEND_URL}/htmls/auth/login-client.html" 
                style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                    Войти в систему
                </a>
                
                <hr style="margin: 20px 0; border-color: #e0e0e0;">
                <p style="color: #666; font-size: 12px;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
            </div>
        `;
        
        return await this.sendMail(email, 'Добро пожаловать в Call Center Support', html);
    }
}

module.exports = EmailService; //Выгрузка
            
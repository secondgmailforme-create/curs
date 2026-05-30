const Joi = require('joi'); //Импорт библиотеки JOI для валидации

const registerSchema = Joi.object({
    email: Joi.string().email().trim().required().messages({ // email обязательный он должен включать @. Входные данные строка, обрезанная от пробелов.Отправляется сообщение
        'string.email': 'Некорректный формат email',
        'any.required': 'Email обязателен'
    }),
    password: Joi.string().min(6).required().messages({ // пароль обязятельный, минимальное количество символов 6.Входные данные строка.Отправляется сообщение
        'string.min': 'Пароль должен быть не менее 6 символов',
        'any.required': 'Пароль обязателен'
    }),
    full_name: Joi.string().min(2).trim().required().messages({ // ФИО обязательно, минимальное количество символов 2. Входные данные строка, обрезанная от пробелов.Отправляется сообщение
        'string.min': 'Имя должно быть не менее 2 символов',
        'any.required': 'Имя обязательно'
    }),
    phone: Joi.string().trim().optional() // Номер телефона не обязательный. Входные данные строка, обрезанная от пробелов
});

const loginSchema = Joi.object({
    email: Joi.string().email().trim().required().messages({ // email обязательный он должен включать @. Входные данные строка, обрезанная от пробелов.Отправляется сообщение
        'string.email': 'Некорректный формат email',
        'any.required': 'Email обязателен'
    }),
    password: Joi.string().min(6).required().messages({ // пароль обязятельный, минимальное количество символов 6.Входные данные строка.Отправляется сообщение
        'any.required': 'Пароль обязателен'
    })
});
const changePasswordSchema = Joi.object({
    oldPassword: Joi.string().min(6).required(), // пароли обязятельные, минимальное количество символов 6.Входные данные строки.
    newPassword: Joi.string().min(6).required()
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().trim().required() // email обязательный он должен включать @. Входные данные строка, обрезанная от пробелов
});

const resetPasswordSchema = Joi.object({  // токен обязательный, новый пароль обязателен - минимальное количество символов 6. Входные данные строки
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
});

module.exports = {
    registerSchema,
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema
}; //Выгрузка
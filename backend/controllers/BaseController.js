//Базовый контроллер (класс родитель) - для удобства 
class BaseController {
    constructor() {
        //Для автоматического bind
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
        methods.forEach(method => {
            if (method !== 'constructor' && typeof this[method] === 'function') {
                this[method] = this[method].bind(this);
            }
        });
    }

    //Успешный ответ
    success(res, data, status = 200) {
        res.status(status).json(data);
    }

    //Ошибка валидации
    validationError(res, errors) {
        res.status(400).json({ errors });
    }

    error(res, message, status = 400) {
        res.status(status).json({ error: message });
    }

    //Не найдено
    notFound(res, message = 'Not found') {
        res.status(404).json({ error: message });
    }
    
    //Ошибка доступа 
    forbidden(res, message = 'Access denied') {
        res.status(403).json({ error: message });
    }

    //Внутренняя ошибка сервера
    internalError(res, message = 'Internal server error') {
        res.status(500).json({ error: message });
    }
}

module.exports = BaseController; //Выгрузка
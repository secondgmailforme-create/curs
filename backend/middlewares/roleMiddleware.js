const ROLES = require('../constants/roles'); //Импорт констант ролей

//Класс для проверки роли пользователя до отправки данных на сервер
class RoleMiddleware {
    constructor() {
        this.checkRole = this.checkRole.bind(this);
    }

    checkRole(allowedRoles) {
        return (req, res, next) => {
            if (!req.user || !req.user.role_id) {
                return res.status(401).json({ error: 'Требуется авторизация' });
            }

            const userRoleId = req.user.role_id;

            if (!allowedRoles.includes(userRoleId)) {
                return res.status(403).json({ error: 'Доступ запрещен' });
            }
            next();
        };
    }
}


module.exports = RoleMiddleware; //Выгрузка
// middlewares/roleScriptMiddleware.js

class RoleScriptMiddleware {
    constructor() {
        this.rolePaths = {
            1: '/scripts-js/client/',
            2: '/scripts-js/operator/',
            3: '/scripts-js/expert/',
            4: '/scripts-js/admin/'
        };
        
        this.commonPaths = [
            '/scripts-js/site/',
            '/scripts-js/common/'
        ];
    }
    
    serveScript = (req, res, next) => {
        const requestPath = req.path;
        
        // Проверяем, относится ли запрос к скриптам
        if (!requestPath.startsWith('/scripts-js/')) {
            return next();
        }
        
        // Общие скрипты (доступны всем, даже без авторизации)
        if (this.commonPaths.some(p => requestPath.startsWith(p))) {
            return next();
        }
        
        // Для остальных скриптов проверяем авторизацию
        const userRole = req.user?.role_id;
        
        if (!userRole) {
            console.log(`[SECURITY] Unauthorized access to ${requestPath}`);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Проверяем права доступа к папке роли
        const allowedPath = this.rolePaths[userRole];
        
        if (!allowedPath) {
            console.log(`[SECURITY] Unknown role ${userRole} tried to access ${requestPath}`);
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!requestPath.startsWith(allowedPath)) {
            console.log(`[SECURITY] Access denied: ${requestPath} for role ${userRole} (expected: ${allowedPath})`);
            return res.status(403).json({ error: 'Access denied' });
        }
        
        next();
    };
}

module.exports = RoleScriptMiddleware;
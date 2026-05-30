//Класс для описании прослойки прежде чем давать данные серверу, проверяется токен, куки
class AuthMiddleware {
    constructor(authService) {
        this.authService = authService;
        this.authenticate = this.authenticate.bind(this);
    }
    async authenticate(req, res, next) {
    try {
        let token = req.cookies?.accessToken;
    
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = this.authService.verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
}
module.exports = AuthMiddleware; //Выгрузка
const BaseController = require('./BaseController'); //Импорт Базового класса
const COOKIE_OPTIONS = require('../constants/cookie'); //Импорт констант куки

//Контроллер для гугл аутенфикации
class GoogleAuthController extends BaseController {
    constructor(googleAuthService, authService) {
        super();
        this.googleAuthService = googleAuthService;
        this.authService = authService;
        this.googleAuth = this.googleAuthService.getPassport().authenticate('google', {
            scope: ['profile', 'email']
        });

        //Вход в систему и формирования токена 
        this.googleCallback = (req, res, next) => {
            this.googleAuthService.getPassport().authenticate('google', {
                failureRedirect: `${process.env.FRONTEND_URL}/login`
            }, async (err, user) => {
                if (err || !user) {
                    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
                }

                const token = this.authService.generateToken(user);
                
                res.cookie('accessToken', token, COOKIE_OPTIONS);

                res.redirect(`${process.env.FRONTEND_URL}/app.html`);
            })(req, res, next);
        };
    }
}

module.exports = GoogleAuthController; //Выгрузка
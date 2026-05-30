const passport = require('passport');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Сервис для Google OAuth
class GoogleAuthService {
  constructor(userRepository, authService) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.enabled = false;

    // Инициализируем Google стратегию только если переданы ключи
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const GoogleStrategy = require('passport-google-oauth20').Strategy;

      passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true
      }, this.verifyCallback.bind(this)));

      passport.serializeUser((user, done) => {
        done(null, user.id);
      });

      passport.deserializeUser(async (id, done) => {
        const user = await this.userRepository.findById(id);
        done(null, user);
      });

      this.enabled = true;
      console.log('Google OAuth включён');
    } else {
      console.log('Google OAuth отключён (GOOGLE_CLIENT_ID не задан)');
    }
  }

  // Метод для верификации по Google
  async verifyCallback(req, accessToken, refreshToken, profile, done) {
    try {
      const email = profile.emails[0].value;
      const full_name = profile.displayName || null;
      const googleId = profile.id;

      let user = await this.userRepository.findByEmail(email);

      if (!user) {
        const tempPassword = crypto.randomBytes(16).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        user = await this.userRepository.createNewUser({
          email,
          full_name,
          password_hash: hashedPassword,
          role_id: 1,
          google_id: googleId
        });
      } else if (!user.google_id) {
        await this.userRepository.updateGoogleId(user.id, googleId);
        user.google_id = googleId;
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }

  // Метод для получения passport
  getPassport() {
    return passport;
  }
}

module.exports = GoogleAuthService;

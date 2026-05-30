const dotenv = require('dotenv');
dotenv.config();
const path = require('path');
const express = require('express');
const passport = require('passport');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const querystring = require('querystring');
const got = require('got');
const RedisService = require('./services/RedisService');
const { createClient } = require('redis');
const { LRUCache } = require('lru-cache');
const winston = require('winston');
require('winston-daily-rotate-file');

// ---------------------------- НАСТРОЙКА ЛОГГЕРА -------------------------------
const logDir = path.join(__dirname, '../logs');

// Транспорты для разных типов логов
const mainLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const errorLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const dbLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'database-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '14d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const redisLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'redis-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const socketLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'socket-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const authLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'auth-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '30d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

const translationLogTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'translation-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

// Основной логгер
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        mainLogTransport,
        errorLogTransport,
        new winston.transports.Console({
            format: winston.format.simple(),
            level: process.env.NODE_ENV === 'production' ? 'error' : 'info'
        })
    ]
});

// Логгеры для специфичных компонентов
const dbLogger = winston.createLogger({
    transports: [dbLogTransport, errorLogTransport],
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

const redisLogger = winston.createLogger({
    transports: [redisLogTransport, errorLogTransport],
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

const socketLogger = winston.createLogger({
    transports: [socketLogTransport, errorLogTransport],
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

const authLogger = winston.createLogger({
    transports: [authLogTransport, errorLogTransport],
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

const translationLogger = winston.createLogger({
    transports: [translationLogTransport, errorLogTransport],
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

const app = express();
app.set('trust proxy', 1);

// ---------------------------- ИНИЦИАЛИЗАЦИЯ REDIS -------------------------------
let redisClient = null;
let isRedisConnected = false;

async function initRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = createClient({ url: redisUrl });
        
        redisClient.on('error', (err) => {
            redisLogger.error('Redis Client Error', { message: err.message });
            isRedisConnected = false;
        });
        
        redisClient.on('connect', () => {
            redisLogger.info('Connected to Redis');
            isRedisConnected = true;
        });

        await redisClient.connect();
        return true;
    } catch (error) {
        redisLogger.error('Failed to connect to Redis', { message: error.message });
        logger.warn('Working without Redis - using in-memory storage');
        isRedisConnected = false;
        return false;
    }
}

// ---------------------------- ПОДКЛЮЧЕНИЕ К БД -------------------------------
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.connect((err, client, release) => {
    if (err) {
        dbLogger.error('Database connection error', { stack: err.stack });
    } else {
        dbLogger.info('Connected to PostgreSQL');
        release();
    }
});

// ---------------------------- РЕПОЗИТОРИИ -------------------------------
const UserRepository = require('./repositories/UserRepository');
const TicketRepository = require('./repositories/TicketRepository');
const StatusRepository = require('./repositories/StatusRepository');
const TicketHistoryRepository = require('./repositories/TicketHistoryRepository');
const CategoryRepository = require('./repositories/CategoryRepository');
const NotificationRepository = require('./repositories/NotificationRepository');
const LogRepository = require('./repositories/LogRepository');
const ChatRepository = require('./repositories/ChatRepository');
const CommentRepository = require('./repositories/CommentRepository');
const AttachmentRepository = require('./repositories/AttachmentRepository');
const AITrainingDataRepository = require('./repositories/AITrainingDataRepository');
const RatingRepository = require('./repositories/RatingRepository');

// ---------------------------- СЕРВИСЫ -------------------------------
const AIService = require('./services/AIService');
const EmailService = require('./services/EmailService');
const AuthService = require('./services/AuthService');
const UserService = require('./services/UserService');
const StatusService = require('./services/StatusService');
const CategoryService = require('./services/CategoryService');
const TicketService = require('./services/TicketService');
const StatsService = require('./services/StatsService');
const NotificationService = require('./services/NotificationService');
const CommentService = require('./services/CommentService');
const AttachmentService = require('./services/AttachmentService');
const PriorityService = require('./services/PriorityService');
const GoogleAuthService = require('./services/GoogleAuthService');
const RatingService = require('./services/RatingService');

// ---------------------------- КОНТРОЛЛЕРЫ -------------------------------
const AuthController = require('./controllers/AuthController');
const AdminController = require('./controllers/AdminController');
const TicketController = require('./controllers/TicketController');
const NotificationController = require('./controllers/NotificationController');
const GoogleAuthController = require('./controllers/GoogleAuthController');
const OperatorController = require('./controllers/OperatorController');
const ExpertController = require('./controllers/ExpertController');
const RatingController = require('./controllers/RatingController');
const UserController = require('./controllers/UserController');

// ---------------------------- MIDDLEWARE -------------------------------
const AuthMiddleware = require('./middlewares/authMiddleware');
const RoleMiddleware = require('./middlewares/roleMiddleware');
const RoleScriptMiddleware = require('./middlewares/roleScriptMiddleware');
const errorHandler = require('./middlewares/errorHandler');


// ---------------------------- РОУТЫ -------------------------------
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const operatorRoutes = require('./routes/operatorRoutes');
const expertRoutes = require('./routes/expertRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const profileRoutes = require('./routes/profileRoutes');

// ---------------------------- ЗАПУСК СЕРВЕРА -------------------------------
async function startServer() {
    await initRedis();

    // ---------------------------- ИНИЦИАЛИЗАЦИЯ РЕПОЗИТОРИЕВ -------------------------------
    const userRepo = new UserRepository(pool);
    const ticketRepo = new TicketRepository(pool);
    const statusRepo = new StatusRepository(pool);
    const historyRepo = new TicketHistoryRepository(pool);
    const categoryRepo = new CategoryRepository(pool);
    const notificationRepo = new NotificationRepository(pool);
    const logRepo = new LogRepository(pool);
    const chatRepo = new ChatRepository(pool);
    const commentRepo = new CommentRepository(pool);
    const attachRepo = new AttachmentRepository(pool);
    const aiTrainRepo = new AITrainingDataRepository(pool);
    const ratingRepo = new RatingRepository(pool);

    // ---------------------------- ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ -------------------------------
    const emailService = new EmailService();
    const notificationService = new NotificationService(notificationRepo);
    const aiService = new AIService(chatRepo, ticketRepo, notificationService, aiTrainRepo);
    const authService = new AuthService(userRepo, logRepo, emailService);
    const userService = new UserService(userRepo, logRepo);
    const statusService = new StatusService(statusRepo);
    const categoryService = new CategoryService(categoryRepo);
    const commentService = new CommentService(commentRepo);
    const attachmentService = new AttachmentService(attachRepo);
    const priorityService = new PriorityService();
    const statsService = new StatsService(ticketRepo, userRepo, logRepo, aiTrainRepo);
    const ticketService = new TicketService(ticketRepo, statusRepo, historyRepo, notificationService, logRepo, emailService, userRepo, aiService, commentRepo, aiTrainRepo, chatRepo);
    const ratingService = new RatingService(ratingRepo, ticketRepo);

    // ---------------------------- ИНИЦИАЛИЗАЦИЯ КОНТРОЛЛЕРОВ -------------------------------
    const authController = new AuthController(authService, userService, emailService);
    const adminController = new AdminController(authService, categoryService, statsService, userService, statusService, ticketService,userRepo,emailService, aiService);
    const ticketController = new TicketController(ticketService, authService, priorityService, aiService, notificationService, statsService, commentService, attachmentService);
    const notificationController = new NotificationController(notificationService, userService);
    const googleAuthService = new GoogleAuthService(userRepo, authService);
    const googleAuthController = new GoogleAuthController(googleAuthService, authService);
    const operatorController = new OperatorController(ticketService, authService);
    const expertController = new ExpertController(ticketService, authService);
    const ratingController = new RatingController(ratingService, authService);
    const userController = new UserController(userRepo);

    // ---------------------------- MIDDLEWARE -------------------------------
    const authMiddleware = new AuthMiddleware(authService);
    const roleMiddleware = new RoleMiddleware();
    const roleScriptMiddleware = new RoleScriptMiddleware();

    // ---------------------------- НАСТРОЙКА EXPRESS -------------------------------
    // Статика — корень проекта (/app)
    app.use(express.static(path.join(__dirname, '../')));

    app.use('/scripts-js', roleScriptMiddleware.serveScript);

    const frontendDir = path.join(__dirname, '../frontend');
    app.use('/scripts-js', express.static(path.join(frontendDir, 'scripts-js')));
    app.use('/css', express.static(path.join(frontendDir, 'css')));
    app.use('/files', express.static(path.join(frontendDir, 'files')));
    app.use('/htmls', express.static(path.join(frontendDir, 'htmls')));

    const corsOptions = {
        origin: [process.env.FRONTEND_URL],
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    };
    app.use(cors(corsOptions));

    app.use(cookieParser());
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

   app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));

    // ---------------------------- НАСТРОЙКА SESSION -------------------------------
    let sessionStore = null;

    if (isRedisConnected) {
        try {
            const { RedisStore } = require('connect-redis');
            sessionStore = new RedisStore({
                client: redisClient,
                prefix: 'sess:',
                ttl: 86400
            });
            redisLogger.info('Redis session store configured');
        } catch (err) {
            redisLogger.error('Failed to create Redis store', { message: err.message });
            sessionStore = undefined;
        }
    }
    
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        }
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    // ---------------------------- НАСТРОЙКА RATE LIMITING -------------------------------
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 500,
        standardHeaders: true,
        legacyHeaders: false
    });

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false
    });

    const registerLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false
    });

    const ticketLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false
    });

    const translateLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false
    });

    app.use('/api/', limiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', registerLimiter);
    app.use('/api/tickets', ticketLimiter);
    app.use('/api/translate', translateLimiter);

    // ---------------------------- TRANSLATION LOGIC С LRU CACHE -------------------------------
    const translationCache = new LRUCache({
        max: 1000,
        ttl: 1000 * 60 * 60, // 1 час
        updateAgeOnGet: true
    });

    async function translateText(text, from, to) {
        if (!text || text.trim() === '') return text;
        const cacheKey = `${text}_${from}_${to}`;
        const cached = translationCache.get(cacheKey);
        if (cached) return cached;

        try {
            const url = 'https://translate.googleapis.com/translate_a/single';
            const params = {
                client: 'gtx',
                sl: from || 'auto',
                tl: to || 'en',
                dt: 't',
                q: text
            };
            const fullUrl = url + '?' + querystring.stringify(params);
            
            const response = await got(fullUrl, {
                timeout: { request: 5000, lookup: 2000, connect: 2000 },
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                https: { rejectUnauthorized: false },
                retry: { limit: 1 }
            });
            
            const data = JSON.parse(response.body);
            let translatedText = '';
            if (data && data[0]) {
                for (const part of data[0]) {
                    if (part && part[0]) translatedText += part[0];
                }
            }
            const result = translatedText || text;

            translationCache.set(cacheKey, result);
            return result;
        } catch (error) {
            translationLogger.error('Translation error', { message: error.message, text: text?.substring(0, 100) });
            return text;
        }
    }

    app.post('/api/translate', async (req, res) => {
        const { text, from, to } = req.body;
        if (!text) return res.status(400).json({ success: false, error: 'Text is required' });
        const translated = await translateText(text, from, to);
        res.json({ success: true, original: text, translated, from, to });
    });

    app.post('/api/translate/batch', async (req, res) => {
        try {
            const { texts, from, to } = req.body;
            if (!texts || !Array.isArray(texts)) return res.status(400).json({ success: false, error: 'No texts provided' });
            
            const results = [];
            const uncachedTexts = [];
            
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                const cacheKey = `${text}_${from}_${to}`;
                const cached = translationCache.get(cacheKey);
                if (cached) {
                    results.push({ original: text, translated: cached });
                } else {
                    uncachedTexts.push(text);
                }
            }
            
            if (uncachedTexts.length > 0) {
                const BATCH_SIZE = 5;
                const batches = [];
                for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
                    batches.push(uncachedTexts.slice(i, i + BATCH_SIZE));
                }

                const allTranslations = [];
                for (const batch of batches) {
                    const batchTranslations = await Promise.all(batch.map(text => translateText(text, from, to)));
                    allTranslations.push(...batchTranslations);
                }
                
                for (let i = 0; i < uncachedTexts.length; i++) {
                    const translated = allTranslations[i];
                    const text = uncachedTexts[i];
                    const cacheKey = `${text}_${from}_${to}`;
                    translationCache.set(cacheKey, translated);
                    results.push({ original: text, translated });
                }
            }
            res.json({ success: true, translations: results });
        } catch (error) {
            translationLogger.error('Batch translation error', { message: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/translate/health', (req, res) => {
        res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
    });

    // ---------------------------- OAUTH STRATEGIES -------------------------------
    if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
        const YandexStrategy = require('passport-yandex').Strategy;
        passport.use(new YandexStrategy({
            clientID: process.env.YANDEX_CLIENT_ID,
            clientSecret: process.env.YANDEX_CLIENT_SECRET,
            callbackURL: process.env.YANDEX_CALLBACK_URL
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                let user = await userRepo.findByEmail(email);
                if (!user) user = await authService.createOAuthUser(email, profile.displayName);
                return done(null, user);
            } catch (err) { return done(err, null); }
        }));
        authLogger.info('Yandex OAuth enabled');
    } else {
        authLogger.warn('Yandex OAuth disabled (YANDEX_CLIENT_ID not set)');
    }

    if (process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET) {
        const VKStrategy = require('passport-vkontakte').Strategy;
        passport.use(new VKStrategy({
            clientID: process.env.VK_CLIENT_ID,
            clientSecret: process.env.VK_CLIENT_SECRET,
            callbackURL: process.env.VK_CALLBACK_URL,
            scope: ['email']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.id}@vk.com`;
                let user = await userRepo.findByEmail(email);
                if (!user) user = await authService.createOAuthUser(email, profile.displayName);
                return done(null, user);
            } catch (err) { return done(err, null); }
        }));
        authLogger.info('VK OAuth enabled');
    } else {
        authLogger.warn('VK OAuth disabled (VK_CLIENT_ID not set)');
    }

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        const user = await userRepo.findById(id);
        done(null, user);
    });

    // ---------------------------- OAUTH ROUTES -------------------------------
    app.get('/api/auth/yandex', passport.authenticate('yandex'));
    app.get('/api/auth/yandex/callback', 
        passport.authenticate('yandex', { failureRedirect: '/login' }),
        (req, res) => {
            const token = authService.generateToken(req.user);
            res.cookie('accessToken', token, { httpOnly: true, secure: false, sameSite: 'lax' });
            res.redirect(`${process.env.FRONTEND_URL}/htmls/dashboardclient.html`);
        }
    );

    app.get('/api/auth/vk', passport.authenticate('vkontakte'));
    app.get('/api/auth/vk/callback', 
        passport.authenticate('vkontakte', { failureRedirect: '/login' }),
        (req, res) => {
            const token = authService.generateToken(req.user);
            res.cookie('accessToken', token, { httpOnly: true, secure: false, sameSite: 'lax' });
            res.redirect(process.env.FRONTEND_URL);
        }
    );

    app.get('/api/auth/google', googleAuthController.googleAuth);
    app.get('/api/auth/google/callback', googleAuthController.googleCallback);

    // ---------------------------- API ROUTES -------------------------------
    app.use('/api/auth', authRoutes(authController, authMiddleware));
    app.use('/api/admin', adminRoutes(adminController, authMiddleware, roleMiddleware));
    app.use('/api/tickets', ticketRoutes(ticketController, authMiddleware, roleMiddleware));
    app.use('/api/notifications', notificationRoutes(notificationController, authMiddleware));
    app.use('/api/operator', operatorRoutes(operatorController, authMiddleware, roleMiddleware));
    app.use('/api/expert', expertRoutes(expertController, authMiddleware, roleMiddleware));
    app.use('/api/ratings', ratingRoutes(ratingController, authMiddleware, roleMiddleware));
    app.use('/api/profile', profileRoutes(userController, authMiddleware));

    // Корневой редирект — / открывает страницу логина
    app.get('/', (req, res) => {
        res.redirect('/htmls/auth/login-client.html');
    });

    
    app.get(/^(?!\/api).*$/, (req, res) => {
        const mainModule = path.join(__dirname, '../frontend/main-module.html');
        res.sendFile(mainModule);
    });

    app.use((req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });

    app.use(errorHandler);

    // ---------------------------- SOCKET.IO -------------------------------
    const PORT = process.env.PORT || 3001;
    const server = http.createServer(app);

    let io;
    if (isRedisConnected) {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = redisClient.duplicate();
        const subClient = redisClient.duplicate();
        
        io = socketIo(server, {
            cors: corsOptions,
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });

        await pubClient.connect();
        await subClient.connect();
        io.adapter(createAdapter(pubClient, subClient));
        redisLogger.info('Socket.IO Redis adapter connected');
    } else {
        io = socketIo(server, {
            cors: corsOptions,
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });
    }

    global.sendNotification = (event, data) => io.emit(event, data);
    global.io = io;

    // ---------------------------- ЗАЩИТА ОТ ДУБЛЕЙ -------------------------------

    io.on('connection', (socket) => {
        socketLogger.info('Client connected', { socketId: socket.id });

        // Heartbeat handlers
        socket.on('ping', () => {
            socket.emit('pong');
        });

        socket.on('register', (userId) => {
            socket.userId = userId;
            socket.join(`user_${userId}`);
            socketLogger.info('User registered', { userId, socketId: socket.id });
        });

        socket.on('join_ticket_room', (ticketId) => {
            socket.join(`ticket_${ticketId}`);
            socket.emit('room_joined', { ticketId });
            socketLogger.debug('Socket joined ticket room', { ticketId, socketId: socket.id });
        });

        socket.on('leave_ticket_room', (ticketId) => {
            socket.leave(`ticket_${ticketId}`);
            socketLogger.debug('Socket left ticket room', { ticketId, socketId: socket.id });
        });

        const sentMessages = new Map();
        const DEDUP_WINDOW = 10000; // 10 секунд
        
        // Очистка каждые 5 секунд
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, time] of sentMessages.entries()) {
                if (now - time > DEDUP_WINDOW) {
                    sentMessages.delete(key);
                }
            }
        }, 5000);
        
        // Очистка при отключении
        socket.on('disconnect', () => {
            clearInterval(cleanupInterval);
        });

         function isDuplicate(userId, message, attachments, timestamp) {
            const fileHash = (attachments || [])
                .map(f => `${f.filename || f.name}_${f.size}`)
                .sort()
                .join('|');
            // Округление времени до 5 секунд для устойчивости
            const timeBucket = Math.floor(new Date(timestamp).getTime() / 5000);
            const hash = `${userId}|${message || 'empty'}|${fileHash}|${timeBucket}`;
            
            const now = Date.now();
            if (sentMessages.has(hash) && now - sentMessages.get(hash) < DEDUP_WINDOW) {
                return true;
            }
            sentMessages.set(hash, now);
            return false;
        }


        // ---------------------------- ОСНОВНОЙ ОБРАБОТЧИК СООБЩЕНИЙ ЧАТА -------------------------------
        socket.on('chat_message', async (data) => {
            const { ticketId, message, userId, sender, isCallingOperator, hasImages, attachments, timestamp, hasOptimistic } = data;
            
            // Дедупликация
            const currentUserId = userId || socket.userId;
            if (isDuplicate(currentUserId, message, attachments, timestamp)) {
                socketLogger.warn('Duplicate message skipped', { userId: currentUserId, socketId: socket.id });
                return;
            }

            try {
               const messageSender = sender || 'client';
               const serverTimestamp = new Date().toISOString();
               let currentTicketId = ticketId;

                // ---------------------------- СООБЩЕНИЕ ОТ ОПЕРАТОРА -------------------------------
                if (messageSender === 'operator') {
                    if (currentTicketId) {
                        await chatRepo.saveMessage(currentTicketId, 'operator', message, attachments || []);
                        io.to(`ticket_${currentTicketId}`).emit('new_message', {
                            ticketId: currentTicketId,
                            sender: 'operator',
                            operatorId: data.operatorId,
                            operatorName: data.operatorName,
                            message: message,
                            attachments: attachments || [],
                            timestamp: serverTimestamp
                        });
                    }
                    return;
                }

                // ---------------------------- СОЗДАНИЕ НОВОГО ТИКЕТА -------------------------------
                 if (!currentTicketId) {
                    const needsOperator = isCallingOperator || hasImages || 
                        /оператор|сотрудник|специалист|человек|помогите|переключите|соедините|срочно|жалоба/i.test(message || '');

                    let categoryId = null;
                    let categoryName = null;
                    if (message && message.trim()) {
                        try {
                            const aiResult = await aiService.generateResponse(message, false);
                            categoryName = aiResult.category;
                            
                            if (categoryName) {
                                // Ищем ID категории в БД
                                const categories = await categoryRepo.findAll();
                                const foundCategory = categories.find(
                                    cat => cat.name.toLowerCase() === categoryName.toLowerCase()
                                );
                                if (foundCategory) {
                                    categoryId = foundCategory.id;
                                    console.log(' Определена категория:', categoryName, 'ID:', categoryId);
                                }
                            }
                        } catch (aiError) {
                            console.error('Ошибка определения категории:', aiError);
                        }
                    }
                    const freeOperator = needsOperator ? await userRepo.findLeastLoadedOperator() : null;
                    
                    const ticket = await ticketService.createTicket(
                        currentUserId,
                        'Чат с поддержкой',
                        message || (hasImages ? '📎 Вложение' : ''),
                        categoryId,
                        needsOperator ? (freeOperator ? 2 : 3) : 1,
                        (needsOperator && freeOperator) ? freeOperator.id : null
                    );
                    currentTicketId = ticket.id;
                    
                    socket.join(`ticket_${currentTicketId}`);
                    socket.ticketId = currentTicketId;
                    
                    // Сохранение сообщения клиента (если есть контент)
                    const hasValidContent = (message && message.trim()) || (attachments && attachments.length > 0);
                    if (hasValidContent) {
                        await chatRepo.saveMessage(currentTicketId, 'client', message || '', attachments || []);
                        
                        io.to(`ticket_${currentTicketId}`).emit('new_message', {
                            ticketId: currentTicketId,
                            id: Date.now(), 
                            sender: 'client',
                            message: message || '',
                            attachments: attachments || [],
                            timestamp: serverTimestamp,
                            hasOptimistic: hasOptimistic
                        });
                    }
                    
                    // ОБЪЕДИНЯЕМ СООБЩЕНИЯ ПРИ НАЛИЧИИ ОПЕРАТОРА
                   if (freeOperator && needsOperator) {
                        const systemPart = `Заявка #${currentTicketId} передана оператору ${freeOperator.full_name || freeOperator.email}`;
                        const greetingPart = `Здравствуйте! Я ваш оператор. Чем могу помочь?`;
                        
                        // Сохраняем в БД с метаданными
                        await chatRepo.saveMessage(currentTicketId, 'system', systemPart, [], {
                            isNotification: true,
                            ticketId: currentTicketId
                        });
                        await chatRepo.saveMessage(currentTicketId, 'operator', greetingPart, [], {
                            operatorId: freeOperator.id,
                            operatorName: freeOperator.full_name || freeOperator.email,
                            isInitialGreeting: true  
                        });
                        
                      
                        io.to(`ticket_${currentTicketId}`).emit('new_message', {
                            ticketId: currentTicketId,
                            sender: 'system',
                            message: systemPart,
                            timestamp: serverTimestamp,
                            isSystemNotification: true,  
                            isInitialNotification: true
                        });
                        
                        io.to(`ticket_${currentTicketId}`).emit('new_message', {
                            ticketId: currentTicketId,
                            sender: 'operator',
                            operatorId: freeOperator.id,
                            operatorName: freeOperator.full_name || freeOperator.email,
                            message: greetingPart,
                            attachments: [],
                            timestamp: serverTimestamp,
                            isInitialGreeting: true  // ← Флаг для приветствия
                        });
                        
                        socket.emit('ticket_created_with_operator', {
                            ticketId: currentTicketId,
                            operatorId: freeOperator.id,
                            operatorName: freeOperator.full_name || freeOperator.email
                        });
                        
                    } else if (needsOperator && !freeOperator) {
                     socket.emit('ticket_created_waiting', {
                    ticketId: currentTicketId,
                    status: 'waiting_operator'
                });
                
                await chatRepo.saveMessage(currentTicketId, 'system',
                    `Заявка #${currentTicketId} создана. Ожидаем свободного оператора...`);
                
                io.emit('operator_needed', {
                    ticketId: currentTicketId,
                    priority: 'high',
                    timestamp: serverTimestamp,
                    hasImages: hasImages
                });
                
            } else {
                socket.emit('ticket_created', {
                    ticketId: currentTicketId,
                    status: 'ai_chat'
                });
                
                const aiResult = await aiService.generateResponse(message, false);
                const aiResponse = aiResult.response || "Здравствуйте! Я AI помощник. Чем могу помочь?";
                await chatRepo.saveMessage(currentTicketId, 'ai', aiResponse);
                
                io.to(`ticket_${currentTicketId}`).emit('new_message', {
                    ticketId: currentTicketId,
                    sender: 'ai',
                    message: aiResponse,
                    attachments: [],
                    timestamp: serverTimestamp
                });
            }
                    return;
                }
                
                // ---------------------------- СУЩЕСТВУЮЩИЙ ТИКЕТ -------------------------------
                const hasValidMessage = message && message.trim();
                const hasValidAttachments = attachments && attachments.length > 0;
                
                if (!hasValidMessage && !hasValidAttachments) {
                    socketLogger.debug('Empty message skipped', { ticketId: currentTicketId });
                    return;
                }
                
                await chatRepo.saveMessage(currentTicketId, messageSender, message || '', attachments || []);
                
                io.to(`ticket_${currentTicketId}`).emit('new_message', {
                    ticketId: currentTicketId,
                    sender: messageSender,
                    message: message || '',
                    attachments: attachments || [],
                    timestamp: serverTimestamp,
                    hasOptimistic: hasOptimistic
                });
                
                // ---------------------------- ЛОГИКА ПЕРЕДАЧИ ОПЕРАТОРУ -------------------------------
                if (messageSender === 'client') {
                    const ticketInfo = await ticketRepo.findById(currentTicketId);
                    
                    if (ticketInfo?.operator_id) {
                        socket.emit('operator_already_assigned', {
                            ticketId: currentTicketId,
                            operatorName: ticketInfo.operator_name || 'Оператор'
                        });
                        return;
                    }
                    
                    const needsOperator = isCallingOperator || hasImages ||
                        /оператор|сотрудник|специалист|человек|помогите|переключите|соедините/i.test(message || '');
                    
                    if (needsOperator) {
                        const freeOperator = await userRepo.findLeastLoadedOperator();
                        
                        if (freeOperator) {
                            await ticketRepo.assignOperator(currentTicketId, freeOperator.id);
                            await ticketRepo.updateStatus(currentTicketId, 2);
                            
                            // ОДНО сообщение для системы + оператора
                            const combinedMsg = `Заявка #${currentTicketId} передана оператору ${freeOperator.full_name || freeOperator.email}\n\n Здравствуйте! Я ваш оператор. Чем могу помочь?`;
                            
                            await chatRepo.saveMessage(currentTicketId, 'operator', combinedMsg);
                            io.to(`ticket_${currentTicketId}`).emit('new_message', {
                                ticketId: currentTicketId,
                                sender: 'operator',
                                operatorId: freeOperator.id,
                                operatorName: freeOperator.full_name || freeOperator.email,
                                message: combinedMsg,
                                attachments: [],
                                timestamp: serverTimestamp
                            });
                            
                            io.to(`ticket_${currentTicketId}`).emit('operator_assigned', {
                                ticketId: currentTicketId,
                                operatorId: freeOperator.id,
                                operatorName: freeOperator.full_name || freeOperator.email
                            });
                            
                            io.to(`user_${freeOperator.id}`).emit('new_ticket_assigned', {
                                ticketId: currentTicketId,
                                clientName: `Клиент #${currentUserId}`,
                                message: message
                            });
                            
                        } else {
                            await ticketRepo.updateStatus(currentTicketId, 3);
                            
                            const queueMsg = `⏳ Нет свободных операторов. Ваша заявка в очереди.`;
                            await chatRepo.saveMessage(currentTicketId, 'system', queueMsg);
                            io.to(`ticket_${currentTicketId}`).emit('new_message', {
                                ticketId: currentTicketId,
                                sender: 'system',
                                message: queueMsg,
                                timestamp: serverTimestamp
                            });
                            
                            io.to(`ticket_${currentTicketId}`).emit('waiting_for_operator', {
                                ticketId: currentTicketId,
                                message: 'Ожидайте, оператор подключится в ближайшее время.'
                            });
                        }
                        return;
                    }
                    
                    // ---------------------------- ОБЫЧНЫЙ AI ОТВЕТ -------------------------------
                    const aiResult = await aiService.sendMessageWithSave(currentTicketId, message, hasImages);
                    
                    if (aiResult.response && !aiResult.waiting_for_operator) {
                        io.to(`ticket_${currentTicketId}`).emit('new_message', {
                            ticketId: currentTicketId,
                            sender: 'ai',
                            message: aiResult.response,
                            attachments: [],
                            timestamp: serverTimestamp
                        });
                    }
                    
                    if (aiResult.waiting_for_operator) {
                        io.to(`ticket_${currentTicketId}`).emit('waiting_for_operator', {
                            ticketId: currentTicketId,
                            message: 'Ожидаем оператора...'
                        });
                    }
                }
                
            } catch (error) {
                socketLogger.error('Chat message error', { 
                    error: error.message, 
                    stack: error.stack,
                    ticketId: data.ticketId,
                    userId: data.userId 
                });
                socket.emit('chat_error', { 
                    message: 'Произошла ошибка при отправке сообщения',
                    error: error.message 
                });
            }
        });

        socket.on('get_chat_history', async (data) => {
            const { ticketId } = data;
            try {
                const messages = await chatRepo.getMessagesByTicket(ticketId);
                // Фильтруем системные сообщения перед отправкой
                const filteredMessages = messages.filter(msg => {
                    if (msg.sender === 'system' || msg.sender === 'operator') {
                        const hideList = [
                            'создана и передана',
                            'назначен на заявку',
                            'Заявка #',
                            'Заявка #',
                            'Здравствуйте! Я ваш оператор'
                        ];
                        return !hideList.some(hide => msg.text?.includes(hide));
                    }
                    return true;
                });
                socket.emit('chat_history', { ticketId, messages: filteredMessages });
            } catch (error) {
                socketLogger.error('Get chat history error', { error: error.message, ticketId });
                socket.emit('chat_history', { ticketId, messages: [], error: error.message });
            }
        });

        socket.on('ticket_completed', async (data) => {
            const { ticketId, completedBy, completedByName, timestamp } = data;
            if (!ticketId) return;
            socketLogger.info('Ticket completed', { ticketId, completedBy, completedByName });
            io.to(`ticket_${ticketId}`).emit('ticket_completed', { 
                ticketId, 
                completedBy, 
                completedByName, 
                timestamp: timestamp || new Date().toISOString() 
            });
        });

        socket.on('disconnect', () => {
            socketLogger.info('Client disconnected', { socketId: socket.id });
        });
    });


    server.listen(PORT, '0.0.0.0', () => {
        logger.info(`Worker ${process.pid} - Server running on port ${PORT}`);
        logger.info(`Redis connected: ${isRedisConnected ? 'Yes' : 'No'}`);
    });

    process.on('SIGTERM', async () => {
        logger.info(`Worker ${process.pid} received SIGTERM`);
        server.close(async () => {
            if (redisClient && isRedisConnected) await redisClient.quit();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000);
    });
}

startServer().catch(err => {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
});
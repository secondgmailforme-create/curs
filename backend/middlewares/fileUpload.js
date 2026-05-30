// middlewares/fileUpload.js 

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');



// ----- ОСТАЛЬНЫЕ НАСТРОЙКИ ДЛЯ ТИКЕТОВ-----
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Оригинальное хранилище для тикетов (оставляем как было)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'frontend', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const dateDir = path.join(uploadDir, new Date().toISOString().split('T')[0]);
        if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
        }
        cb(null, dateDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        const sanitizedName = file.originalname
            .replace(/[^a-zA-Z0-9а-яА-ЯёЁ.\-_]/g, '_')
            .substring(0, 50);
        cb(null, `${uniqueSuffix}_${sanitizedName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        const error = new Error(`Недопустимый тип файла. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const error = new Error(`Недопустимый MIME тип: ${file.mimetype}`);
        error.code = 'INVALID_MIME_TYPE';
        return cb(error, false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 5 },
    fileFilter: fileFilter
});

// Middleware для обработки ошибок
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: `Слишком много файлов. Максимум: 5`
            });
        }
        return res.status(400).json({ success: false, error: err.message });
    }

    if (err) {
        if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_MIME_TYPE') {
            return res.status(400).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: 'Ошибка загрузки файла' });
    }
    next();
};

const validateUploadedFile = (req, res, next) => {
    // Временно отключаем проверку для отладки
    console.log('Uploaded file:', req.file?.originalname);
    return next();
};

module.exports = {
    upload,
    handleMulterError,
    validateUploadedFile,
    MAX_FILE_SIZE,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS
};
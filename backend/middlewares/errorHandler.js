//Базовый класс для частых ошибок
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    let statusCode = err.statusCode || 500;
    
    if (!err.statusCode) {
        if (err.message === 'User already exists') {
            statusCode = 409; // Conflict
        } else if (err.message.includes('not found')) {
            statusCode = 404; // Not Found
        } else if (err.message === 'Invalid credentials' || err.message.includes('token')) {
            statusCode = 401; // Unauthorized
        } else if (err.message.includes('Only') || err.message.includes('already') || err.name === 'ValidationError') {
            statusCode = 400; // Bad Request
        }
    }

    res.status(statusCode).json({
        status: statusCode >= 500 ? 'error' : 'fail',
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler; // Выгрузка
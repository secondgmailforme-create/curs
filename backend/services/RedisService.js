const Redis = require('redis');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

// Настройка логгера для Redis
const logDir = path.join(__dirname, '../../logs');

const redisLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'redis-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.Console({
            format: winston.format.simple(),
            level: process.env.NODE_ENV === 'production' ? 'error' : 'info'
        })
    ]
});

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

            this.client = Redis.createClient({ url: redisUrl });

            this.client.on('error', (err) => {
                redisLogger.error('Redis Client Error', { message: err.message });
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                redisLogger.info('Connected to Redis');
                this.isConnected = true;
            });

            await this.client.connect();

            return true;
        } catch (error) {
            redisLogger.error('Failed to connect to Redis', { message: error.message });
            redisLogger.warn('Working without Redis - using in-memory storage');
            this.isConnected = false;
            return false;
        }
    }

    // Сессии
    async setSession(sessionId, data, ttl = 3600) {
        if (!this.isConnected) return null;
        try {
            await this.client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data));
            redisLogger.debug('Session set', { sessionId, ttl });
            return true;
        } catch (error) {
            redisLogger.error('Redis setSession error', { error: error.message, sessionId });
            return null;
        }
    }

    async getSession(sessionId) {
        if (!this.isConnected) return null;
        try {
            const data = await this.client.get(`session:${sessionId}`);
            if (data) {
                redisLogger.debug('Session retrieved', { sessionId });
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            redisLogger.error('Redis getSession error', { error: error.message, sessionId });
            return null;
        }
    }

    async deleteSession(sessionId) {
        if (!this.isConnected) return null;
        try {
            await this.client.del(`session:${sessionId}`);
            redisLogger.debug('Session deleted', { sessionId });
            return true;
        } catch (error) {
            redisLogger.error('Redis deleteSession error', { error: error.message, sessionId });
            return null;
        }
    }

    // Кэш
    async setCache(key, value, ttl = 300) {
        if (!this.isConnected) return null;
        try {
            await this.client.setEx(`cache:${key}`, ttl, JSON.stringify(value));
            redisLogger.debug('Cache set', { key, ttl });
            return true;
        } catch (error) {
            redisLogger.error('Redis setCache error', { error: error.message, key });
            return null;
        }
    }

    async getCache(key) {
        if (!this.isConnected) return null;
        try {
            const data = await this.client.get(`cache:${key}`);
            if (data) {
                redisLogger.debug('Cache retrieved', { key });
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            redisLogger.error('Redis getCache error', { error: error.message, key });
            return null;
        }
    }

    async deleteCache(key) {
        if (!this.isConnected) return null;
        try {
            await this.client.del(`cache:${key}`);
            redisLogger.debug('Cache deleted', { key });
            return true;
        } catch (error) {
            redisLogger.error('Redis deleteCache error', { error: error.message, key });
            return null;
        }
    }

    // Rate limiting счетчики
    async incrementCounter(key, windowMs) {
        if (!this.isConnected) return null;
        try {
            const count = await this.client.incr(`rate:${key}`);
            if (count === 1) {
                await this.client.pexpire(`rate:${key}`, windowMs);
            }
            redisLogger.debug('Counter incremented', { key, count, windowMs });
            return count;
        } catch (error) {
            redisLogger.error('Redis incrementCounter error', { error: error.message, key });
            return null;
        }
    }

    // Статистика онлайн пользователей
    async trackOnlineUser(userId, socketId) {
        if (!this.isConnected) return null;
        try {
            await this.client.sAdd(`online:${userId}`, socketId);
            await this.client.sAdd('online:all', `${userId}:${socketId}`);
            redisLogger.debug('Online user tracked', { userId, socketId });
            return true;
        } catch (error) {
            redisLogger.error('Redis trackOnlineUser error', { error: error.message, userId, socketId });
            return null;
        }
    }

    async removeOnlineUser(userId, socketId) {
        if (!this.isConnected) return null;
        try {
            await this.client.sRem(`online:${userId}`, socketId);
            await this.client.sRem('online:all', `${userId}:${socketId}`);
            redisLogger.debug('Online user removed', { userId, socketId });
            return true;
        } catch (error) {
            redisLogger.error('Redis removeOnlineUser error', { error: error.message, userId, socketId });
            return null;
        }
    }

    async getOnlineUsersCount() {
        if (!this.isConnected) return null;
        try {
            const count = await this.client.sCard('online:all');
            redisLogger.debug('Online users count retrieved', { count });
            return count;
        } catch (error) {
            redisLogger.error('Redis getOnlineUsersCount error', { error: error.message });
            return null;
        }
    }

    async getUserOnlineSockets(userId) {
        if (!this.isConnected) return null;
        try {
            const sockets = await this.client.sMembers(`online:${userId}`);
            return sockets;
        } catch (error) {
            redisLogger.error('Redis getUserOnlineSockets error', { error: error.message, userId });
            return null;
        }
    }

    async isUserOnline(userId) {
        if (!this.isConnected) return false;
        try {
            const count = await this.client.sCard(`online:${userId}`);
            return count > 0;
        } catch (error) {
            redisLogger.error('Redis isUserOnline error', { error: error.message, userId });
            return false;
        }
    }

    async getAllOnlineUsers() {
        if (!this.isConnected) return [];
        try {
            const users = await this.client.sMembers('online:all');
            const uniqueUsers = [...new Set(users.map(u => u.split(':')[0]))];
            redisLogger.debug('All online users retrieved', { count: uniqueUsers.length });
            return uniqueUsers;
        } catch (error) {
            redisLogger.error('Redis getAllOnlineUsers error', { error: error.message });
            return [];
        }
    }

    // Публикация/Подписка для межпроцессорной коммуникации
    async publish(channel, message) {
        if (!this.isConnected) return null;
        try {
            await this.client.publish(channel, JSON.stringify(message));
            redisLogger.debug('Message published', { channel });
            return true;
        } catch (error) {
            redisLogger.error('Redis publish error', { error: error.message, channel });
            return null;
        }
    }

    async subscribe(channel, callback) {
        if (!this.isConnected) return null;
        try {
            const subscriber = this.client.duplicate();
            await subscriber.connect();
            await subscriber.subscribe(channel, (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    redisLogger.debug('Message received', { channel });
                    callback(parsedMessage);
                } catch (parseError) {
                    redisLogger.error('Failed to parse subscription message', { error: parseError.message, channel });
                    callback(message);
                }
            });
            redisLogger.info('Subscribed to channel', { channel });
            return subscriber;
        } catch (error) {
            redisLogger.error('Redis subscribe error', { error: error.message, channel });
            return null;
        }
    }

    async unsubscribe(subscriber, channel) {
        if (!subscriber) return false;
        try {
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
            redisLogger.info('Unsubscribed from channel', { channel });
            return true;
        } catch (error) {
            redisLogger.error('Redis unsubscribe error', { error: error.message, channel });
            return false;
        }
    }

    // Дополнительные методы для работы с очередями
    async pushToQueue(queueName, data) {
        if (!this.isConnected) return null;
        try {
            const result = await this.client.rPush(`queue:${queueName}`, JSON.stringify(data));
            redisLogger.debug('Pushed to queue', { queueName, size: result });
            return result;
        } catch (error) {
            redisLogger.error('Redis pushToQueue error', { error: error.message, queueName });
            return null;
        }
    }

    async popFromQueue(queueName, timeout = 0) {
        if (!this.isConnected) return null;
        try {
            let result;
            if (timeout > 0) {
                result = await this.client.blPop(`queue:${queueName}`, timeout);
                result = result ? JSON.parse(result.element) : null;
            } else {
                result = await this.client.lPop(`queue:${queueName}`);
                result = result ? JSON.parse(result) : null;
            }
            if (result) {
                redisLogger.debug('Popped from queue', { queueName });
            }
            return result;
        } catch (error) {
            redisLogger.error('Redis popFromQueue error', { error: error.message, queueName });
            return null;
        }
    }

    async getQueueLength(queueName) {
        if (!this.isConnected) return 0;
        try {
            const length = await this.client.lLen(`queue:${queueName}`);
            return length;
        } catch (error) {
            redisLogger.error('Redis getQueueLength error', { error: error.message, queueName });
            return 0;
        }
    }

    // Метод для получения статуса соединения
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            timestamp: new Date().toISOString()
        };
    }

    // Очистка всех ключей (только для тестов!)
    async flushAll() {
        if (!this.isConnected) return false;
        try {
            if (process.env.NODE_ENV === 'test') {
                await this.client.flushAll();
                redisLogger.warn('Redis flushAll executed (test environment)');
                return true;
            }
            redisLogger.warn('Redis flushAll blocked (not test environment)');
            return false;
        } catch (error) {
            redisLogger.error('Redis flushAll error', { error: error.message });
            return false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            try {
                await this.client.quit();
                this.isConnected = false;
                redisLogger.info('Disconnected from Redis');
            } catch (error) {
                redisLogger.error('Error disconnecting from Redis', { error: error.message });
            }
        }
    }
}

module.exports = new RedisService();
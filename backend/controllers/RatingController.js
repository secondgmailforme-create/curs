const BaseController = require('./BaseController');

class RatingController extends BaseController {
    constructor(ratingService, authService) {
        super();
        this.ratingService = ratingService;
        this.authService = authService;
    }

    async createRating(req, res) {
        try {
            const { ticket_id, rating, comment } = req.body;
            const clientId = req.user.id;

            if (!ticket_id || !rating) {
                return this.validationError(res, ['ticket_id и rating обязательны']);
            }

            if (rating < 1 || rating > 5) {
                return this.validationError(res, ['Рейтинг должен быть от 1 до 5']);
            }

            const result = await this.ratingService.rateTicket(ticket_id, clientId, rating, comment);
            this.success(res, result, 201);
        } catch (error) {
            console.error('Create rating error:', error);
            this.error(res, error.message);
        }
    }

    async getRatingByTicket(req, res) {
        try {
            const { ticket_id } = req.params;
            const rating = await this.ratingService.getRatingByTicket(ticket_id);

            if (!rating) {
                return this.notFound(res, 'Оценка не найдена');
            }

            this.success(res, rating);
        } catch (error) {
            console.error('Get rating error:', error);
            this.error(res, error.message);
        }
    }

    async getOperatorStats(req, res) {
        try {
            const operatorId = req.params.id || req.user.id;
            const stats = await this.ratingService.getOperatorAverageRating(operatorId);
            this.success(res, stats);
        } catch (error) {
            console.error('Get operator stats error:', error);
            this.error(res, error.message);
        }
    }

    async getExpertStats(req, res) {
        try {
            const expertId = req.params.id || req.user.id;
            const stats = await this.ratingService.getExpertAverageRating(expertId);
            this.success(res, stats);
        } catch (error) {
            console.error('Get expert stats error:', error);
            this.error(res, error.message);
        }
    }

    async getOperatorRatings(req, res) {
        try {
            const operatorId = req.params.id || req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const ratings = await this.ratingService.getOperatorRatings(operatorId, limit, offset);
            this.success(res, ratings);
        } catch (error) {
            console.error('Get operator ratings error:', error);
            this.error(res, error.message);
        }
    }

    async getExpertRatings(req, res) {
        try {
            const expertId = req.params.id || req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const ratings = await this.ratingService.getExpertRatings(expertId, limit, offset);
            this.success(res, ratings);
        } catch (error) {
            console.error('Get expert ratings error:', error);
            this.error(res, error.message);
        }
    }

    // 👇 Добавьте эти два метода-алиаса
    async getMyOperatorRatings(req, res) {
        return this.getOperatorRatings(req, res);
    }

    async getMyExpertRatings(req, res) {
        return this.getExpertRatings(req, res);
    }

    async getAdminRatingStats(req, res) {
        try {
            const stats = await this.ratingService.getAdminStats();
            this.success(res, stats);
        } catch (error) {
            console.error('Get admin rating stats error:', error);
            this.error(res, error.message);
        }
    }

    async getAllRatings(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            
            const ratings = await this.ratingService.getAllRatings(limit, offset);
            this.success(res, ratings);
        } catch (error) {
            console.error('Get all ratings error:', error);
            this.error(res, error.message);
        }
    }

}

module.exports = RatingController;
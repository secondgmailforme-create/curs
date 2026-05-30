const axios = require('axios');

class AIService {
    constructor(chatRepository = null, ticketRepository = null, notificationService = null, aiTrainingDataRepository = null) {
        // LM Studio для генерации
        this.aiUrl = process.env.AI_API_URL;
        this.modelName = process.env.AI_MODEL_NAME;
        
        // RuBERT для классификации
        this.classifierUrl = process.env.CLASSIFIER_URL;
        
        this.chatRepository = chatRepository;
        this.ticketRepository = ticketRepository;
        this.notificationService = notificationService;
        this.aiTrainingDataRepository = aiTrainingDataRepository;
    }

    // ---------------------------- КЛАССИФИКАЦИЯ ЧЕРЕЗ RuBERT -------------------------------
    async classifyCategory(text) {
        try {
            const response = await axios.post(`${this.classifierUrl}/classify`, {
                text: text
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const category = response.data.category || response.data.label || 'general';
            console.log('RuBERT classified category:', category);
            return category;
        } catch (error) {
            console.error('RuBERT classification error:', error.message);
            return 'general';
        }
    }

    // ---------------------------- ГЕНЕРАЦИЯ ОТВЕТА ЧЕРЕЗ LM STUDIO -------------------------------
    async generateResponse(userMessage, useQwen = false) {
        if (!this.aiUrl) {
            return {
                response: "Извините, AI сервис временно недоступен.",
                category: null,
                model_used: null
            };
        }
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post(`${this.aiUrl}/chat/completions`, {
                model: this.modelName,
                messages: [
                    {
                        role: "system",
                        content: "Ты - AI помощник службы поддержки. Отвечай кратко и по делу. Если не знаешь ответа, предложи связаться с оператором. Всегда отвечай на русском языке."
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.5,
                max_tokens: 500,
                stream: false
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const elapsed = Date.now() - startTime;
            
            let aiResponse = "";
            const choice = response.data.choices?.[0];
            
            if (choice) {
                aiResponse = choice.message?.content || choice.message?.reasoning_content || "";
                if (!aiResponse && choice.message?.reasoning_content) {
                    aiResponse = choice.message.reasoning_content;
                }
            }
            
            if (!aiResponse || aiResponse.trim() === '') {
                console.warn('Empty response from AI, using fallback');
                aiResponse = "Извините, я не смог обработать ваш запрос. Пожалуйста, переформулируйте вопрос или обратитесь к оператору.";
            }
            
            console.log('LM Studio response time:', elapsed, 'ms');
            
            const category = await this.classifyCategory(userMessage);
            
            return {
                response: aiResponse,
                category: category,
                generation_time: elapsed,
                model_used: this.modelName
            };
        } catch (error) {
            console.error('ai error:', error.message);
            if (error.response) {
                console.error('Error data:', error.response.data);
            }
            return {
                response: "Извините, сервис временно недоступен. Пожалуйста, попробуйте позже.",
                category: null,
                model_used: null
            };
        }
    }

    // ---------------------------- ГЕНЕРАЦИЯ ПРОГНОЗОВ ДЛЯ АДМИНА (LM Studio) -------------------------------
    async generateForecast(prompt) {
        if (!this.aiUrl) {
            const defaultResponse = {
                load_forecast: "средняя",
                peak_hours: ["10:00-12:00", "14:00-16:00"],
                recommendations: ["AI сервис не настроен"]
            };
            return {
                response: JSON.stringify(defaultResponse),
                category: "forecast",
                model_used: "mock",
                generation_time: 0
            };
        }
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post(`${this.aiUrl}/chat/completions`, {
                model: this.modelName,
                messages: [
                    {
                        role: "system",
                        content: "Ты - AI аналитик call-центра. Отвечай ТОЛЬКО в формате JSON, без лишнего текста и пояснений. Используй русский язык. Формат ответа: {\"load_forecast\": \"низкая/средняя/высокая\", \"peak_hours\": [\"часы\"], \"recommendations\": [\"рекомендации\"]}"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 300,
                stream: false
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const elapsed = Date.now() - startTime;
            
            let aiResponse = "";
            const choice = response.data.choices?.[0];
            
            if (choice) {
                aiResponse = choice.message?.content || choice.message?.reasoning_content || "";
            }
            
            console.log('ai forecast time:', elapsed, 'ms');
            
            if (!aiResponse || aiResponse.trim() === '') {
                const defaultResponse = {
                    load_forecast: "средняя",
                    peak_hours: ["10:00-12:00", "14:00-16:00"],
                    recommendations: ["AI не предоставил прогноз, используйте стандартные настройки"]
                };
                return {
                    response: JSON.stringify(defaultResponse),
                    category: "forecast",
                    model_used: this.modelName,
                    generation_time: elapsed
                };
            }
            
            return {
                response: aiResponse,
                category: "forecast",
                generation_time: elapsed,
                model_used: this.modelName
            };
        } catch (error) {
            console.error('ai forecast error:', error.message);
            const defaultResponse = {
                load_forecast: "средняя",
                peak_hours: ["10:00-12:00", "14:00-16:00"],
                recommendations: ["Ошибка при получении прогноза: " + error.message]
            };
            return {
                response: JSON.stringify(defaultResponse),
                category: "forecast",
                model_used: "fallback",
                generation_time: 0
            };
        }
    }

    // ---------------------------- ОПРЕДЕЛЕНИЕ КАТЕГОРИИ (через RuBERT) -------------------------------
    async detectCategory(text) {
        return await this.classifyCategory(text);
    }

    // ---------------------------- ОСТАЛЬНЫЕ МЕТОДЫ -------------------------------
    async sendMessageWithSave(ticketId, userMessage, hasImages = false) {
        
        if (!this.aiUrl) {
            const msg = 'Сейчас я свяжу вас с оператором поддержки. Пожалуйста, ожидайте.';
            if (this.chatRepository && ticketId) {
                await this.chatRepository.saveMessage(ticketId, 'ai', msg, []);
            }
            return { response: msg, ticket_id: ticketId, needs_operator: true, waiting_for_operator: true, timestamp: new Date().toISOString() };
        }
        
        try {
            const needsOperatorImmediate = this._checkNeedsOperator(userMessage, '', hasImages);
            
            if (needsOperatorImmediate) {
                const waitingMessage = hasImages
                    ? "Я вижу, вы прикрепили изображение. Сейчас я передам вашу заявку оператору для детального рассмотрения."
                    : "Сейчас я свяжу вас с оператором поддержки. Пожалуйста, ожидайте.";
                
                if (this.chatRepository && ticketId) {
                    await this.chatRepository.saveMessage(ticketId, 'ai', waitingMessage, []);
                }
                
                return {
                    response: waitingMessage,
                    ticket_id: ticketId,
                    needs_operator: true,
                    waiting_for_operator: true,
                    hasImages: hasImages,
                    timestamp: new Date().toISOString()
                };
            }

            const aiResult = await this.generateResponse(userMessage, false);
            const aiResponse = aiResult.response || aiResult;

            if (!aiResponse || aiResponse.trim() === '') {
                const fallback = "Я пока не могу ответить на этот вопрос. Хотите, я подключу оператора?";
                if (this.chatRepository && ticketId) {
                    await this.chatRepository.saveMessage(ticketId, 'ai', fallback, []);
                }
                return {
                    response: fallback,
                    ticket_id: ticketId,
                    needs_operator: false,
                    timestamp: new Date().toISOString()
                };
            }

        
            if (this.aiTrainingDataRepository && ticketId) {
                try {
                    let categoryId = null;
                    if (aiResult.category) {
                        if (this.ticketRepository && this.ticketRepository.pool) {
                            const categoryResult = await this.ticketRepository.pool.query(
                                'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
                                [aiResult.category]
                            );
                            if (categoryResult.rows[0]) {
                                categoryId = categoryResult.rows[0].id;
                            }
                        }
                    }
                    
                    await this.aiTrainingDataRepository.create({
                        ticket_id: ticketId,
                        input_text: userMessage,
                        output_text: aiResponse,
                        category_id: categoryId,
                        model_used: aiResult.model_used,
                        generation_time: aiResult.generation_time
                    });
                    console.log('Saved to AI training data');
                } catch (trainError) {
                    console.error('Failed to save AI training data:', trainError);
                }
            }

            const needsOperatorAfterAI = this._checkNeedsOperator(userMessage, aiResponse, hasImages);

            if (this.chatRepository && ticketId) {
                await this.chatRepository.saveMessage(ticketId, 'ai', aiResponse, []);
            }

            return {
                response: aiResponse,
                ticket_id: ticketId,
                needs_operator: needsOperatorAfterAI,
                transferred_to_operator: false,
                waiting_for_operator: false,
                hasImages: hasImages,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('AI Service Error:', error);
            const errorMessage = "Извините, произошла ошибка. Попробуйте позже.";
            
            if (this.chatRepository && ticketId) {
                await this.chatRepository.saveMessage(ticketId, 'ai', errorMessage, []);
            }
            
            return {
                response: errorMessage,
                ticket_id: ticketId,
                error: true,
                needs_operator: false
            };
        }
    }

    _checkNeedsOperator(userMessage, aiResponse, hasImages = false) {
        const operatorKeywords = [
            'соедините с оператором', 'переключите на оператора', 'живой сотрудник',
            'специалист', 'поддержка', 'хочу поговорить с человеком', 'позовите оператора',
            'передайте оператору', 'человека', 'живого человека', 'помогите',
            'не работает', 'сломалась', 'ошибка', 'проблема', 'срочно', 'жалоба'
        ];

        const lowerMessage = (userMessage || '').toLowerCase().trim();
        const lowerResponse = (aiResponse || '').toLowerCase().trim();

        const foundInMessage = operatorKeywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );
        
        if (foundInMessage) return true;
        if (hasImages) return true;
        
        if (lowerResponse) {
            return operatorKeywords.some(keyword => 
                lowerResponse.includes(keyword.toLowerCase())
            );
        }
        
        return false;
    }

    async getAIResponse(text) {
        const result = await this.generateResponse(text);
        return result.response;
    }

    async analyzeSentiment(text) {
        return 'neutral';
    }
}

module.exports = AIService;
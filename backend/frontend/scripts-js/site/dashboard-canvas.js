const canvas = document.getElementById('Canvas');
        const ctx = canvas.getContext('2d');

        let width, height;
        let particles = [];
        
        // Настройки
        const PARTICLE_COUNT = 130; // Количество точек
        const CONNECT_DISTANCE = 150; // Дистанция соединения линий
        const MOUSE_CONNECT_DISTANCE = 250; // Дистанция связи с мышью
        
        // Цвета (RGB)
        const COLOR_BASE = '188, 19, 254'; // Яркий неон (маджента)
        const COLOR_SECONDARY = '0, 212, 255'; // Голубой акцент

        let mouse = { x: null, y: null };

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        }

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 1; // Медленное движение
                this.vy = (Math.random() - 0.5) * 1;
                this.size = Math.random() * 2 + 1;
                // Случайный выбор цвета точки
                this.colorType = Math.random() > 0.8 ? 'secondary' : 'base';
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Отскок от краев
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Взаимодействие с мышью (легкое притяжение/отталкивание)
                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 200) {
                        const force = (200 - distance) / 200;
                        const directionX = dx / distance;
                        const directionY = dy / distance;
                        
                        // Легкое притяжение к курсору
                        this.x += directionX * force * 0.5;
                        this.y += directionY * force * 0.5;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                
                if (this.colorType === 'secondary') {
                    ctx.fillStyle = `rgb(${COLOR_SECONDARY})`;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = `rgb(${COLOR_SECONDARY})`;
                } else {
                    ctx.fillStyle = `rgb(${COLOR_BASE})`;
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = `rgb(${COLOR_BASE})`;
                }
                
                ctx.fill();
                ctx.shadowBlur = 0; // Сброс тени
            }
        }

        function init() {
            resize();
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new Particle());
            }
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                // Соединение с другими точками
                for (let j = i; j < particles.length; j++) {
                    let dx = particles[i].x - particles[j].x;
                    let dy = particles[i].y - particles[j].y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < CONNECT_DISTANCE) {
                        ctx.beginPath();
                        let opacity = 1 - (distance / CONNECT_DISTANCE);
                        ctx.strokeStyle = `rgba(${COLOR_BASE}, ${opacity})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }

                // Соединение с мышью
                if (mouse.x != null) {
                    let dx = particles[i].x - mouse.x;
                    let dy = particles[i].y - mouse.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < MOUSE_CONNECT_DISTANCE) {
                        ctx.beginPath();
                        let opacity = 1 - (distance / MOUSE_CONNECT_DISTANCE);
                        // Линии к мыши делаем поярче и другого цвета
                        ctx.strokeStyle = `rgba(${COLOR_SECONDARY}, ${opacity * 0.8})`;
                        ctx.lineWidth = 1.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });

        window.addEventListener('mouseout', () => {
            mouse.x = null;
            mouse.y = null;
        });

        window.addEventListener('resize', () => {
            resize();
            init();
        });

        init();
        animate();
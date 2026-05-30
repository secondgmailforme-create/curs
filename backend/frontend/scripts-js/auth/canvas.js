
const canvas = document.getElementById('dataCanvas');
const ctx = canvas.getContext('2d');

// Растягиваем канвас на весь экран сразу
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const imgLaptop = new Image();
imgLaptop.src = '/files/laptop.png'; 
const imgPhone = new Image();
imgPhone.src = '/files/mobile.png'; 
let items = []; 
let mouseX = 0;
let mouseY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
function createItem(imageSource){
    return{
        img: imageSource,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speedX: (Math.random() - 0.5) * 2,
        speedY: Math.random() * 2 + 1,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
        size: Math.random() * 40 + 20
    };
}
Promise.all([
    new Promise(r => imgPhone.onload = r),
    new Promise(r => imgLaptop.onload = r)
]).then(() => {
    for(let i=0; i<15; i++) items.push(createItem(imgPhone));
    for(let i=0; i<10; i++) items.push(createItem(imgLaptop));
    animate();
});
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    items.forEach(item => {
        const dx = item.x - mouseX;
        const dy = item.y - mouseY;
        const distance = Math.sqrt(dx*dx + dy*dy)
        if(distance < 150){
            const force = (150 - distance) / 150;
            const angle = Math.atan2(dy,dx);
            item.speedX += Math.cos(angle) * force * 0.5;
            item.speedX += Math.sin(angle) * force * 0.5;
        }
        item.x += item.speedX;
        item.y += item.speedY;
        item.angle += item.spin;

        // Логика возврата (если улетел вниз)
        if (item.y > canvas.height + 50) {
            item.y = -50;
            item.x = Math.random() * canvas.width;
            item.speedX = (Math.random() - 0.5) * 2; // Сброс скорости по X
            item.speedY = Math.random() * 2 + 1; 
        }
        // Логика возврата по бокам
        if (item.x > canvas.width + 50) item.x = -50;
        if (item.x < -50) item.x = canvas.width + 50;

        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);

        
        // Рисуем картинку (центрируем её)
        ctx.drawImage(item.img, -25, -25, 65, 65); 
        
        ctx.restore();
    });

    requestAnimationFrame(animate);
}

// Обработка изменения размера окна (чтобы не ломалось при растягивании браузера)
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
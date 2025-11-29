// ============================================
// GAME CONFIGURATION
// ============================================
const CONFIG = {
    canvas: {
        width: 800,
        height: 400
    },
    player: {
        size: 30,
        x: 150,
        speed: 0,
        maxSpeed: 8,
        gravity: 0.5,
        color: '#a78bfa',
        glowColor: 'rgba(167, 139, 250, 0.6)'
    },
    obstacle: {
        width: 40,
        minGap: 200,
        maxGap: 350,
        speed: 5,
        speedIncrease: 0.0005,
        color: '#ec4899',
        glowColor: 'rgba(236, 72, 153, 0.6)'
    },
    game: {
        groundHeight: 50,
        scoreMultiplier: 1
    }
};

// ============================================
// GAME STATE
// ============================================
const gameState = {
    isRunning: false,
    isPaused: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('gravityRunnerHighScore')) || 0,
    frame: 0
};

// ============================================
// DOM ELEMENTS
// ============================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameHint = document.getElementById('gameHint');
const currentScoreEl = document.getElementById('currentScore');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const newHighScoreEl = document.getElementById('newHighScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// ============================================
// RESPONSIVE CANVAS SIZING
// ============================================
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(window.innerWidth - 20, CONFIG.canvas.width);
    const maxHeight = Math.min(window.innerHeight * 0.7, CONFIG.canvas.height);

    // Maintain aspect ratio
    const aspectRatio = CONFIG.canvas.width / CONFIG.canvas.height;
    let newWidth = maxWidth;
    let newHeight = newWidth / aspectRatio;

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
    }

    canvas.width = CONFIG.canvas.width;
    canvas.height = CONFIG.canvas.height;
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
}

// Initial resize
resizeCanvas();

// Resize on window resize
window.addEventListener('resize', resizeCanvas);

// Display initial high score
highScoreEl.textContent = gameState.highScore;

// ============================================
// PLAYER CLASS
// ============================================
class Player {
    constructor() {
        this.width = CONFIG.player.size;
        this.height = CONFIG.player.size;
        this.x = CONFIG.player.x;
        this.y = CONFIG.game.groundHeight;
        this.velocityY = 0;
        this.gravity = CONFIG.player.gravity;
        this.isOnGround = true;
        this.rotation = 0;
    }

    flipGravity() {
        this.gravity *= -1;
        this.velocityY = 0; // Reset velocity for smooth transition

        // Create particle effect
        createParticles(this.x + this.width / 2, this.y + this.height / 2);

        // Hide hint after first flip
        if (!gameHint.classList.contains('hidden')) {
            gameHint.classList.add('hidden');
        }
    }

    update() {
        // Apply gravity
        this.velocityY += this.gravity;

        // Limit fall speed
        if (Math.abs(this.velocityY) > CONFIG.player.maxSpeed) {
            this.velocityY = Math.sign(this.velocityY) * CONFIG.player.maxSpeed;
        }

        this.y += this.velocityY;

        // Ground collision (bottom)
        if (this.gravity > 0 && this.y >= canvas.height - CONFIG.game.groundHeight - this.height) {
            this.y = canvas.height - CONFIG.game.groundHeight - this.height;
            this.velocityY = 0;
            this.isOnGround = true;
        }

        // Ceiling collision (top)
        if (this.gravity < 0 && this.y <= CONFIG.game.groundHeight) {
            this.y = CONFIG.game.groundHeight;
            this.velocityY = 0;
            this.isOnGround = true;
        }

        // Update rotation for visual effect
        this.rotation = this.gravity > 0 ? 0 : Math.PI;
    }

    draw() {
        ctx.save();

        // Translate to player center
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        // Draw glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = CONFIG.player.glowColor;

        // Draw player
        ctx.fillStyle = CONFIG.player.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Draw eyes based on gravity
        ctx.fillStyle = '#1e1b4b';
        const eyeSize = 6;
        const eyeOffset = 8;
        const eyeY = this.gravity > 0 ? -8 : 8;

        ctx.fillRect(-eyeOffset, eyeY - eyeSize / 2, eyeSize, eyeSize);
        ctx.fillRect(eyeOffset - eyeSize, eyeY - eyeSize / 2, eyeSize, eyeSize);

        ctx.restore();
    }

    reset() {
        this.y = CONFIG.game.groundHeight;
        this.velocityY = 0;
        this.gravity = CONFIG.player.gravity;
        this.rotation = 0;
    }
}

// ============================================
// OBSTACLE CLASS
// ============================================
class Obstacle {
    constructor(x, isTop) {
        this.width = CONFIG.obstacle.width;
        this.height = Math.random() * 100 + 100; // Random height between 100-200
        this.x = x;
        this.isTop = isTop;
        this.y = isTop ? CONFIG.game.groundHeight : canvas.height - CONFIG.game.groundHeight - this.height;
        this.speed = CONFIG.obstacle.speed;
    }

    update() {
        this.x -= this.speed;
        // Gradually increase difficulty
        this.speed += CONFIG.obstacle.speedIncrease;
    }

    draw() {
        ctx.save();

        // Draw glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.obstacle.glowColor;

        // Draw obstacle
        ctx.fillStyle = CONFIG.obstacle.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw edge highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }

    collidesWith(player) {
        return (
            player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y
        );
    }
}

// ============================================
// PARTICLE SYSTEM
// ============================================
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1;
        this.decay = 0.02;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#a78bfa';
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.player.glowColor;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// ============================================
// GAME OBJECTS
// ============================================
const player = new Player();
const obstacles = [];
const particles = [];
let lastObstacleFrame = 0;

// ============================================
// PARTICLE CREATION
// ============================================
function createParticles(x, y) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y));
    }
}

// ============================================
// OBSTACLE GENERATION
// ============================================
function generateObstacle() {
    const gap = Math.random() * (CONFIG.obstacle.maxGap - CONFIG.obstacle.minGap) + CONFIG.obstacle.minGap;

    if (gameState.frame - lastObstacleFrame > gap / CONFIG.obstacle.speed) {
        const isTop = Math.random() > 0.5;
        obstacles.push(new Obstacle(canvas.width, isTop));
        lastObstacleFrame = gameState.frame;
    }
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkCollisions() {
    for (let obstacle of obstacles) {
        if (obstacle.collidesWith(player)) {
            gameOver();
            return;
        }
    }
}

// ============================================
// DRAWING FUNCTIONS
// ============================================
function drawBackground() {
    // Clear canvas
    ctx.fillStyle = '#1a1625';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.1)';
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawGround() {
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.game.groundHeight);
    gradient.addColorStop(0, 'rgba(236, 72, 153, 0.3)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

    // Bottom ground
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - CONFIG.game.groundHeight, canvas.width, CONFIG.game.groundHeight);

    // Top ground (ceiling)
    ctx.fillRect(0, 0, canvas.width, CONFIG.game.groundHeight);

    // Draw lines
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - CONFIG.game.groundHeight);
    ctx.lineTo(canvas.width, canvas.height - CONFIG.game.groundHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, CONFIG.game.groundHeight);
    ctx.lineTo(canvas.width, CONFIG.game.groundHeight);
    ctx.stroke();
}

// ============================================
// UPDATE FUNCTIONS
// ============================================
function updateScore() {
    gameState.score += CONFIG.game.scoreMultiplier;
    currentScoreEl.textContent = Math.floor(gameState.score);
}

function updateObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();

        if (obstacles[i].isOffScreen()) {
            obstacles.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();

        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    if (!gameState.isRunning) return;

    // Clear and draw background
    drawBackground();
    drawGround();

    // Update
    player.update();
    updateObstacles();
    updateParticles();
    generateObstacle();
    updateScore();
    checkCollisions();

    // Draw
    obstacles.forEach(obstacle => obstacle.draw());
    particles.forEach(particle => particle.draw());
    player.draw();

    gameState.frame++;
    requestAnimationFrame(gameLoop);
}

// ============================================
// GAME CONTROL
// ============================================
function startGame() {
    // Hide start screen
    startScreen.classList.add('hidden');
    gameHint.classList.remove('hidden');

    // Reset game state
    gameState.isRunning = true;
    gameState.score = 0;
    gameState.frame = 0;
    obstacles.length = 0;
    particles.length = 0;
    lastObstacleFrame = 0;

    // Reset player
    player.reset();

    // Start game loop
    gameLoop();
}

function gameOver() {
    gameState.isRunning = false;

    // Update high score
    const finalScore = Math.floor(gameState.score);
    finalScoreEl.textContent = finalScore;

    if (finalScore > gameState.highScore) {
        gameState.highScore = finalScore;
        localStorage.setItem('gravityRunnerHighScore', finalScore);
        highScoreEl.textContent = finalScore;
        newHighScoreEl.classList.add('show');
    } else {
        newHighScoreEl.classList.remove('show');
    }

    // Show game over screen
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    gameOverScreen.classList.add('hidden');
    startGame();
}

// ============================================
// EVENT LISTENERS
// ============================================
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

// Gravity flip controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState.isRunning) {
        e.preventDefault();
        player.flipGravity();
    }
});

canvas.addEventListener('click', () => {
    if (gameState.isRunning) {
        player.flipGravity();
    }
});

// Prevent context menu on right click
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ============================================
// INITIALIZE
// ============================================
console.log('🎮 Gravity Runner initialized!');
console.log('Press SPACE or CLICK to flip gravity');

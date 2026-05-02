// ============================================================
// SAGUI STUDIO - Platform Game Engine
// Identidade visual: azul marinho + rosa + creme + amarelo
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 3200;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const MOVE_SPEED = 3.5;
const RUN_SPEED = 6;
const FRICTION = 0.82;

// PALETA SAGUI STUDIO
const COLORS = {
    navy: '#102050',
    navyDeep: '#0a1638',
    navyLight: '#1a2f6b',
    pink: '#e03080',
    pinkLight: '#f04e94',
    pinkDeep: '#b01e60',
    cream: '#e8dcc0',
    creamSoft: '#f4ecd8',
    yellow: '#f5b82e',
    yellowLight: '#ffcd4d'
};

// ============================================================
// ASSETS
// ============================================================
const assets = {
    sagui: null,
    sol: null,
    arvoreRosa: null,
    arvoreAzul: null,
    loaded: 0,
    total: 4
};

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function loadAssets() {
    const [sagui, sol, arvoreRosa, arvoreAzul] = await Promise.all([
        loadImage('assets/sagui.png'),
        loadImage('assets/sol.png'),
        loadImage('assets/arvore_rosa.png'),
        loadImage('assets/arvore_azul.png')
    ]);
    assets.sagui = sagui;
    assets.sol = sol;
    assets.arvoreRosa = arvoreRosa;
    assets.arvoreAzul = arvoreAzul;
    assets.loaded = 4;
}

// ============================================================
// INPUT
// ============================================================
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ============================================================
// GAME STATE
// ============================================================
const game = {
    state: 'start',
    coins: 0,
    lives: 3,
    camera: { x: 0, y: 0 },
    particles: [],
    time: 0
};

// ============================================================
// PLAYER
// ============================================================
// Dimensões do SPRITE vs HITBOX
// O sprite tem cauda pra esquerda e cabeça grande — o hitbox é apenas o CORPO central
const PLAYER_SPRITE_W = 72;   // largura do sprite renderizado
const PLAYER_SPRITE_H = 72;   // altura
const PLAYER_HITBOX_W = 32;   // hitbox menor (só o corpo)
const PLAYER_HITBOX_H = 52;   // hitbox altura

const player = {
    x: 80,
    y: 300,
    w: PLAYER_HITBOX_W,
    h: PLAYER_HITBOX_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    invulnerable: 0,
    
    reset() {
        this.x = 80;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.invulnerable = 0;
    },
    
    update() {
        const running = keys['ShiftLeft'] || keys['ShiftRight'];
        const speed = running ? RUN_SPEED : MOVE_SPEED;
        
        if (keys['ArrowLeft']) {
            this.vx = -speed;
            this.facing = -1;
        } else if (keys['ArrowRight']) {
            this.vx = speed;
            this.facing = 1;
        } else {
            this.vx *= FRICTION;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }
        
        if ((keys['Space'] || keys['ArrowUp']) && this.onGround) {
            this.vy = JUMP_FORCE;
            this.onGround = false;
            spawnParticles(this.x + this.w/2, this.y + this.h, 6, COLORS.cream);
        }
        
        this.vy += GRAVITY;
        if (this.vy > 15) this.vy = 15;
        
        this.x += this.vx;
        this.handleCollisions('x');
        this.y += this.vy;
        this.onGround = false;
        this.handleCollisions('y');
        
        if (this.x < 0) this.x = 0;
        if (this.x + this.w > WORLD_WIDTH) this.x = WORLD_WIDTH - this.w;
        
        if (this.y > canvas.height + 100) {
            this.die();
        }
        
        if (this.invulnerable > 0) this.invulnerable--;
    },
    
    handleCollisions(axis) {
        for (const p of platforms) {
            if (this.x < p.x + p.w &&
                this.x + this.w > p.x &&
                this.y < p.y + p.h &&
                this.y + this.h > p.y) {
                
                if (axis === 'x') {
                    if (this.vx > 0) this.x = p.x - this.w;
                    else if (this.vx < 0) this.x = p.x + p.w;
                    this.vx = 0;
                } else {
                    if (this.vy > 0) {
                        this.y = p.y - this.h;
                        this.vy = 0;
                        this.onGround = true;
                    } else if (this.vy < 0) {
                        this.y = p.y + p.h;
                        this.vy = 0;
                    }
                }
            }
        }
    },
    
    die() {
        game.lives--;
        spawnParticles(this.x + this.w/2, this.y + this.h/2, 20, COLORS.pink);
        if (game.lives <= 0) {
            game.state = 'gameover';
            showGameOver();
        } else {
            this.reset();
        }
        updateHUD();
    },
    
    draw() {
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 4) % 2) {
            return;
        }
        
        const screenX = Math.floor(this.x - game.camera.x);
        const screenY = Math.floor(this.y - game.camera.y);
        
        // Sombra
        ctx.fillStyle = 'rgba(10, 22, 56, 0.35)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.w/2, screenY + this.h + 2, 14, 4, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Bob sutil quando parado
        const bob = this.onGround && Math.abs(this.vx) < 0.5 
            ? Math.sin(game.time * 0.06) * 1 
            : 0;
        
        ctx.save();
        
        if (this.facing === -1) {
            ctx.translate(screenX + this.w, screenY + bob);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(screenX, screenY + bob);
        }
        
        // Renderiza o sprite do sagui — MAIOR que o hitbox
        if (assets.sagui) {
            // Centraliza sprite em cima do hitbox
            const offsetX = (this.w - PLAYER_SPRITE_W) / 2;
            // Alinha pé do sprite com pé do hitbox
            const offsetY = this.h - PLAYER_SPRITE_H + 6;
            ctx.drawImage(assets.sagui, offsetX, offsetY, PLAYER_SPRITE_W, PLAYER_SPRITE_H);
        }
        
        ctx.restore();
    }
};

// ============================================================
// PLATAFORMAS
// ============================================================
const platforms = [
    { x: 0, y: 500, w: 600, h: 40, type: 'ground' },
    { x: 280, y: 400, w: 100, h: 20, type: 'brick' },
    { x: 450, y: 340, w: 80, h: 20, type: 'brick' },
    
    { x: 700, y: 500, w: 300, h: 40, type: 'ground' },
    { x: 780, y: 380, w: 60, h: 20, type: 'brick' },
    { x: 900, y: 300, w: 60, h: 20, type: 'brick' },
    
    { x: 1100, y: 500, w: 180, h: 40, type: 'ground' },
    { x: 1200, y: 420, w: 80, h: 20, type: 'brick' },
    { x: 1320, y: 360, w: 80, h: 20, type: 'brick' },
    { x: 1440, y: 300, w: 80, h: 20, type: 'brick' },
    { x: 1560, y: 240, w: 80, h: 20, type: 'brick' },
    
    { x: 1700, y: 500, w: 400, h: 40, type: 'ground' },
    { x: 1750, y: 380, w: 60, h: 20, type: 'brick' },
    { x: 1870, y: 320, w: 60, h: 20, type: 'brick' },
    { x: 1990, y: 380, w: 60, h: 20, type: 'brick' },
    
    { x: 2200, y: 500, w: 200, h: 40, type: 'ground' },
    { x: 2250, y: 400, w: 100, h: 20, type: 'brick' },
    { x: 2420, y: 340, w: 80, h: 20, type: 'brick' },
    { x: 2560, y: 280, w: 80, h: 20, type: 'brick' },
    
    { x: 2700, y: 500, w: 500, h: 40, type: 'ground' },
    { x: 2850, y: 400, w: 200, h: 20, type: 'brick' },
    { x: 2900, y: 300, w: 100, h: 20, type: 'brick' },
];

function drawPlatform(p) {
    const x = p.x - game.camera.x;
    const y = p.y - game.camera.y;
    
    if (x + p.w < 0 || x > canvas.width) return;
    
    if (p.type === 'ground') {
        // Borda superior rosa (grama estilizada)
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(x, y, p.w, 8);
        
        // Detalhes da "grama" (tufos rosa claro)
        ctx.fillStyle = COLORS.pinkLight;
        for (let i = 4; i < p.w; i += 12) {
            ctx.fillRect(x + i, y + 1, 3, 3);
            ctx.fillRect(x + i + 5, y + 3, 2, 2);
        }
        
        // Corpo azul
        ctx.fillStyle = COLORS.navy;
        ctx.fillRect(x, y + 8, p.w, p.h - 8);
        
        // Linha de separação creme
        ctx.fillStyle = COLORS.cream;
        ctx.fillRect(x, y + 8, p.w, 2);
        
        // Detalhes creme na terra (padrão)
        ctx.fillStyle = COLORS.navyLight;
        for (let i = 0; i < p.w; i += 24) {
            for (let j = 14; j < p.h; j += 12) {
                ctx.fillRect(x + i + (j % 24 === 14 ? 6 : 0), y + j, 4, 2);
            }
        }
        
        // Pontinhos amarelos ocasionais (decorativo)
        ctx.fillStyle = COLORS.yellow;
        for (let i = 16; i < p.w; i += 80) {
            ctx.fillRect(x + i, y + 20, 2, 2);
        }
        
        // Borda inferior escura
        ctx.fillStyle = COLORS.navyDeep;
        ctx.fillRect(x, y + p.h - 3, p.w, 3);
    } else {
        // Plataforma tijolo — bloco rosa com borda escura
        ctx.fillStyle = COLORS.navyDeep;
        ctx.fillRect(x, y, p.w, p.h);
        
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(x + 2, y + 2, p.w - 4, p.h - 4);
        
        // Highlight no topo
        ctx.fillStyle = COLORS.pinkLight;
        ctx.fillRect(x + 2, y + 2, p.w - 4, 2);
        
        // Detalhe creme no meio
        ctx.fillStyle = COLORS.cream;
        for (let i = 6; i < p.w - 6; i += 12) {
            ctx.fillRect(x + i, y + p.h/2 - 1, 4, 2);
        }
    }
}

// ============================================================
// MOEDAS
// ============================================================
const coins = [
    { x: 150, y: 450, collected: false },
    { x: 200, y: 450, collected: false },
    { x: 250, y: 450, collected: false },
    { x: 315, y: 360, collected: false },
    { x: 480, y: 300, collected: false },
    { x: 550, y: 450, collected: false },
    { x: 600, y: 420, collected: false },
    { x: 650, y: 380, collected: false },
    { x: 800, y: 340, collected: false },
    { x: 920, y: 260, collected: false },
    { x: 1230, y: 380, collected: false },
    { x: 1350, y: 320, collected: false },
    { x: 1470, y: 260, collected: false },
    { x: 1590, y: 200, collected: false },
    { x: 1770, y: 340, collected: false },
    { x: 1890, y: 280, collected: false },
    { x: 2010, y: 340, collected: false },
    { x: 2280, y: 360, collected: false },
    { x: 2450, y: 300, collected: false },
    { x: 2590, y: 240, collected: false },
    { x: 2900, y: 360, collected: false },
    { x: 2950, y: 260, collected: false },
    { x: 3000, y: 260, collected: false },
];

function drawCoin(coin) {
    if (coin.collected) return;
    const x = coin.x - game.camera.x;
    const y = coin.y - game.camera.y;
    if (x + 20 < 0 || x > canvas.width) return;
    
    const spin = Math.sin(game.time * 0.1 + coin.x * 0.01);
    const width = Math.abs(spin) * 14 + 2;
    const bob = Math.sin(game.time * 0.05 + coin.x * 0.02) * 3;
    
    // Glow amarelo ao redor
    const glow = ctx.createRadialGradient(x + 8, y + 8 + bob, 2, x + 8, y + 8 + bob, 18);
    glow.addColorStop(0, 'rgba(245, 184, 46, 0.5)');
    glow.addColorStop(1, 'rgba(245, 184, 46, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 10 + bob, 36, 36);
    
    // Borda escura
    ctx.fillStyle = COLORS.navyDeep;
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 8 + bob, width/2 + 1, 8, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Corpo da moeda (amarelo)
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 8 + bob, width/2, 6.5, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Interior mais claro (rosa se virar de lado mais fino, senão amarelo claro)
    if (spin > 0.3) {
        ctx.fillStyle = COLORS.yellowLight;
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 8 + bob, width/2 - 2, 4.5, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Pontinho rosa no centro (referência à marca)
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(x + 7, y + 7 + bob, 2, 2);
    }
}

function checkCoinCollection() {
    for (const coin of coins) {
        if (coin.collected) continue;
        if (player.x < coin.x + 16 &&
            player.x + player.w > coin.x &&
            player.y < coin.y + 16 &&
            player.y + player.h > coin.y) {
            coin.collected = true;
            game.coins++;
            spawnParticles(coin.x + 8, coin.y + 8, 10, COLORS.yellow);
            spawnParticles(coin.x + 8, coin.y + 8, 4, COLORS.pink);
            updateHUD();
            
            if (coins.every(c => c.collected)) {
                game.state = 'win';
                showWinScreen();
            }
        }
    }
}

// ============================================================
// INIMIGOS
// ============================================================
const enemies = [
    { x: 800, y: 472, w: 28, h: 28, vx: -1, minX: 720, maxX: 980, alive: true },
    { x: 1200, y: 472, w: 28, h: 28, vx: 1, minX: 1120, maxX: 1260, alive: true },
    { x: 1800, y: 472, w: 28, h: 28, vx: -1, minX: 1720, maxX: 2080, alive: true },
    { x: 2800, y: 472, w: 28, h: 28, vx: 1, minX: 2720, maxX: 3180, alive: true },
];

function updateEnemies() {
    for (const e of enemies) {
        if (!e.alive) continue;
        e.x += e.vx;
        if (e.x <= e.minX || e.x + e.w >= e.maxX) {
            e.vx *= -1;
        }
        
        if (player.invulnerable === 0 &&
            player.x < e.x + e.w &&
            player.x + player.w > e.x &&
            player.y < e.y + e.h &&
            player.y + player.h > e.y) {
            
            if (player.vy > 0 && player.y + player.h < e.y + e.h/2 + 8) {
                e.alive = false;
                player.vy = JUMP_FORCE * 0.7;
                spawnParticles(e.x + e.w/2, e.y + e.h/2, 12, COLORS.pink);
                spawnParticles(e.x + e.w/2, e.y + e.h/2, 6, COLORS.yellow);
            } else {
                player.invulnerable = 60;
                player.vx = -player.facing * 5;
                player.vy = -6;
                game.lives--;
                if (game.lives <= 0) {
                    game.state = 'gameover';
                    showGameOver();
                }
                updateHUD();
            }
        }
    }
}

function drawEnemy(e) {
    if (!e.alive) return;
    const x = e.x - game.camera.x;
    const y = e.y - game.camera.y;
    if (x + e.w < 0 || x > canvas.width) return;
    
    const wobble = Math.sin(game.time * 0.1) * 1;
    
    // Sombra
    ctx.fillStyle = 'rgba(10, 22, 56, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + e.w/2, y + e.h + 2, 12, 3, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Corpo rosa com borda azul marinho (estilo do branding)
    ctx.fillStyle = COLORS.navyDeep;
    ctx.fillRect(x, y + 2 + wobble, e.w, e.h - 2);
    
    ctx.fillStyle = COLORS.pink;
    ctx.fillRect(x + 3, y + 4 + wobble, e.w - 6, e.h - 6);
    
    // Highlight top
    ctx.fillStyle = COLORS.pinkLight;
    ctx.fillRect(x + 3, y + 4 + wobble, e.w - 6, 3);
    
    // Olhos cream com pupila azul marinho
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(x + 6, y + 10 + wobble, 6, 7);
    ctx.fillRect(x + 16, y + 10 + wobble, 6, 7);
    
    ctx.fillStyle = COLORS.navyDeep;
    const eyeOffset = e.vx > 0 ? 2 : 0;
    ctx.fillRect(x + 7 + eyeOffset, y + 12 + wobble, 3, 4);
    ctx.fillRect(x + 17 + eyeOffset, y + 12 + wobble, 3, 4);
    
    // Boquinha
    ctx.fillStyle = COLORS.navyDeep;
    ctx.fillRect(x + 10, y + 21 + wobble, 8, 2);
    
    // Pés (animados)
    const footAnim = Math.floor(game.time / 8) % 2;
    ctx.fillStyle = COLORS.navyDeep;
    ctx.fillRect(x + 2, y + e.h - 3, 8, 3);
    ctx.fillRect(x + e.w - 10, y + e.h - 3 + (footAnim ? 0 : -1), 8, 3);
}

// ============================================================
// PARTÍCULAS
// ============================================================
function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of game.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - game.camera.x, p.y - game.camera.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

// ============================================================
// CENÁRIO PARALLAX — com as árvores como DECORAÇÃO (sem colisão)
// ============================================================

// Nuvens decorativas (formas simples, com a estética do branding)
const clouds = [];
for (let i = 0; i < 12; i++) {
    clouds.push({
        x: Math.random() * WORLD_WIDTH,
        y: 50 + Math.random() * 140,
        size: 0.7 + Math.random() * 0.6,
        type: Math.random() > 0.5 ? 'puff' : 'wave'
    });
}

// Montanhas ao fundo
const mountains = [];
for (let i = 0; i < 8; i++) {
    mountains.push({
        x: i * 480 + Math.random() * 100,
        height: 160 + Math.random() * 80,
        width: 280 + Math.random() * 180
    });
}

// Árvores DE FUNDO (decoração, não colidem com player)
// Distribuídas ao longo do mundo, intercalando rosa e azul
const bgTrees = [
    // Rosa = fica em camada intermediária
    // Azul = fica em camada próxima (maior, na frente)
    { x: 120, y: 380, type: 'rosa', scale: 1.1, layer: 'mid' },
    { x: 550, y: 360, type: 'rosa', scale: 0.9, layer: 'mid' },
    { x: 1050, y: 380, type: 'rosa', scale: 1.2, layer: 'mid' },
    { x: 1650, y: 370, type: 'rosa', scale: 1.0, layer: 'mid' },
    { x: 2150, y: 380, type: 'rosa', scale: 1.1, layer: 'mid' },
    { x: 2650, y: 360, type: 'rosa', scale: 0.95, layer: 'mid' },
    
    // Árvores azuis (mais próximas, camada front)
    { x: 350, y: 430, type: 'azul', scale: 0.85, layer: 'front' },
    { x: 850, y: 440, type: 'azul', scale: 0.75, layer: 'front' },
    { x: 1400, y: 430, type: 'azul', scale: 0.9, layer: 'front' },
    { x: 1950, y: 440, type: 'azul', scale: 0.8, layer: 'front' },
    { x: 2450, y: 430, type: 'azul', scale: 0.9, layer: 'front' },
    { x: 3050, y: 440, type: 'azul', scale: 0.85, layer: 'front' },
];

// Arbustos / tufos de grama estilizados (camada mais próxima)
const bushes = [];
for (let i = 0; i < 30; i++) {
    bushes.push({
        x: i * 120 + Math.random() * 60,
        y: 476 + Math.random() * 8,
        size: 16 + Math.random() * 10,
        color: Math.random() > 0.5 ? COLORS.pink : COLORS.pinkDeep
    });
}

// Pattern de pontos decorativos (estrelas / sparkles)
const stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * WORLD_WIDTH,
        y: 20 + Math.random() * 200,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2
    });
}

function drawBackground() {
    // CAMADA 1 — Céu (gradiente creme / rosa pálido)
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, COLORS.cream);
    sky.addColorStop(0.5, COLORS.creamSoft);
    sky.addColorStop(1, '#f9e8d0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // "Estrelinhas" / sparkles decorativos (parallax bem lento)
    for (const s of stars) {
        const sx = s.x - game.camera.x * 0.1;
        const wrapped = ((sx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
        if (wrapped > canvas.width + 50) continue;
        const alpha = 0.3 + Math.sin(game.time * 0.05 + s.twinkle) * 0.2;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = COLORS.pink;
        ctx.fillRect(wrapped, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    
    // SOL — usando sagui_forma_8 como asset
    if (assets.sol) {
        const sunX = 750 - game.camera.x * 0.08;
        const sunY = 90;
        const sunSize = 110;
        // Leve rotação suave
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(Math.sin(game.time * 0.01) * 0.05);
        ctx.drawImage(assets.sol, -sunSize/2, -sunSize/2, sunSize, sunSize);
        ctx.restore();
    }
    
    // CAMADA 2 — Linhas de onda decorativas (estilo do branding, bem distantes)
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.35;
    const waveOffsetX = -game.camera.x * 0.1;
    for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        for (let i = 0; i < canvas.width + 40; i += 4) {
            const wx = i;
            const wy = 50 + w * 18 + Math.sin((i + waveOffsetX) * 0.02 + w) * 6;
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    
    // CAMADA 3 — Montanhas (azul marinho, parallax lento)
    for (const m of mountains) {
        const x = m.x - game.camera.x * 0.25;
        if (x + m.width < -50 || x > canvas.width + 50) continue;
        
        // Sombra/silhueta
        ctx.fillStyle = COLORS.navyLight;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x + m.width/2, canvas.height - m.height);
        ctx.lineTo(x + m.width, canvas.height);
        ctx.closePath();
        ctx.fill();
        
        // Detalhe claro no topo (cream)
        ctx.fillStyle = COLORS.cream;
        const peakX = x + m.width/2;
        const peakY = canvas.height - m.height;
        ctx.beginPath();
        ctx.moveTo(peakX - 16, peakY + 26);
        ctx.lineTo(peakX, peakY);
        ctx.lineTo(peakX + 16, peakY + 26);
        ctx.lineTo(peakX + 10, peakY + 30);
        ctx.lineTo(peakX + 4, peakY + 24);
        ctx.lineTo(peakX - 4, peakY + 30);
        ctx.lineTo(peakX - 10, peakY + 24);
        ctx.closePath();
        ctx.fill();
    }
    
    // CAMADA 4 — (nuvens removidas — o céu creme fica mais limpo)
    
    // CAMADA 5 — Árvores ROSA (de fundo, parallax médio)
    if (assets.arvoreRosa) {
        for (const t of bgTrees) {
            if (t.type !== 'rosa') continue;
            const x = t.x - game.camera.x * 0.55;
            const w = 130 * t.scale;
            const h = 160 * t.scale;
            if (x + w < 0 || x > canvas.width) continue;
            // Posiciona a base da árvore um pouco acima do chão (layer de fundo)
            ctx.drawImage(assets.arvoreRosa, x, 500 - h - game.camera.y, w, h);
        }
    }
}

function drawForegroundTrees() {
    // CAMADA 6 — Árvores AZUIS (frente, parallax rápido)
    if (assets.arvoreAzul) {
        for (const t of bgTrees) {
            if (t.type !== 'azul') continue;
            const x = t.x - game.camera.x * 0.75;
            const w = 150 * t.scale;
            const h = 185 * t.scale;
            if (x + w < 0 || x > canvas.width) continue;
            // Apoia base da árvore no chão
            ctx.drawImage(assets.arvoreAzul, x, 500 - h - game.camera.y, w, h);
        }
    }
    
    // Arbustos / pedacinhos decorativos bem próximos
    for (const b of bushes) {
        const x = b.x - game.camera.x * 0.9;
        if (x + b.size*2 < 0 || x > canvas.width) continue;
        
        // Silhueta rosa com detalhe
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(x, b.y, b.size, 0, Math.PI*2);
        ctx.arc(x + b.size*0.8, b.y - 3, b.size*0.9, 0, Math.PI*2);
        ctx.arc(x + b.size*1.5, b.y, b.size*0.8, 0, Math.PI*2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = COLORS.pinkLight;
        ctx.beginPath();
        ctx.arc(x + b.size*0.4, b.y - 4, b.size*0.4, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawCloud(x, y, size, type) {
    // Nuvens estilizadas com a paleta
    ctx.fillStyle = COLORS.navyDeep;
    const s = 14 * size;
    
    if (type === 'puff') {
        // Nuvem fofinha
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI*2);
        ctx.arc(x + s*0.8, y - s*0.3, s*0.9, 0, Math.PI*2);
        ctx.arc(x + s*1.6, y, s*0.8, 0, Math.PI*2);
        ctx.arc(x + s*0.4, y + s*0.3, s*0.7, 0, Math.PI*2);
        ctx.arc(x + s*1.2, y + s*0.3, s*0.75, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        // "Ondinha" que aparece no branding
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = COLORS.navy;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < s*3; i += 2) {
            const wy = y + Math.sin(i * 0.15) * 4;
            if (i === 0) ctx.moveTo(x + i, wy);
            else ctx.lineTo(x + i, wy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// CÂMERA
// ============================================================
function updateCamera() {
    const target = player.x - canvas.width / 2 + player.w / 2;
    game.camera.x += (target - game.camera.x) * 0.1;
    if (game.camera.x < 0) game.camera.x = 0;
    if (game.camera.x > WORLD_WIDTH - canvas.width) {
        game.camera.x = WORLD_WIDTH - canvas.width;
    }
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
    document.getElementById('coinCount').textContent = game.coins;
    document.getElementById('livesCount').textContent = game.lives;
}

function showGameOver() {
    document.getElementById('finalCoins').textContent = game.coins;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function showWinScreen() {
    document.getElementById('winCoins').textContent = game.coins;
    document.getElementById('winScreen').classList.remove('hidden');
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
function gameLoop() {
    game.time++;
    
    // Fundo
    drawBackground();
    
    if (game.state === 'playing') {
        player.update();
        updateEnemies();
        updateParticles();
        checkCoinCollection();
        updateCamera();
    }
    
    // Árvores azuis (camada front do cenário, antes das plataformas)
    drawForegroundTrees();
    
    // Plataformas
    for (const p of platforms) drawPlatform(p);
    
    // Moedas
    for (const coin of coins) drawCoin(coin);
    
    // Inimigos
    for (const e of enemies) drawEnemy(e);
    
    // Player
    if (game.state === 'playing' || game.state === 'win') {
        player.draw();
    }
    
    // Partículas
    drawParticles();
    
    requestAnimationFrame(gameLoop);
}

// ============================================================
// START / RESTART
// ============================================================
function startGame() {
    game.state = 'playing';
    game.coins = 0;
    game.lives = 3;
    game.particles = [];
    player.reset();
    
    for (const c of coins) c.collected = false;
    for (const e of enemies) e.alive = true;
    
    enemies[0].x = 800;
    enemies[1].x = 1200;
    enemies[2].x = 1800;
    enemies[3].x = 2800;
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    updateHUD();
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('winRestartBtn').addEventListener('click', startGame);

// ============================================================
// BOOT
// ============================================================
loadAssets().then(() => {
    gameLoop();
}).catch(err => {
    console.error('Erro ao carregar assets:', err);
    // Roda mesmo assim pra não travar
    gameLoop();
});

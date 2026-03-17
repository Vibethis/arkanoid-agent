(() => {
  /**
   * Arkanoid Agent — HTML5 Canvas
   * Run: open index.html in a modern browser (mobile-first).
   * Controls: swipe/drag in bottom half (mobile), arrow keys (desktop), mouse (optional).
   * Tuning: see CONFIG object below (ball speed, paddle size, brick grid, colors).
   */

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('final-score');
  const scoreEl = document.getElementById('score');
  const playAgainBtn = document.getElementById('play-again');
  const rotateHint = document.getElementById('rotate-hint');

  const CONFIG = {
    logicalWidth: 800,
    logicalHeight: 1200,
    baseBallSpeed: 420,
    speedRampInterval: 6000,
    speedRampFactor: 1.03,
    paddleWidth: 140,
    paddleHeight: 18,
    paddleSpeed: 520,
    brickRows: 5,
    brickCols: 9,
    brickPadding: 12,
    brickTop: 140,
    brickSide: 60,
    brickHeight: 26,
    pointsPerBrick: 10,
    neon: {
      cyan: '#0abdc6',
      magenta: '#ea00d9',
      purple: '#711c91',
      blue: '#133e7c',
    },
  };

  class Paddle {
    constructor() {
      this.width = CONFIG.paddleWidth;
      this.height = CONFIG.paddleHeight;
      this.x = 0;
      this.y = CONFIG.logicalHeight - 120;
      this.speed = CONFIG.paddleSpeed;
    }
    reset() {
      this.width = CONFIG.paddleWidth;
      this.x = (CONFIG.logicalWidth - this.width) / 2;
    }
    update(dt, input) {
      if (input.targetX !== null) {
        this.x = input.targetX - this.width / 2;
      }
      if (input.axis !== 0) {
        this.x += input.axis * this.speed * dt;
      }
      this.x = Math.max(20, Math.min(CONFIG.logicalWidth - this.width - 20, this.x));
    }
    draw(ctx) {
      ctx.save();
      const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
      grad.addColorStop(0, CONFIG.neon.cyan);
      grad.addColorStop(1, CONFIG.neon.purple);
      ctx.fillStyle = grad;
      ctx.shadowColor = CONFIG.neon.cyan;
      ctx.shadowBlur = 20;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.restore();
    }
  }

  class Ball {
    constructor() {
      this.radius = 10;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
    }
    reset(speedScale = 1) {
      this.x = CONFIG.logicalWidth / 2;
      this.y = CONFIG.logicalHeight - 170;
      const angle = (Math.random() * 0.5 + 0.25) * Math.PI;
      const speed = CONFIG.baseBallSpeed * speedScale;
      this.vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
      this.vy = -Math.sin(angle) * speed;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    draw(ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = CONFIG.neon.magenta;
      ctx.shadowColor = CONFIG.neon.magenta;
      ctx.shadowBlur = 24;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class BrickGrid {
    constructor() {
      this.bricks = [];
    }
    create() {
      const totalPadding = CONFIG.brickPadding * (CONFIG.brickCols - 1);
      const available = CONFIG.logicalWidth - CONFIG.brickSide * 2 - totalPadding;
      const brickWidth = available / CONFIG.brickCols;
      this.bricks = [];
      for (let r = 0; r < CONFIG.brickRows; r++) {
        for (let c = 0; c < CONFIG.brickCols; c++) {
          this.bricks.push({
            x: CONFIG.brickSide + c * (brickWidth + CONFIG.brickPadding),
            y: CONFIG.brickTop + r * (CONFIG.brickHeight + CONFIG.brickPadding),
            width: brickWidth,
            height: CONFIG.brickHeight,
            alive: true,
            hue: 190 + r * 14,
          });
        }
      }
    }
    remaining() {
      return this.bricks.filter((b) => b.alive).length;
    }
    checkCollision(ball) {
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height
        ) {
          brick.alive = false;
          const overlapX = Math.min(
            ball.x + ball.radius - brick.x,
            brick.x + brick.width - (ball.x - ball.radius)
          );
          const overlapY = Math.min(
            ball.y + ball.radius - brick.y,
            brick.y + brick.height - (ball.y - ball.radius)
          );
          if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
          return true;
        }
      }
      return false;
    }
    draw(ctx) {
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        ctx.save();
        ctx.fillStyle = `hsla(${brick.hue}, 90%, 60%, 0.92)`;
        ctx.shadowColor = `hsla(${brick.hue}, 90%, 60%, 0.9)`;
        ctx.shadowBlur = 14;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.restore();
      }
    }
  }

  class InputController {
    constructor(target) {
      this.target = target;
      this.targetX = null;
      this.axis = 0;
      this.touchStartX = 0;
      this.paddleStartX = 0;
      this.keys = { left: false, right: false };
      this.bind();
    }
    bind() {
      this.target.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = this.target.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        if (y < rect.height * 0.5) return;
        this.touchStartX = (touch.clientX - rect.left) * game.scale;
        this.paddleStartX = game.paddle.x;
        e.preventDefault();
      }, { passive: false });

      this.target.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = this.target.getBoundingClientRect();
        const currentX = (touch.clientX - rect.left) * game.scale;
        const delta = currentX - this.touchStartX;
        this.targetX = this.paddleStartX + delta;
        e.preventDefault();
      }, { passive: false });

      this.target.addEventListener('touchend', () => {
        this.targetX = null;
      });

      this.target.addEventListener('mousemove', (e) => {
        const rect = this.target.getBoundingClientRect();
        if (e.clientY - rect.top < rect.height * 0.4) return;
        this.targetX = (e.clientX - rect.left) * game.scale;
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') this.keys.left = true;
        if (e.key === 'ArrowRight') this.keys.right = true;
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft') this.keys.left = false;
        if (e.key === 'ArrowRight') this.keys.right = false;
      });
    }
    update() {
      this.axis = 0;
      if (this.keys.left) this.axis -= 1;
      if (this.keys.right) this.axis += 1;
    }
  }

  class Game {
    constructor() {
      this.state = 'PLAYING';
      this.score = 0;
      this.level = 1;
      this.speedScale = 1;
      this.lastRamp = 0;
      this.lastTime = 0;
      this.scale = 1;
      this.viewWidth = CONFIG.logicalWidth;
      this.viewHeight = CONFIG.logicalHeight;
      this.paddle = new Paddle();
      this.ball = new Ball();
      this.bricks = new BrickGrid();
      this.input = new InputController(canvas);
    }
    reset() {
      this.state = 'PLAYING';
      this.score = 0;
      this.level = 1;
      this.speedScale = 1;
      this.lastRamp = 0;
      this.paddle.reset();
      this.ball.reset(this.speedScale);
      this.bricks.create();
      scoreEl.textContent = 'Score: 0';
      overlay.classList.add('hidden');
    }
    update(dt) {
      if (this.state !== 'PLAYING') return;

      this.input.update();
      this.paddle.update(dt, this.input);
      this.ball.update(dt);

      // wall collisions
      if (this.ball.x < this.ball.radius || this.ball.x > CONFIG.logicalWidth - this.ball.radius) {
        this.ball.vx *= -1;
      }
      if (this.ball.y < this.ball.radius + 8) {
        this.ball.vy *= -1;
      }

      // paddle collision
      if (
        this.ball.y + this.ball.radius >= this.paddle.y &&
        this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.height &&
        this.ball.x >= this.paddle.x &&
        this.ball.x <= this.paddle.x + this.paddle.width
      ) {
        const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width - 0.5;
        const speed = Math.hypot(this.ball.vx, this.ball.vy);
        this.ball.vx = speed * Math.sin(hitPos * 2.2);
        this.ball.vy = -Math.abs(speed * Math.cos(hitPos * 2.2));
      }

      if (this.bricks.checkCollision(this.ball)) {
        this.score += CONFIG.pointsPerBrick;
        scoreEl.textContent = `Score: ${this.score}`;
      }

      if (this.bricks.remaining() === 0) {
        this.level += 1;
        this.speedScale = 1 + (this.level - 1) * 0.08;
        this.paddle.width = Math.max(100, CONFIG.paddleWidth - (this.level - 1) * 6);
        this.bricks.create();
        this.ball.reset(this.speedScale);
      }

      if (this.ball.y - this.ball.radius > CONFIG.logicalHeight) {
        this.gameOver();
      }

      // difficulty ramp over time
      if (performance.now() - this.lastRamp > CONFIG.speedRampInterval) {
        this.lastRamp = performance.now();
        this.ball.vx *= CONFIG.speedRampFactor;
        this.ball.vy *= CONFIG.speedRampFactor;
      }
    }
    gameOver() {
      this.state = 'GAME_OVER';
      finalScore.textContent = `Score: ${this.score}`;
      overlay.classList.remove('hidden');
    }
    draw() {
      ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
      // background grid
      ctx.save();
      ctx.strokeStyle = 'rgba(10, 189, 198, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CONFIG.logicalWidth; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.logicalHeight);
        ctx.stroke();
      }
      for (let y = 0; y < CONFIG.logicalHeight; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CONFIG.logicalWidth, y);
        ctx.stroke();
      }
      ctx.restore();

      this.bricks.draw(ctx);
      this.paddle.draw(ctx);
      this.ball.draw(ctx);
    }
    loop(timestamp) {
      const dt = Math.min(0.032, (timestamp - this.lastTime) / 1000) || 0;
      this.lastTime = timestamp;
      this.update(dt);
      this.draw();
      requestAnimationFrame(this.loop.bind(this));
    }
    resize() {
      const wrapper = document.getElementById('game-wrapper');
      const rect = wrapper.getBoundingClientRect();
      const aspect = CONFIG.logicalWidth / CONFIG.logicalHeight;
      let width = rect.width;
      let height = rect.height;
      if (width / height > aspect) {
        width = height * aspect;
      } else {
        height = width / aspect;
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = CONFIG.logicalWidth;
      canvas.height = CONFIG.logicalHeight;
      this.viewWidth = CONFIG.logicalWidth;
      this.viewHeight = CONFIG.logicalHeight;
      this.scale = CONFIG.logicalWidth / width;

      const landscape = rect.width > rect.height;
      const desktopLike = window.matchMedia('(hover: hover)').matches;
      rotateHint.classList.toggle('hidden', desktopLike || !landscape);
    }
  }

  const game = new Game();

  playAgainBtn.addEventListener('click', () => game.reset());
  window.addEventListener('resize', () => game.resize());

  game.resize();
  game.reset();
  game.loop(0);
})();

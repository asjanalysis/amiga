const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const W = canvas.width;
const H = canvas.height;
ctx.imageSmoothingEnabled = false;

const TAU = Math.PI * 2;
const keys = new Set();
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const palette = {
  black: "#050414",
  void: "#090622",
  purple: "#2a1465",
  deepPurple: "#15083c",
  magenta: "#ff4fd8",
  pink: "#ff8bf1",
  cyan: "#31e7ff",
  blue: "#4e7cff",
  gold: "#ffd166",
  orange: "#ff8f3d",
  green: "#75ff8f",
  mint: "#c7ffd6",
  white: "#fff7ff",
  gray: "#8f83b7",
  red: "#ff4d6d"
};

let audioCtx = null;
let muted = false;

const state = {
  mode: "title",
  time: 0,
  distance: 0,
  score: 0,
  hiScore: Number(localStorage.getItem("amiga-starfire-hi") || 0),
  wave: 1,
  combo: 1,
  comboTimer: 0,
  shake: 0,
  flash: 0,
  spawnTimer: 0,
  bossTimer: 35,
  message: "",
  messageTimer: 0
};

const player = {
  x: 44,
  y: H / 2,
  w: 18,
  h: 12,
  speed: 124,
  lives: 3,
  shield: 100,
  weapon: 1,
  cooldown: 0,
  invuln: 0,
  trail: []
};

let shots = [];
let foes = [];
let sparks = [];
let gems = [];
let floatText = [];
let stars = [];
let comets = [];
let touchActive = false;

function resetStars() {
  stars = [];
  for (let layer = 0; layer < 4; layer++) {
    const count = [55, 38, 24, 14][layer];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        layer,
        size: layer === 3 ? 2 : 1,
        twinkle: rand(0, TAU),
        hue: Math.random() < 0.45 ? palette.cyan : Math.random() < 0.7 ? palette.pink : palette.white
      });
    }
  }
}

function resetGame() {
  state.mode = "play";
  state.time = 0;
  state.distance = 0;
  state.score = 0;
  state.wave = 1;
  state.combo = 1;
  state.comboTimer = 0;
  state.shake = 0;
  state.flash = 0;
  state.spawnTimer = 0.7;
  state.bossTimer = 35;
  state.message = "CHROMATIC BELT";
  state.messageTimer = 2.4;

  player.x = 44;
  player.y = H / 2;
  player.lives = 3;
  player.shield = 100;
  player.weapon = 1;
  player.cooldown = 0;
  player.invuln = 1.6;
  player.trail = [];

  shots = [];
  foes = [];
  sparks = [];
  gems = [];
  floatText = [];
  comets = [];
  overlay.classList.add("hidden");
  makeBurst(player.x, player.y, palette.cyan, 28, 62);
  beep(180, 0.09, "sawtooth", 0.035);
  beep(360, 0.12, "square", 0.025, 0.08);
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, duration = 0.08, type = "square", volume = 0.025, delay = 0) {
  if (muted || !audioCtx) return;
  const now = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function addScore(points, x, y) {
  const gained = Math.round(points * state.combo);
  state.score += gained;
  state.hiScore = Math.max(state.hiScore, state.score);
  localStorage.setItem("amiga-starfire-hi", String(state.hiScore));
  floatText.push({ x, y, text: `+${gained}`, life: 0.8, vy: -22 });
  state.combo = clamp(state.combo + 0.1, 1, 5);
  state.comboTimer = 2.1;
}

function rectsTouch(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.w + b.w) && Math.abs(a.y - b.y) * 2 < (a.h + b.h);
}

function makeBurst(x, y, color, count = 12, speed = 40) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const s = rand(speed * 0.25, speed);
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(0.25, 0.8),
      maxLife: rand(0.45, 0.9),
      color,
      size: Math.random() < 0.25 ? 2 : 1
    });
  }
}

function spawnFoe(kind = null) {
  const roll = Math.random();
  if (!kind) {
    if (state.wave > 3 && roll > 0.88) kind = "cruiser";
    else if (state.wave > 2 && roll > 0.72) kind = "crystal";
    else if (roll > 0.52) kind = "swooper";
    else kind = "drone";
  }

  const baseY = rand(22, H - 28);
  const common = {
    x: W + 18,
    y: baseY,
    t: rand(0, TAU),
    shotTimer: rand(1.1, 2.6),
    flash: 0,
    points: 100
  };

  if (kind === "drone") {
    foes.push({ ...common, kind, w: 17, h: 13, hp: 2 + Math.floor(state.wave / 3), speed: rand(36, 55) + state.wave * 1.7, amp: rand(5, 18), points: 120 });
  }
  if (kind === "swooper") {
    foes.push({ ...common, kind, w: 16, h: 10, hp: 1 + Math.floor(state.wave / 4), speed: rand(58, 82) + state.wave * 2, amp: rand(18, 42), points: 150 });
  }
  if (kind === "crystal") {
    foes.push({ ...common, kind, w: 14, h: 18, hp: 3 + Math.floor(state.wave / 2), speed: rand(28, 42) + state.wave * 1.4, amp: rand(10, 30), points: 220 });
  }
  if (kind === "cruiser") {
    foes.push({ ...common, kind, w: 28, h: 16, hp: 8 + state.wave, speed: rand(20, 32) + state.wave * 0.8, amp: rand(3, 15), points: 500 });
  }
  if (kind === "carrier") {
    foes.push({
      ...common,
      kind,
      x: W + 38,
      y: H / 2,
      w: 46,
      h: 34,
      hp: 48 + state.wave * 7,
      speed: 14 + state.wave * 0.8,
      amp: 48,
      shotTimer: 0.7,
      points: 2800
    });
    state.message = "NEBULA CARRIER";
    state.messageTimer = 2.4;
  }
}

function dropGem(x, y) {
  const chance = Math.random();
  if (chance < 0.13) {
    gems.push({ x, y, w: 10, h: 10, type: "W", vx: -32, bob: rand(0, TAU), life: 10 });
  } else if (chance < 0.22) {
    gems.push({ x, y, w: 10, h: 10, type: "S", vx: -30, bob: rand(0, TAU), life: 10 });
  } else if (chance < 0.245) {
    gems.push({ x, y, w: 10, h: 10, type: "L", vx: -26, bob: rand(0, TAU), life: 10 });
  }
}

function addPlayerShot(offsetY = 0, vx = 235, vy = 0, color = palette.cyan) {
  shots.push({
    x: player.x + 12,
    y: player.y + offsetY,
    w: 8,
    h: 2,
    vx,
    vy,
    power: 1,
    color,
    player: true,
    life: 1.7
  });
}

function addFoePulse(x, y, vx = -80, vy = 0) {
  shots.push({
    x,
    y,
    w: 5,
    h: 5,
    vx,
    vy,
    power: 12,
    color: palette.orange,
    player: false,
    life: 4
  });
}

function playerZap() {
  if (player.cooldown > 0 || state.mode !== "play") return;
  player.cooldown = clamp(0.17 - player.weapon * 0.012, 0.08, 0.17);
  addPlayerShot(0, 250, 0, palette.cyan);
  if (player.weapon >= 2) {
    addPlayerShot(-4, 235, -18, palette.green);
    addPlayerShot(4, 235, 18, palette.green);
  }
  if (player.weapon >= 3) {
    addPlayerShot(-8, 220, -34, palette.pink);
    addPlayerShot(8, 220, 34, palette.pink);
  }
  if (player.weapon >= 4) {
    addPlayerShot(0, 285, 0, palette.gold);
  }
  beep(640 + player.weapon * 35, 0.035, "square", 0.018);
}

function damagePlayer(amount) {
  if (player.invuln > 0 || state.mode !== "play") return;
  player.shield -= amount;
  state.shake = 0.22;
  state.flash = 0.2;
  makeBurst(player.x, player.y, palette.red, 18, 70);
  beep(95, 0.16, "sawtooth", 0.04);
  player.invuln = 0.9;

  if (player.shield <= 0) {
    player.lives -= 1;
    player.shield = 100;
    player.weapon = Math.max(1, player.weapon - 1);
    state.combo = 1;
    makeBurst(player.x, player.y, palette.gold, 35, 95);
    state.message = player.lives > 0 ? "SHIELD REBOOT" : "MISSION LOST";
    state.messageTimer = 2.2;
    if (player.lives <= 0) {
      endGame();
    }
  }
}

function endGame() {
  state.mode = "over";
  overlay.classList.remove("hidden");
  overlay.querySelector("h2").textContent = "MISSION COMPLETE";
  overlay.querySelector("p:not(.eyebrow):not(.small)").textContent = `Score ${state.score.toLocaleString()} · High score ${state.hiScore.toLocaleString()}`;
  startButton.textContent = "Restart Mission";
  beep(220, 0.18, "triangle", 0.035);
  beep(165, 0.2, "triangle", 0.03, 0.12);
  beep(110, 0.25, "triangle", 0.025, 0.25);
}

function update(dt) {
  if (state.mode !== "play") {
    updateBackground(dt);
    updateSparks(dt);
    return;
  }

  state.time += dt;
  state.distance += dt * 10;
  state.spawnTimer -= dt;
  state.bossTimer -= dt;
  state.shake = Math.max(0, state.shake - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.comboTimer -= dt;
  state.messageTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 1;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.cooldown > 0) player.cooldown -= dt;

  state.wave = 1 + Math.floor(state.distance / 180);

  if (state.spawnTimer <= 0) {
    spawnFoe();
    if (Math.random() < 0.18 + state.wave * 0.012) spawnFoe("drone");
    state.spawnTimer = clamp(1.05 - state.wave * 0.055, 0.28, 1.05);
  }

  if (state.bossTimer <= 0 && !foes.some(f => f.kind === "carrier")) {
    spawnFoe("carrier");
    state.bossTimer = 38 + Math.min(state.wave * 2, 18);
  }

  if (Math.random() < dt * 0.12) {
    comets.push({ x: W + 12, y: rand(5, H - 5), vx: rand(-120, -80), vy: rand(10, 34), life: rand(0.8, 1.4) });
  }

  updateBackground(dt);
  updatePlayer(dt);
  updateShots(dt);
  updateFoes(dt);
  updateGems(dt);
  updateSparks(dt);
  updateFloatText(dt);
  handleCollisions();
}

function updateBackground(dt) {
  for (const s of stars) {
    s.x -= (12 + s.layer * 21) * dt;
    s.twinkle += dt * (1.2 + s.layer * 0.3);
    if (s.x < -4) {
      s.x = W + rand(0, 30);
      s.y = rand(0, H);
    }
  }

  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.life -= dt;
    if (c.life <= 0 || c.x < -20 || c.y > H + 20) comets.splice(i, 1);
  }
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
  }

  if (keys.has(" ") || keys.has("z") || keys.has("x")) playerZap();

  player.x = clamp(player.x, 14, W - 42);
  player.y = clamp(player.y, 18, H - 18);

  player.trail.push({ x: player.x - 10, y: player.y, life: 0.22 });
  if (player.trail.length > 16) player.trail.shift();
  for (const t of player.trail) t.life -= dt;
  player.trail = player.trail.filter(t => t.life > 0);
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > W + 28 || b.y < -18 || b.y > H + 18) shots.splice(i, 1);
  }
}

function updateFoes(dt) {
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.t += dt;
    f.x -= f.speed * dt;
    f.flash = Math.max(0, f.flash - dt);

    if (f.kind === "swooper") f.y += Math.sin(f.t * 4) * f.amp * dt;
    if (f.kind === "drone") f.y += Math.sin(f.t * 2.6) * f.amp * dt;
    if (f.kind === "crystal") f.y += Math.cos(f.t * 2.1) * f.amp * dt;
    if (f.kind === "carrier") {
      f.y = H / 2 + Math.sin(f.t * 0.9) * 55;
      if (Math.random() < dt * 0.7) spawnFoe(Math.random() < 0.6 ? "drone" : "swooper");
    }

    f.y = clamp(f.y, 14, H - 14);
    f.shotTimer -= dt;
    if (f.shotTimer <= 0 && f.x < W - 10) {
      const angle = Math.atan2(player.y - f.y, player.x - f.x);
      const speed = f.kind === "carrier" ? 95 : 70;
      addFoePulse(f.x - f.w / 2, f.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
      if (f.kind === "carrier") {
        addFoePulse(f.x - f.w / 2, f.y - 9, -90, -18);
        addFoePulse(f.x - f.w / 2, f.y + 9, -90, 18);
      }
      f.shotTimer = f.kind === "carrier" ? 0.9 : rand(1.6, 3.1);
    }

    if (f.x < -60) foes.splice(i, 1);
  }
}

function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.x += g.vx * dt;
    g.y += Math.sin(state.time * 6 + g.bob) * 12 * dt;
    g.life -= dt;
    if (g.life <= 0 || g.x < -20) gems.splice(i, 1);
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 1.8 * dt;
    p.vy *= 1 - 1.8 * dt;
    p.life -= dt;
    if (p.life <= 0) sparks.splice(i, 1);
  }
}

function updateFloatText(dt) {
  for (let i = floatText.length - 1; i >= 0; i--) {
    const t = floatText[i];
    t.y += t.vy * dt;
    t.life -= dt;
    if (t.life <= 0) floatText.splice(i, 1);
  }
}

function handleCollisions() {
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i];
    if (b.player) {
      for (let j = foes.length - 1; j >= 0; j--) {
        const f = foes[j];
        if (rectsTouch(b, f)) {
          f.hp -= b.power;
          f.flash = 0.09;
          makeBurst(b.x, b.y, b.color, 5, 28);
          shots.splice(i, 1);
          if (f.hp <= 0) {
            makeBurst(f.x, f.y, f.kind === "crystal" ? palette.pink : palette.cyan, f.kind === "carrier" ? 80 : 25, f.kind === "carrier" ? 120 : 70);
            dropGem(f.x, f.y);
            addScore(f.points, f.x, f.y);
            state.shake = f.kind === "carrier" ? 0.32 : 0.12;
            beep(f.kind === "carrier" ? 90 : 180, 0.09, "sawtooth", 0.03);
            if (f.kind === "carrier") {
              state.message = "CARRIER CLEARED";
              state.messageTimer = 2.5;
              player.shield = clamp(player.shield + 45, 0, 100);
            }
            foes.splice(j, 1);
          } else {
            beep(350 + Math.random() * 150, 0.025, "square", 0.012);
          }
          break;
        }
      }
    } else if (rectsTouch(b, player)) {
      shots.splice(i, 1);
      damagePlayer(b.power);
    }
  }

  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    if (rectsTouch(f, player)) {
      foes.splice(i, 1);
      makeBurst(f.x, f.y, palette.orange, 20, 75);
      damagePlayer(f.kind === "carrier" ? 55 : 25);
    }
  }

  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    if (rectsTouch(g, player)) {
      if (g.type === "W") {
        player.weapon = clamp(player.weapon + 1, 1, 4);
        state.message = "BEAM UPGRADE";
      }
      if (g.type === "S") {
        player.shield = clamp(player.shield + 35, 0, 100);
        state.message = "SHIELD CRYSTAL";
      }
      if (g.type === "L") {
        player.lives = clamp(player.lives + 1, 0, 7);
        state.message = "EXTRA SHIP";
      }
      state.messageTimer = 1.5;
      makeBurst(g.x, g.y, g.type === "W" ? palette.green : g.type === "S" ? palette.cyan : palette.gold, 20, 58);
      beep(g.type === "L" ? 740 : 520, 0.12, "triangle", 0.035);
      gems.splice(i, 1);
    }
  }
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate(rand(-2, 2) * state.shake * 7, rand(-2, 2) * state.shake * 7);
  }
  drawBackground();
  drawComets();
  drawGems();
  drawShots();
  drawFoes();
  drawPlayer();
  drawSparks();
  drawFloatText();
  drawHud();
  drawMessages();
  if (state.flash > 0) {
    ctx.globalAlpha = state.flash * 1.8;
    ctx.fillStyle = palette.red;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#06031b");
  g.addColorStop(0.45, "#131056");
  g.addColorStop(1, "#03091d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += 7) {
    for (let x = ((Math.floor(state.time * 18) + y) % 12) - 12; x < W; x += 12) {
      ctx.fillStyle = y % 14 === 0 ? "rgba(255,79,216,.08)" : "rgba(49,231,255,.055)";
      ctx.fillRect(x, y, 2, 1);
    }
  }

  drawPlanet(W - 56 - (state.distance % 520) * 0.08, 42, 28, palette.purple, palette.magenta);
  drawPlanet(W + 180 - (state.distance % 680) * 0.055, 160, 18, palette.deepPurple, palette.cyan);

  for (const s of stars) {
    const alpha = 0.42 + Math.sin(s.twinkle) * 0.22 + s.layer * 0.1;
    ctx.globalAlpha = clamp(alpha, 0.22, 1);
    ctx.fillStyle = s.hue;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    if (s.layer === 3) ctx.fillRect(Math.round(s.x - 1), Math.round(s.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(x, y, r, c1, c2) {
  if (x < -r || x > W + r) return;
  ctx.fillStyle = c1;
  ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
  ctx.fillStyle = c2;
  for (let i = -r; i < r; i += 4) {
    ctx.fillRect(Math.round(x - r), Math.round(y + i), r * 2, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(Math.round(x - r + 5), Math.round(y - r + 6), Math.round(r * 0.75), 3);
}

function drawComets() {
  for (const c of comets) {
    ctx.fillStyle = palette.white;
    ctx.fillRect(Math.round(c.x), Math.round(c.y), 2, 2);
    ctx.fillStyle = "rgba(49,231,255,.65)";
    ctx.fillRect(Math.round(c.x + 3), Math.round(c.y - 1), 10, 1);
    ctx.fillStyle = "rgba(255,79,216,.45)";
    ctx.fillRect(Math.round(c.x + 2), Math.round(c.y + 2), 8, 1);
  }
}

function drawPlayer() {
  for (const t of player.trail) {
    ctx.globalAlpha = clamp(t.life * 3, 0, 0.9);
    ctx.fillStyle = palette.cyan;
    ctx.fillRect(Math.round(t.x), Math.round(t.y - 2), 8, 4);
    ctx.fillStyle = palette.pink;
    ctx.fillRect(Math.round(t.x - 5), Math.round(t.y - 1), 5, 2);
  }
  ctx.globalAlpha = 1;

  if (player.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) return;
  const x = Math.round(player.x);
  const y = Math.round(player.y);

  ctx.fillStyle = palette.cyan;
  ctx.fillRect(x - 9, y - 3, 17, 6);
  ctx.fillStyle = palette.white;
  ctx.fillRect(x - 2, y - 5, 9, 3);
  ctx.fillStyle = palette.blue;
  ctx.fillRect(x - 2, y + 3, 10, 3);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(x + 8, y - 1, 5, 2);
  ctx.fillStyle = palette.magenta;
  ctx.fillRect(x - 12, y - 7, 10, 4);
  ctx.fillRect(x - 12, y + 3, 10, 4);
  ctx.fillStyle = palette.green;
  ctx.fillRect(x - 15, y - 2, 6, 4);
  ctx.fillStyle = palette.orange;
  ctx.fillRect(x - 19, y - 1, 4, 2);
  ctx.fillStyle = palette.white;
  ctx.fillRect(x + 2, y - 2, 2, 2);
}

function drawShots() {
  for (const b of shots) {
    ctx.fillStyle = b.color;
    if (b.player) {
      ctx.fillRect(Math.round(b.x), Math.round(b.y - 1), b.w, b.h);
      ctx.fillStyle = palette.white;
      ctx.fillRect(Math.round(b.x + 1), Math.round(b.y), Math.max(1, b.w - 3), 1);
    } else {
      ctx.fillRect(Math.round(b.x - 2), Math.round(b.y - 2), 5, 5);
      ctx.fillStyle = palette.gold;
      ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 3, 3);
    }
  }
}

function drawFoes() {
  for (const f of foes) {
    const x = Math.round(f.x);
    const y = Math.round(f.y);
    const flash = f.flash > 0;
    if (f.kind === "drone") drawDrone(x, y, flash);
    if (f.kind === "swooper") drawSwooper(x, y, flash);
    if (f.kind === "crystal") drawCrystal(x, y, flash);
    if (f.kind === "cruiser") drawCruiser(x, y, flash);
    if (f.kind === "carrier") drawCarrier(x, y, f.hp, flash);
  }
}

function drawDrone(x, y, flash) {
  ctx.fillStyle = flash ? palette.white : palette.magenta;
  ctx.fillRect(x - 8, y - 5, 14, 10);
  ctx.fillStyle = flash ? palette.white : palette.purple;
  ctx.fillRect(x - 12, y - 2, 5, 4);
  ctx.fillRect(x + 6, y - 2, 5, 4);
  ctx.fillStyle = palette.green;
  ctx.fillRect(x - 2, y - 2, 3, 3);
}

function drawSwooper(x, y, flash) {
  ctx.fillStyle = flash ? palette.white : palette.orange;
  ctx.fillRect(x - 8, y - 3, 16, 6);
  ctx.fillStyle = flash ? palette.white : palette.gold;
  ctx.fillRect(x - 5, y - 7, 8, 4);
  ctx.fillRect(x - 5, y + 3, 8, 4);
  ctx.fillStyle = palette.red;
  ctx.fillRect(x - 10, y - 1, 3, 2);
}

function drawCrystal(x, y, flash) {
  ctx.fillStyle = flash ? palette.white : palette.pink;
  ctx.fillRect(x - 4, y - 9, 8, 18);
  ctx.fillStyle = flash ? palette.white : palette.cyan;
  ctx.fillRect(x - 8, y - 4, 16, 8);
  ctx.fillStyle = palette.white;
  ctx.fillRect(x - 1, y - 6, 2, 12);
}

function drawCruiser(x, y, flash) {
  ctx.fillStyle = flash ? palette.white : palette.blue;
  ctx.fillRect(x - 14, y - 6, 25, 12);
  ctx.fillStyle = flash ? palette.white : palette.cyan;
  ctx.fillRect(x - 5, y - 9, 13, 5);
  ctx.fillRect(x - 5, y + 4, 13, 5);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(x - 16, y - 2, 4, 4);
  ctx.fillStyle = palette.green;
  ctx.fillRect(x + 5, y - 2, 3, 3);
}

function drawCarrier(x, y, hp, flash) {
  ctx.fillStyle = flash ? palette.white : palette.deepPurple;
  ctx.fillRect(x - 23, y - 14, 41, 28);
  ctx.fillStyle = flash ? palette.white : palette.magenta;
  ctx.fillRect(x - 18, y - 21, 25, 7);
  ctx.fillRect(x - 18, y + 14, 25, 7);
  ctx.fillStyle = flash ? palette.white : palette.cyan;
  ctx.fillRect(x - 4, y - 10, 20, 20);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(x - 27, y - 5, 6, 10);
  ctx.fillStyle = palette.green;
  ctx.fillRect(x + 2, y - 4, 4, 8);
  ctx.fillStyle = palette.red;
  ctx.fillRect(x - 22, y - 24, clamp(hp, 0, 70) / 70 * 44, 2);
}

function drawGems() {
  for (const g of gems) {
    const x = Math.round(g.x);
    const y = Math.round(g.y);
    const color = g.type === "W" ? palette.green : g.type === "S" ? palette.cyan : palette.gold;
    ctx.fillStyle = color;
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = palette.white;
    ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.fillStyle = palette.deepPurple;
    ctx.font = "7px monospace";
    ctx.fillText(g.type, x - 3, y + 3);
  }
}

function drawSparks() {
  for (const p of sparks) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloatText() {
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  for (const t of floatText) {
    ctx.globalAlpha = clamp(t.life * 1.6, 0, 1);
    ctx.fillStyle = palette.gold;
    ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function drawHud() {
  ctx.fillStyle = "rgba(5,4,20,.82)";
  ctx.fillRect(0, 0, W, 16);
  ctx.fillStyle = palette.white;
  ctx.font = "8px monospace";
  ctx.fillText(`SCORE ${state.score.toString().padStart(6, "0")}`, 6, 11);
  ctx.fillText(`HI ${state.hiScore.toString().padStart(6, "0")}`, 92, 11);
  ctx.fillText(`WAVE ${state.wave}`, 176, 11);
  ctx.fillText(`x${state.combo.toFixed(1)}`, 224, 11);

  ctx.fillStyle = palette.gray;
  ctx.fillRect(266, 5, 54, 6);
  ctx.fillStyle = player.shield > 60 ? palette.green : player.shield > 28 ? palette.gold : palette.red;
  ctx.fillRect(267, 6, Math.floor(52 * player.shield / 100), 4);

  for (let i = 0; i < player.lives; i++) {
    ctx.fillStyle = palette.cyan;
    ctx.fillRect(331 + i * 9, 5, 6, 4);
    ctx.fillStyle = palette.magenta;
    ctx.fillRect(329 + i * 9, 7, 4, 3);
  }
}

function drawMessages() {
  if (state.messageTimer > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(state.messageTimer, 0, 1);
    ctx.textAlign = "center";
    ctx.font = "14px monospace";
    ctx.fillStyle = palette.deepPurple;
    ctx.fillRect(88, 84, 208, 26);
    ctx.strokeStyle = palette.cyan;
    ctx.strokeRect(90, 86, 204, 22);
    ctx.fillStyle = palette.gold;
    ctx.fillText(state.message, W / 2, 101);
    ctx.restore();
  }

  if (state.mode === "paused") {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "18px monospace";
    ctx.fillStyle = palette.gold;
    ctx.fillText("PAUSED", W / 2, H / 2);
    ctx.textAlign = "left";
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function canvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const touch = evt.touches ? evt.touches[0] : evt;
  return {
    x: (touch.clientX - rect.left) / rect.width * W,
    y: (touch.clientY - rect.top) / rect.height * H
  };
}

startButton.addEventListener("click", () => {
  initAudio();
  resetGame();
});

window.addEventListener("keydown", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  keys.add(k);
  if (k === "p") {
    if (state.mode === "play") state.mode = "paused";
    else if (state.mode === "paused") state.mode = "play";
  }
  if (k === "m") muted = !muted;
  if ((k === "Enter" || k === " ") && state.mode !== "play" && state.mode !== "paused") {
    initAudio();
    resetGame();
  }
});

window.addEventListener("keyup", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.delete(k);
});

canvas.addEventListener("pointerdown", e => {
  initAudio();
  if (state.mode !== "play") resetGame();
  touchActive = true;
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  player.x = clamp(p.x, 14, W - 42);
  player.y = clamp(p.y, 18, H - 18);
});

canvas.addEventListener("pointermove", e => {
  if (!touchActive || state.mode !== "play") return;
  const p = canvasPoint(e);
  player.x += (p.x - player.x) * 0.4;
  player.y += (p.y - player.y) * 0.4;
  playerZap();
});

canvas.addEventListener("pointerup", e => {
  touchActive = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
});

canvas.addEventListener("pointercancel", () => {
  touchActive = false;
});

resetStars();
requestAnimationFrame(loop);

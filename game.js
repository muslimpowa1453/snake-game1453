// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
let myId = null;
let lastWorldState = { snakes: [], foods: [] };
let interpolationFactor = 0;

// UI Elements
const uiStart = document.getElementById('start-screen');
const uiHud = document.getElementById('hud');
const uiDeath = document.getElementById('death-screen');
const scoreEl = document.getElementById('score');
const leaderEl = document.getElementById('leaderboard');
const feedEl = document.getElementById('kill-feed');
const btnPlay = document.getElementById('play-btn');
const btnRestart = document.getElementById('restart-btn');
const btnMobileBoost = document.getElementById('mobile-boost');

// Assets (Procedural generation for icons)
const drawIcon = (ctx, type, x, y, r) => {
    ctx.save();
    ctx.translate(x, y);
    if (type === 1) { // Speed (Lightning-ish)
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.moveTo(-r, -r/2); ctx.lineTo(r/4, -r/2); ctx.lineTo(0, r); ctx.lineTo(-r/4, -r/2); ctx.fill();
    } else if (type === 2) { // Magnet (Red U)
        ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.arc(0, 0, r/1.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'silver'; ctx.fillRect(-r/4, r/4, r/2, r/2);
    } else if (type === 3) { // 2x (Green text)
        ctx.fillStyle = '#4caf50'; ctx.font = `bold ${r}px Arial`; ctx.textAlign='center'; ctx.fillText('2x',0,r/3);
    } else if (type === 4) { // 5x (Purple)
        ctx.fillStyle = '#9c27b0'; ctx.font = `bold ${r}px Arial`; ctx.textAlign='center'; ctx.fillText('5x',0,r/3);
    } else { // Cookie/Candy (Brown/Pink circle with dots)
        ctx.fillStyle = type > 10 ? '#e91e63' : '#795548';
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(r/2, -r/2, r/4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
};

// Network Setup
let net = null;

function startGame() {
    const serverUrl = 'wss://snake-server-3bnw.onrender.com'; // Change to your Render WSS URL
    // or 'wss://your-app-name.onrender.com'
    
    net = new NetworkManager(serverUrl, handleUpdate, handleInit, handleKillFeed);
    
    // Game Loop for sending inputs and rendering
    requestAnimationFrame(loop);
}

function handleInit(id) {
    myId = id;
    uiStart.style.display = 'none';
    uiDeath.style.display = 'none';
    uiHud.style.display = 'block';
}

function handleUpdate(state) {
    lastWorldState = state;
}

function handleKillFeed(killer, victim) {
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `<b>${killer}</b> killed <b>${victim}</b>`;
    feedEl.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// Main Loop
function loop() {
    // 1. Send Input
    if (net) net.sendCurrentInput();

    // 2. Clear Screen
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Find My Snake for Camera
    const me = lastWorldState.snakes.find(s => s.id === myId);

    // 4. Calculate Camera
    let camX = 0, camY = 0, zoom = 1;
    if (me) {
        // Smooth Zoom based on score
        const targetZoom = 1 / Math.pow(Math.log(me.score + 10) / 2.5, 0.5);
        zoom += (targetZoom - zoom) * 0.05;
        if(zoom < 0.3) zoom = 0.3; // Min zoom

        // Center the head
        camX = me.x - (canvas.width / 2) / zoom;
        camY = me.y - (canvas.height / 2) / zoom;
    } else if (lastWorldState.snakes.length > 0) {
        // Spectate mode (just follow first snake)
        const s = lastWorldState.snakes[0];
        camX = s.x - (canvas.width / 2) / zoom;
        camY = s.y - (canvas.height / 2) / zoom;
    }

    // 5. Draw Grid
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    
    drawGrid(camX, camY, zoom);

    // 6. Draw Food
    lastWorldState.foods.forEach(f => {
        // Optimization: Don't draw if off screen
        if (f.x < camX || f.x > camX + canvas.width/zoom || f.y < camY || f.y > camY + canvas.height/zoom) return;

        const r = 5 + Math.log2(f.val || 1) * 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        
        if (f.type === 0) ctx.fillStyle = `hsl(${(f.x+f.y)%360}, 70%, 60%)`; // Generic Food
        else ctx.fillStyle = '#fff'; // Placeholder for icon background
        
        ctx.fill();
        
        // Draw Icons on special items
        if (f.type > 0) drawIcon(ctx, f.type, f.x, f.y, r);
    });

    // 7. Draw Snakes
    // Sort by ID or just iterate
    lastWorldState.snakes.forEach(s => {
        if (s.id === myId) {
            scoreEl.innerText = `Mass: ${Math.floor(s.score)}`;
            updateLeaderboard(s);
            if (s.score <= 0) showDeathScreen(); // Simple check
        }

        drawSnake(s);
    });

    ctx.restore();
    requestAnimationFrame(loop);
}

function drawSnake(s) {
    const len = s.body.length;
    if(len === 0) return;

    // Calculate radius based on score
    const radius = CONFIG.baseRadius + Math.sqrt(s.score)*0.5;
    
    // Draw Body
    for(let i = len-1; i >= 0; i--) {
        const p = s.body[i];
        // Gap logic handled by server, we just draw circles here
        // We draw every segment sent by server
        const size = radius; // Could taper tail if desired
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI*2);
        ctx.fillStyle = s.skin;
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
    }

    // Draw Head (The first point in body array is the head in this logic, or x/y)
    // Server sends x/y for head, body contains history
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI*2);
    ctx.fillStyle = s.skin;
    ctx.fill();

    // Eyes (Direction s.angle)
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    
    // Whites
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(radius*0.5, -radius*0.4, radius*0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(radius*0.5, radius*0.4, radius*0.4, 0, Math.PI*2); ctx.fill();
    
    // Pupils
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(radius*0.7, -radius*0.4, radius*0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(radius*0.7, radius*0.4, radius*0.15, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();

    // Name
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.strokeText(s.name, s.x, s.y - radius - 10);
    ctx.fillText(s.name, s.x, s.y - radius - 10);
}

function drawGrid(camX, camY, zoom) {
    const size = 50;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const startX = Math.floor(camX / size) * size;
    const startY = Math.floor(camY / size) * size;
    const w = canvas.width / zoom;
    const h = canvas.height / zoom;

    for (let x = startX; x < startX + w + size; x += size) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + h + size);
    }
    for (let y = startY; y < startY + h + size; y += size) {
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + w + size, y);
    }
    ctx.stroke();

    // Borders
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, CONFIG.worldSize, CONFIG.worldSize);
}

function updateLeaderboard(me) {
    const sorted = [...lastWorldState.snakes].sort((a,b) => b.score - a.score).slice(0, 5);
    let html = '';
    sorted.forEach((s, i) => {
        const style = s.id === me.id ? 'color:yellow' : '';
        html += `<div style="${style}">${i+1}. ${s.name} (${Math.floor(s.score)})</div>`;
    });
    leaderEl.innerHTML = html;
}

function showDeathScreen() {
    uiHud.style.display = 'none';
    uiDeath.style.display = 'flex';
    myId = null; // Stop tracking me
}

// Event Listeners
btnPlay.onclick = startGame;
btnRestart.onclick = () => {
    uiDeath.style.display = 'none';
    uiStart.style.display = 'flex';
};

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
window.dispatchEvent(new Event('resize')); // Trigger once

// Mobile Boost Logic
let boosting = false;
btnMobileBoost.addEventListener('touchstart', (e) => { e.preventDefault(); boosting = true; if(net) net.sendInput(2, true); });
btnMobileBoost.addEventListener('touchend', (e) => { e.preventDefault(); boosting = false; if(net) net.sendInput(3, false); });

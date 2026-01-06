const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const mctx = minimap.getContext("2d");
const leaderboard = document.getElementById("leaderboard");

canvas.width = innerWidth;
canvas.height = innerHeight;
minimap.width = minimap.height = 150;

// 🔴 CHANGE THIS TO YOUR RENDER URL
const ws = new WebSocket("wss://snake-server-3bnw.onrender.com");

let myId = null;
let state = null;
let mouse = { x: 0, y: 0 };
let boost = false;

ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === "init") myId = msg.id;
    if (msg.type === "state") state = msg;
};

addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
addEventListener("mousedown", () => boost = true);
addEventListener("mouseup", () => boost = false);

function sendInput() {
    if (!myId) return;
    ws.send(JSON.stringify({
        type: "input",
        angle: Math.atan2(
            mouse.y - canvas.height / 2,
            mouse.x - canvas.width / 2
        ),
        boost
    }));
}

function draw() {
    requestAnimationFrame(draw);
    if (!state || !myId) return;

    sendInput();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const me = state.players.find(p => p.id === myId);
    if (!me) return;

    ctx.save();
    ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);

    // Food
    state.foods.forEach(f => {
        ctx.fillStyle = "#ffd966";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Worms (skins)
    state.players.forEach(p => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.skin;
        p.segments.forEach((s, i) => {
            ctx.fillStyle = p.skin;
            ctx.beginPath();
            ctx.arc(s.x, s.y, i === 0 ? 12 : 9, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    ctx.restore();

    // Leaderboard
    leaderboard.innerHTML =
        "<b>Leaderboard</b><br>" +
        [...state.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(p => `${p.isBot ? "BOT" : "YOU"} : ${p.score}`)
            .join("<br>");

    // Minimap
    mctx.clearRect(0, 0, 150, 150);
    state.players.forEach(p => {
        mctx.fillStyle = p.skin;
        mctx.fillRect(
            75 + p.x / 70,
            75 + p.y / 70,
            3, 3
        );
    });
}

draw();

addEventListener("resize", () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
});

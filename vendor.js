class NetworkManager {
    constructor(url, onUpdate, onInit, onKillFeed) {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        
        this.onUpdate = onUpdate; 
        this.onInit = onInit;     
        this.onKillFeed = onKillFeed;
        this.inputQueue = { angle: 0, boosting: false };

        this.ws.onopen = () => {
            console.log("Connected to server successfully!");
            this.sendJoin();
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            alert("Connection error. Check console for details (F12).");
        };

        this.ws.onmessage = (event) => {
            try {
                this.handleMessage(new Uint8Array(event.data));
            } catch (e) {
                console.error("Error parsing message:", e);
            }
        };

        this.setupInput();
    }

    setupInput() {
        document.addEventListener('mousemove', (e) => {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            this.inputQueue.angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        });
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            this.inputQueue.angle = Math.atan2(e.touches[0].clientY - cy, e.touches[0].clientX - cx);
        }, {passive: false});

        const setBoost = (state) => {
            if (this.inputQueue.boosting !== state) {
                this.inputQueue.boosting = state;
                this.sendInput(PacketType.BOOST_START, state);
            }
        };
        document.addEventListener('mousedown', () => setBoost(true));
        document.addEventListener('mouseup', () => setBoost(false));
        document.addEventListener('keydown', (e) => { if(e.code === 'Space') setBoost(true); });
        document.addEventListener('keyup', (e) => { if(e.code === 'Space') setBoost(false); });
    }

    sendJoin() {
        const name = document.getElementById('nick') ? document.getElementById('nick').value : "Guest";
        const nameBytes = new TextEncoder().encode(name.substring(0, 20)); // Limit length
        const buffer = new Uint8Array(2 + nameBytes.length);
        const view = new DataView(buffer.buffer);
        view.setUint8(0, PacketType.JOIN);
        view.setUint8(1, nameBytes.length);
        buffer.set(nameBytes, 2);
        
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(buffer);
        }
    }

    sendInput(type, val) {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        const buffer = new Uint8Array(9); 
        const view = new DataView(buffer.buffer);
        view.setUint8(0, type);
        
        if (type === PacketType.INPUT) {
            view.setFloat64(1, this.inputQueue.angle, true);
        } else {
             view.setUint8(1, val ? 1 : 0);
        }
        this.ws.send(buffer);
    }

    sendCurrentInput() {
        this.sendInput(PacketType.INPUT, null);
    }

    handleMessage(data) {
        if (data.length < 1) return;
        const view = new DataView(data.buffer);
        const type = view.getUint8(0);

        if (type === PacketType.INIT) {
            if (data.length >= 5) {
                const myId = view.getUint32(1, true);
                this.onInit(myId);
            }
        } 
        else if (type === PacketType.UPDATE) {
            const state = parseUpdatePacket(data, 1);
            this.onUpdate(state);
        }
        else if (type === PacketType.KILL_FEED) {
            if (data.length > 2) {
                const killerLen = view.getUint8(1);
                if (data.length >= 2 + killerLen + 1) {
                    const victimLen = view.getUint8(2 + killerLen);
                    if (data.length >= 2 + killerLen + 1 + victimLen) {
                        const killer = new TextDecoder().decode(data.slice(2, 2 + killerLen));
                        const victim = new TextDecoder().decode(data.slice(3 + killerLen, 3 + killerLen + victimLen));
                        this.onKillFeed(killer, victim);
                    }
                }
            }
        }
    }
}

function parseUpdatePacket(data, offset) {
    if (data.length < 2) return { snakes: [], foods: [] };
    const view = new DataView(data.buffer);
    let idx = offset;
    
    const numSnakes = view.getUint16(idx, true);
    idx += 2;
    
    const snakes = [];
    
    for(let i=0; i<numSnakes; i++) {
        if (idx + 36 > data.length) break; // Safety check
        const id = view.getUint32(idx, true); idx += 4;
        const x = view.getFloat64(idx, true); idx += 8;
        const y = view.getFloat64(idx, true); idx += 8;
        const angle = view.getFloat64(idx, true); idx += 8;
        const score = view.getFloat32(idx, true); idx += 4;
        const r = view.getUint8(idx++); 
        const g = view.getUint8(idx++);
        const b = view.getUint8(idx++);
        
        if (idx + 1 > data.length) break;
        const nameLen = view.getUint8(idx++);
        if (idx + nameLen > data.length) break;
        const name = new TextDecoder().decode(data.slice(idx, idx + nameLen));
        idx += nameLen;
        
        if (idx + 2 > data.length) break;
        const bodyLen = view.getUint16(idx, true); idx += 2;
        const body = [];
        for(let j=0; j<bodyLen; j++) {
            if (idx + 16 > data.length) break;
            const bx = view.getFloat64(idx, true); idx += 8;
            const by = view.getFloat64(idx, true); idx += 8;
            body.push({x: bx, y: by});
        }
        
        snakes.push({ id, x, y, angle, score, skin: `rgb(${r},${g},${b})`, name, body });
    }
    
    if (idx + 2 > data.length) return { snakes, foods: [] };
    const numFoods = view.getUint16(idx, true); idx += 2;
    const foods = [];
    for(let i=0; i<numFoods; i++) {
        if (idx + 21 > data.length) break;
        const x = view.getFloat64(idx, true); idx += 8;
        const y = view.getFloat64(idx, true); idx += 8;
        const val = view.getFloat32(idx, true); idx += 4;
        const type = view.getUint8(idx++);
        foods.push({ x, y, val, type });
    }

    return { snakes, foods };
}

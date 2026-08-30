// Scene setup
const scene = new THREE.Scene();
// A dark, high-tech blue fog
scene.fog = new THREE.FogExp2(0x000511, 0.002);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 150;
camera.position.y = 30;
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000208, 1);
document.body.appendChild(renderer.domElement);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Variables for animation
let time = 0;

// JARVIS Color Palette
const primaryColor = 0x00ffff; // Cyan
const secondaryColor = 0x0088ff; // Deep blue
const coreColor = 0xe0ffff; // Bright cyan/white

// --- GROUP FOR ALL OBJECTS ---
const universeGroup = new THREE.Group();
scene.add(universeGroup);

// --- REACTOR CORE (Center) ---
const coreGroup = new THREE.Group();
universeGroup.add(coreGroup);

// Function to generate the high-res center UI text as a texture
function createCenterUISprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Glow behind Toby (approximate position)
    const gradient = ctx.createRadialGradient(512, 200, 0, 512, 200, 300);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)'); // Intense bright cyan/blue
    gradient.addColorStop(0.5, 'rgba(0, 100, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);

    // Title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "Bold 130px 'Courier New', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
    ctx.shadowBlur = 30;
    ctx.fillText("TOBY", 512, 450);
    ctx.fillText("WORLD", 512, 580);
    
    // Reset shadow
    ctx.shadowBlur = 0;

    // Dots (9 island colors)
    const dotColors = [
        "#ff4400", // Emberreach
        "#66ccff", // Frostveil
        "#22ff55", // Meadow
        "#33ff99", // Mossmere
        "#9933ff", // Sporegrove
        "#00ccff", // Stillwater
        "#ffcc00", // Sunfield
        "#0088ff", // ThePond
        "#cc00ff"  // Waystones
    ];
    const dotSpacing = 35;
    const startX = 512 - (dotSpacing * 4); // Centers 9 dots
    for(let i=0; i<9; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, 700, 10, 0, Math.PI * 2);
        ctx.fillStyle = dotColors[i];
        ctx.shadowColor = dotColors[i];
        ctx.shadowBlur = 15;
        ctx.fill();
    }
    
    // Stats
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(122, 180, 255, 0.5)";
    ctx.font = "Bold 24px 'Courier New', monospace";
    ctx.fillStyle = "#7ab4ff";
    ctx.fillText("BACKGROUND 4 · CORE 6 · KEEPER 3 · LAND 9 · RELIC 6", 512, 800);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(58, 58, 1);
    sprite.position.z = 25;
    return sprite;
}

const centerUISprite = createCenterUISprite();
coreGroup.add(centerUISprite);

const tobyTexture = textureLoader.load('public/Toby.png');
const tobyMat = new THREE.SpriteMaterial({ map: tobyTexture, transparent: true });
const tobySprite = new THREE.Sprite(tobyMat);
tobySprite.scale.set(29, 29, 1);
  tobySprite.position.z = 25; // 200% bigger
tobySprite.userData = { isCenterToby: true };
tobySprite.position.y = 23; // Adjusted upwards to clear text
coreGroup.add(tobySprite);

// Blue neon reactor highlight layer directly on Toby
const tobyNeonMat = new THREE.SpriteMaterial({ 
    map: tobyTexture, 
    transparent: true, 
    color: 0x00ffff, // Tint cyan
    blending: THREE.AdditiveBlending,
    opacity: 0.7
});
const tobyNeonSprite = new THREE.Sprite(tobyNeonMat);
tobyNeonSprite.scale.set(30, 30, 1);
  tobyNeonSprite.position.z = 24.5; // Slightly larger to create an outer glow/highlight
tobyNeonSprite.position.y = 23;
coreGroup.add(tobyNeonSprite);
// --- FUTURISTIC TOBYWORLD REACTOR CORE ---
const rings = []; // Animation tracking array
const reactorGroup = new THREE.Group();
reactorGroup.position.y = 12; // Center behind Toby
reactorGroup.position.z = -15; // Set deep enough so Toby (z=0) is in front, and islands orbit around it
coreGroup.add(reactorGroup);

// 1. Central Core Nucleus (Inner Hot Core)
const nucleusGeo = new THREE.SphereGeometry(10, 32, 32);
const nucleusMat = new THREE.MeshBasicMaterial({ 
    color: 0xe0ffff, // Hot cyan-white
    transparent: true, 
    opacity: 0.9, 
    blending: THREE.AdditiveBlending 
});
const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
reactorGroup.add(nucleusMesh);

// 2. Swirling Plasma Surface (Outer Sphere Shader)
const swirlShader = {
    uniforms: { time: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float t = time * 0.8;
            
            // Complex dimensional plasma noise
            float swirl1 = sin(p.x * 5.0 + t) * cos(p.y * 5.0 + t);
            float swirl2 = sin(p.x * 3.0 - t * 1.5 + p.y * 3.0);
            float swirl3 = cos(p.x * 4.0 + p.y * 4.0 - t);
            
            // Colors
            vec3 baseCol = vec3(0.05, 0.1, 0.9); // Deep space blue
            vec3 colCyan = vec3(0.0, 0.8, 1.0);  // Cyan highlights
            vec3 colPurple = vec3(0.5, 0.0, 1.0); // Purple energy
            vec3 colRed = vec3(1.0, 0.1, 0.2); // Red plasma
            vec3 colGreen = vec3(0.0, 1.0, 0.5); // Green wisps
            
            float maskCyan = pow((sin(swirl1 * 3.0) + 1.0) * 0.5, 2.0);
            float maskPurple = pow((cos(swirl2 * 3.0) + 1.0) * 0.5, 2.5);
            float maskRed = pow((sin(swirl3 * 3.0 + swirl1) + 1.0) * 0.5, 4.0);
            float maskGreen = pow((cos(swirl1 * 4.0 + swirl3) + 1.0) * 0.5, 6.0);
            
            vec3 col = baseCol;
            col = mix(col, colCyan, maskCyan);
            col = mix(col, colPurple, maskPurple);
            col = mix(col, colRed, maskRed);
            col = mix(col, colGreen, maskGreen);
            
            gl_FragColor = vec4(col, 1.0);
        }
    `
};
const plasmaGeo = new THREE.SphereGeometry(16, 64, 64);
const plasmaMat = new THREE.ShaderMaterial({
    uniforms: swirlShader.uniforms,
    vertexShader: swirlShader.vertexShader,
    fragmentShader: swirlShader.fragmentShader,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending, // Glow effect
    depthWrite: false // Allow particles/nucleus inside to render
});
const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
plasmaMesh.onBeforeRender = () => { plasmaMat.uniforms.time.value += 0.003; };
reactorGroup.add(plasmaMesh);

// 3. Containment Field Rings (3D Orbital Planes)
function createContainmentRing(radius, tube, color, rotX, rotY, rotZ, speedX, speedY, speedZ) {
    const geo = new THREE.TorusGeometry(radius, tube, 4, 100);
    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.4, 
        blending: THREE.AdditiveBlending 
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(rotX, rotY, rotZ);
    reactorGroup.add(mesh);
    mesh.userData = { rx: speedX, ry: speedY, rz: speedZ };
    rings.push(mesh);
}
// Create intersecting dimensional planes
createContainmentRing(22, 0.2, 0x00ffff, Math.PI/2, 0, 0, 0, 0, 0.004); // Cyan Horizontal
createContainmentRing(26, 0.1, 0x0088ff, Math.PI/3, Math.PI/4, 0, 0.002, 0.003, 0); // Blue Tilted
createContainmentRing(30, 0.15, 0x9900ff, -Math.PI/6, 0, Math.PI/8, -0.001, 0.002, 0); // Purple Vertical
createContainmentRing(34, 0.05, 0x00ff88, 0, Math.PI/3, 0, 0, 0.001, 0.003); // Green Outer

// 4. Energy Spiral / Vortex
const vortexGeo = new THREE.CylinderGeometry(20, 0, 40, 32, 1, true);
const vortexMat = new THREE.MeshBasicMaterial({
    color: 0x0044ff,
    transparent: true,
    opacity: 0.05,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
});
const vortex1 = new THREE.Mesh(vortexGeo, vortexMat);
vortex1.rotation.x = Math.PI / 2;
reactorGroup.add(vortex1);
vortex1.userData = { rx: 0, ry: 0, rz: 0.005 };
rings.push(vortex1);
const vortex2 = new THREE.Mesh(vortexGeo, vortexMat);
vortex2.rotation.x = -Math.PI / 2;
reactorGroup.add(vortex2);
vortex2.userData = { rx: 0, ry: 0, rz: -0.005 };
rings.push(vortex2);

// 5. Particles orbiting the core
const particleCount = 400;
const particleGeo = new THREE.BufferGeometry();
const particlePos = new Float32Array(particleCount * 3);
for(let i=0; i<particleCount; i++) {
    const r = 18 + Math.random() * 20; // Spread between r=18 and r=38
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos((Math.random() * 2) - 1);
    particlePos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    particlePos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    particlePos[i*3+2] = r * Math.cos(phi);
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
const particleMat = new THREE.PointsMaterial({
    color: 0x88ccff,
    size: 0.8,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending
});
const particleSystem = new THREE.Points(particleGeo, particleMat);
reactorGroup.add(particleSystem);
particleSystem.userData = { rx: 0.001, ry: 0.0015, rz: 0.001 };
rings.push(particleSystem);

// 6. Toby Backlight / Halo Glow
const haloCanvas = document.createElement('canvas');
haloCanvas.width = 128; haloCanvas.height = 128;
const haloCtx = haloCanvas.getContext('2d');
const haloGrad = haloCtx.createRadialGradient(64,64,0, 64,64,64);
haloGrad.addColorStop(0, '#00aaff');
haloGrad.addColorStop(0.4, '#0055ff');
haloGrad.addColorStop(1, '#000000');
haloCtx.fillStyle = haloGrad;
haloCtx.fillRect(0,0,128,128);
const tobyHaloMat = new THREE.SpriteMaterial({ 
    map: new THREE.CanvasTexture(haloCanvas), 
    transparent: true, 
    blending: THREE.AdditiveBlending, 
    opacity: 0.7 
});
const tobyHalo = new THREE.Sprite(tobyHaloMat);
tobyHalo.scale.set(50, 50, 1);
tobyHalo.position.set(0, 23, 24); // Behind Toby but in front of reactor
coreGroup.add(tobyHalo);
// --- HELPER: TEXT SPRITE FOR LABELS ---
function createTextLabel(text, colorHex) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.font = "Bold 24px Courier New, monospace";
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = colorHex;
    context.textAlign = "center";
    context.textBaseline = "middle";
    // Add a glow effect to text matching its aura
    context.shadowColor = colorHex;
    context.shadowBlur = 10;
    
    // Format "ThePond" -> "THE POND" nicely
    let displayName = text.toUpperCase();
    if (text === "ThePond") displayName = "THE POND";
    
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(30, 7.5, 1); // Scale it nicely
    return sprite;
}

// --- HELPER: AURA GLOW ---
function createAura(colorHex) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    
    // Radial gradient from color to black (black is transparent in additive blending)
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, colorHex);
    gradient.addColorStop(0.3, colorHex);
    gradient.addColorStop(1, '#000000');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.25
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(32, 32, 1); // Larger than the island to form an aura
    return sprite;
}


// --- 9 LORELANDS (Floating Islands) ---
const lorelandsGroup = new THREE.Group();
universeGroup.add(lorelandsGroup);

const islandDataMap = [
    { name: "Emberreach", color: "#ff4400", count: 150 },
    { name: "Frostveil", color: "#66ccff", count: 125 },
    { name: "Meadow", color: "#22ff55", count: 200 },
    { name: "Mossmere", color: "#33ff99", count: 175 },
    { name: "Sporegrove", color: "#9933ff", count: 90 },
    { name: "Stillwater", color: "#00ccff", count: 210 },
    { name: "Sunfield", color: "#ffcc00", count: 180 },
    { name: "ThePond", color: "#0088ff", count: 140 },
    { name: "Waystones", color: "#cc00ff", count: 230 }
];

const numLorelands = islandDataMap.length;
const orbitRadius = 65;
const lorelands = [];

for (let i = 0; i < numLorelands; i++) {
    const island = islandDataMap[i];
    const islandName = island.name;
    const colorHex = island.color;
    
    // Create a group for the island + its label so they move together
    const islandGroup = new THREE.Group();
    
    // 1. Create and add the Aura behind the island
    const auraSprite = createAura(colorHex);
    auraSprite.position.z = -1; // Push it slightly back so it doesn't overlap front textures
    islandGroup.add(auraSprite);

    // 2. Load the island PNG as a sprite
    const texture = textureLoader.load(`public/${islandName}.png`);
    const islandMat = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true, 
        alphaTest: 0.5, // Discards transparent pixels, making the visible part completely solid
        depthWrite: true // Ensures it blocks objects behind it
    });
    const islandSprite = new THREE.Sprite(islandMat);
    islandSprite.scale.set(33, 33, 1); // Increased size by another 50%
    islandSprite.userData = { isIsland: true, name: islandName, color: colorHex }; // For raycasting
    islandGroup.add(islandSprite);
    
    // 3. Create the colored text label below it
    const labelSprite = createTextLabel(islandName, colorHex);
    labelSprite.position.y = -16; // Moved down further for the much larger island
    islandGroup.add(labelSprite);
    
    // Perfectly even spacing
    const angle = (i / numLorelands) * Math.PI * 2;
    
    // Staggered vertical starting positions (forming a slight wave)
    const yOffset = Math.sin(angle * 2) * 15;
    
    const lorelandData = {
        group: islandGroup,
        baseAngle: angle,
        distance: orbitRadius,
        yOffset: yOffset,
        floatSpeed: 0.015 + Math.random() * 0.01,
        timeOffset: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.005,
        driftSize: 4 + Math.random() * 4
    };
    
    lorelandsGroup.add(islandGroup);
    lorelands.push(lorelandData);
}

// Make the 3D Canvas accessible
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'An interactive 3D solar system of TobyWorld lore lands orbiting a central reactor core.');


// --- GRID / BACKGROUND SCANLINES (Optional Space Dust) ---
const dustGeo = new THREE.BufferGeometry();
const dustCount = 1000;
const dustPos = new Float32Array(dustCount * 3);
for(let i=0; i < dustCount * 3; i++) {
    dustPos[i] = (Math.random() - 0.5) * 400;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
    color: primaryColor,
    size: 0.5,
    transparent: true,
    opacity: 0.4
});
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    time += 1;
    
    // Gentle hover for Toby and Center UI
    const tobyY = 23 + Math.sin(time * 0.03) * 1.5;
    tobySprite.position.y = tobyY;
    tobyNeonSprite.position.y = tobyY;
    
    // Pulse the neon highlights with the reactor frequency
    tobyNeonSprite.material.opacity = 0.5 + Math.sin(time * 0.08) * 0.3;
    
    centerUISprite.position.y = Math.sin(time * 0.03 + 0.5) * 0.5;

    // Rotate rings
    rings.forEach(ring => {
        ring.rotation.x += ring.userData.rx;
        ring.rotation.y += ring.userData.ry;
        ring.rotation.z += ring.userData.rz;
    });

    // Orbit lorelands globally (keeps them evenly spaced)
    lorelandsGroup.rotation.y += 0.003;

    // Dynamic local floating for each loreland
    lorelands.forEach(l => {
        // Base position based on their fixed angle in the group
        const globalAngle = l.baseAngle + lorelandsGroup.rotation.y;
        const baseX = Math.cos(l.baseAngle) * l.distance;
        const baseZ = Math.sin(l.baseAngle) * l.distance;
        
        // Add dynamic drifting on X and Z axis for a more organic float
        const driftX = Math.cos(time * l.wobbleSpeed + l.timeOffset) * l.driftSize;
        const driftZ = Math.sin(time * l.wobbleSpeed + l.timeOffset) * l.driftSize;
        
        // Complex vertical bobbing (combining two sine waves)
        const floatY = Math.sin(time * l.floatSpeed + l.timeOffset) * 6 + 
                       Math.cos(time * l.floatSpeed * 1.5) * 2;

        l.group.position.x = baseX + driftX;
        l.group.position.z = baseZ + driftZ;
        l.group.position.y = l.yOffset + floatY;
        
        // --- 3D Depth Parallax Effect ---
        // World Z goes from roughly -65 (deep background) to +65 (extreme foreground)
        const worldZ = Math.sin(globalAngle) * l.distance;
        const depthFactor = (worldZ + l.distance) / (l.distance * 2); // 0 (back) to 1 (front)
        
        // Scale: Smaller in the back, larger in the front
        const targetScale = 0.6 + (depthFactor * 0.6); // Ranges from 0.6 to 1.2
        l.group.scale.set(targetScale, targetScale, 1);
        
        // Brightness & Opacity: Dimmer/blurrier in the back, bright in the front
        l.group.children.forEach(child => {
            if (child.material) {
                if (child.userData && child.userData.isIsland) {
                    // Darken the island texture if it's behind the reactor
                    const brightness = 0.4 + (depthFactor * 0.6); // 0.4 to 1.0
                    child.material.color.setRGB(brightness, brightness, brightness);
                } else {
                    // Soften the aura and text label in the background
                    child.material.opacity = 0.2 + (depthFactor * 0.8);
                }
            }
        });
    });

    // Slow global rotation for the whole universe
    universeGroup.rotation.y += 0.001;

    renderer.render(scene, camera);
}

// --- RAYCASTER (CLICK MECHANICS) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerup', (event) => {
    // Prevent 3D clicks if the wallet modal is open or if clicking on the UI
    const modal = document.getElementById('wallet-modal');
    if ((modal && modal.style.display === 'flex') || event.target.closest('#wallet-modal')) {
        return;
    }

    // Convert pointer position to normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast from camera to pointer
    raycaster.setFromCamera(mouse, camera);

    // Get all interactive objects
    const interactiveObjects = [tobySprite];
    lorelandsGroup.children.forEach(group => {
        group.children.forEach(child => {
            if (child.userData && child.userData.isIsland) {
                interactiveObjects.push(child);
            }
        });
    });

    const intersects = raycaster.intersectObjects(interactiveObjects);
    if (intersects.length > 0) {
        const clickedData = intersects[0].object.userData;
        if (clickedData.isCenterToby) {
            document.getElementById('wallet-modal').style.display = 'flex';
        } else if (clickedData.isIsland) {
            openDeedRegistry(clickedData.name, clickedData.color);
        }
    }
});

// Remove openDeedRegistry and replace with redirect
function openDeedRegistry(islandName, color) {
    // Redirect to the dedicated land page instead of showing a popup
    // Encode the color to pass it safely in the URL (e.g. #ff0000 -> %23ff0000)
    const encodedColor = encodeURIComponent(color);
    window.location.href = `land.html?island=${islandName}&color=${encodedColor}`;
}

// Window resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();

// --- WALLET AND MODAL LOGIC ---
const modal = document.getElementById('wallet-modal');
const closeBtn = document.getElementById('close-modal-btn');
const connectBtn = document.getElementById('connect-wallet-btn');
const walletInfo = document.getElementById('wallet-info');
const walletAddressSpan = document.getElementById('wallet-address');
const networkStatusSpan = document.getElementById('network-status');

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_ID_HEX = '0x2105';

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert("No web3 wallet detected. Please install MetaMask, Coinbase Wallet, or Rabby.");
        return;
    }

    try {
        connectBtn.innerText = "CONNECTING...";
        
        // Request account access
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        
        if (accounts.length > 0) {
            const address = accounts[0];
            const network = await provider.getNetwork();
            
            // Format address: 0x1234...5678
            const shortAddress = address.slice(0, 6) + "..." + address.slice(-4);
            walletAddressSpan.innerText = shortAddress;
            
            // Check if on Base Network
            if (Number(network.chainId) !== BASE_CHAIN_ID) {
                networkStatusSpan.innerText = "WRONG NETWORK";
                networkStatusSpan.style.color = "#ff3333";
                await promptSwitchToBase();
            } else {
                networkStatusSpan.innerText = "BASE";
                networkStatusSpan.style.color = "#00ff88";
            }

            // Update UI
            connectBtn.style.display = 'none';
            walletInfo.style.display = 'block';

            // --- FETCH BALANCES ---
            const erc20Abi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function decimals() view returns (uint8)"
            ];

            const erc721Abi = [
                "function balanceOf(address owner) view returns (uint256)"
            ];

            const tokens = {
                toby: { address: "0xb8D98a102b0079B69FFbc760C8d857A31653e56e", element: document.getElementById('bal-toby'), type: 'erc20' },
                taboshi: { address: "0x3A1a33cf4553Db61F0db2c1e1721CD480b02789f", element: document.getElementById('bal-taboshi'), type: 'erc20' },
                patience: { address: "0x6d96f18f00b815b2109a3766e79f6a7ad7785624", element: document.getElementById('bal-patience'), type: 'erc20' },
                lorelands: { address: "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A", element: document.getElementById('bal-lorelands'), type: 'erc721' }
            };

            const formatNumber = (num) => {
                if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
                if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
                if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
                return num.toFixed(2);
            };

            for (const [key, token] of Object.entries(tokens)) {
                try {
                    if (token.type === 'erc20') {
                        const contract = new ethers.Contract(token.address, erc20Abi, provider);
                        const decimals = await contract.decimals();
                        const balance = await contract.balanceOf(address);
                        const formattedBal = parseFloat(ethers.formatUnits(balance, decimals));
                        token.element.innerText = formatNumber(formattedBal);
                    } else if (token.type === 'erc721') {
                        const contract = new ethers.Contract(token.address, erc721Abi, provider);
                        const balance = await contract.balanceOf(address);
                        token.element.innerText = balance.toString();
                    }
                } catch (e) {
                    console.error(`Failed to fetch balance for ${key}:`, e);
                    token.element.innerText = "ERROR";
                }
            }
        }
    } catch (error) {
        console.error("Wallet connection failed:", error);
        connectBtn.innerText = "CONNECT WALLET";
    }
}

async function promptSwitchToBase() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
        });
        networkStatusSpan.innerText = "BASE";
        networkStatusSpan.style.color = "#00ff88";
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: BASE_CHAIN_ID_HEX,
                            chainName: 'Base',
                            rpcUrls: ['https://mainnet.base.org'],
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://basescan.org']
                        }
                    ],
                });
                networkStatusSpan.innerText = "BASE";
                networkStatusSpan.style.color = "#00ff88";
            } catch (addError) {
                console.error("Failed to add Base network", addError);
            }
        }
    }
}

connectBtn.addEventListener('click', connectWallet);

if (window.ethereum) {
    window.ethereum.on('chainChanged', () => window.location.reload());
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            window.location.reload();
        } else {
            walletAddressSpan.innerText = accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4);
        }
    });
}

// End of script


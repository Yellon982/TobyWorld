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
    // Add a very strong neon glow effect to text
    context.shadowColor = colorHex;
    context.shadowBlur = 15;
    
    // Format "ThePond" -> "THE POND" nicely
    let displayName = text.toUpperCase();
    if (text === "ThePond") displayName = "THE POND";
    
    // Draw multiple times for an intense bloom effect
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);
    context.shadowBlur = 5;
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true
    });
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
    
    // Radial gradient from color to transparent black
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    // Tighter falloff for a more controlled glow
    gradient.addColorStop(0, colorHex);
    gradient.addColorStop(0.5, colorHex);
    gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Transparent for NormalBlending
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        blending: THREE.NormalBlending, // Fix washout of background islands
        opacity: 0.5, // Softer opacity since it's normal blending
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(40, 40, 1);
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
    auraSprite.position.z = -0.1; // Push it just slightly back to prevent z-fighting without perspective uncentering
    islandGroup.add(auraSprite);

    // 2. Load the island PNG as a sprite
    const texture = textureLoader.load(`public/${islandName}.png`);
    const islandMat = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: false, // Opaque cutout prevents transparency sorting issues
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
        
        // Removed brightness and opacity adjustments to keep islands solid and fully glowing
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


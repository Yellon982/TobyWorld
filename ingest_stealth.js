const fs = require('fs');
const path = require('path');

const TOTAL_TOKENS = 2869;
const IPFS_CID = 'QmePpWhx8kmPJZBsQwP1bYQxJAdFUorE59ARtCUxew2ZRV';
const DATA_DIR = path.join(__dirname, 'data');
const LANDS_FILE = path.join(DATA_DIR, 'lands.json');
const FAILED_FILE = path.join(DATA_DIR, 'failed.json');

const GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
];

if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR); }

let landsData = {};
if (fs.existsSync(LANDS_FILE)) {
    try { landsData = JSON.parse(fs.readFileSync(LANDS_FILE, 'utf8')); } catch (e) {}
}

let failedTokens = [];
if (fs.existsSync(FAILED_FILE)) {
    try { failedTokens = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8')); } catch (e) {}
}

async function fetchWithFallback(tokenId) {
    for (let i = 0; i < GATEWAYS.length; i++) {
        const gateway = GATEWAYS[i];
        const url = gateway + IPFS_CID + '/' + tokenId;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                data.tokenId = tokenId;
                data.gateway_image_url = gateway + data.image.replace('ipfs://', '');
                landsData[tokenId] = data;
                console.log('[SUCCESS] Token ' + tokenId);
                return;
            }
        } catch (e) {
            // timeout or abort, try next
        }
    }
    console.error('[ERROR] Token ' + tokenId + ': All gateways failed');
}

async function run() {
    console.log('Starting STEALTH ingestion...');
    let tokensToFetch = [];
    for (let i = 1; i <= TOTAL_TOKENS; i++) {
        if (!landsData[i]) tokensToFetch.push(i);
    }
    
    console.log('Remaining: ' + tokensToFetch.length);
    for (let i = 0; i < tokensToFetch.length; i++) {
        await fetchWithFallback(tokensToFetch[i]);
        fs.writeFileSync(LANDS_FILE, JSON.stringify(landsData, null, 2));
        await new Promise(r => setTimeout(r, 4000));
    }
}
run();

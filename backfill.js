const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

const CONTRACT_ADDRESS = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';
const RPC_URL = 'https://mainnet.base.org';

const DATA_DIR = path.join(__dirname, 'data');
const LANDS_FILE = path.join(DATA_DIR, 'lands.json');

const GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
];

let landsData = {};
if (fs.existsSync(LANDS_FILE)) {
    try { landsData = JSON.parse(fs.readFileSync(LANDS_FILE, 'utf8')); } catch (e) {}
}

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

const abi = [
    "function tokenURI(uint256 tokenId) view returns (string)",
];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

async function fetchIPFSData(uri, tokenId) {
    if (!uri) return false;
    
    let cidPath = uri;
    if (uri.startsWith('ipfs://')) {
        cidPath = uri.replace('ipfs://', '');
    }
    
    for (let i = 0; i < GATEWAYS.length; i++) {
        const gateway = GATEWAYS[i];
        const url = gateway + cidPath;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                data.tokenId = tokenId;
                if (data.image && data.image.startsWith('ipfs://')) {
                    data.gateway_image_url = gateway + data.image.replace('ipfs://', '');
                }
                if (Array.isArray(data.attributes)) {
                    const flatAttrs = {};
                    data.attributes.forEach(attr => {
                        if (attr.trait_type && attr.value) {
                            flatAttrs[attr.trait_type] = attr.value;
                        }
                    });
                    data.attributes = flatAttrs;
                }
                landsData[tokenId] = data;
                console.log(`[SUCCESS] Token ${tokenId} fetched from IPFS`);
                return true;
            }
        } catch (e) {
            // try next
        }
    }
    console.error(`[ERROR] Token ${tokenId}: All gateways failed for URI ${uri}`);
    return false;
}

async function run() {
    console.log('Starting backfill for missing Lore Lands tokens...');
    
    let missing = [];
    for (let i = 1; i <= 2869; i++) {
        if (!landsData[i]) {
            missing.push(i);
        }
    }
    
    console.log(`Found ${missing.length} missing tokens.`);
    
    for (const tokenId of missing) {
        try {
            const uri = await contract.tokenURI(tokenId);
            const success = await fetchIPFSData(uri, tokenId);
            if (success) {
                fs.writeFileSync(LANDS_FILE, JSON.stringify(landsData, null, 2));
            }
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.error(`Error processing token ${tokenId}:`, e.message);
        }
    }
    console.log('Backfill complete.');
}

run();

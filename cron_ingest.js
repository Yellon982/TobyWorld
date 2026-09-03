const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

const CONTRACT_ADDRESS = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';
const RPC_URL = 'https://mainnet.base.org';

const DATA_DIR = path.join(__dirname, 'data');
const LANDS_FILE = path.join(DATA_DIR, 'lands.json');
const STATE_FILE = path.join(DATA_DIR, 'cron_state.json');

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

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

// Event Signatures
const TRANSFER_EVENT = ethers.id('Transfer(address,address,uint256)');
const METADATA_UPDATE_EVENT = ethers.id('MetadataUpdate(uint256)');
const BATCH_METADATA_UPDATE_EVENT = ethers.id('BatchMetadataUpdate(uint256,uint256)');

const abi = [
    "function tokenURI(uint256 tokenId) view returns (string)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event MetadataUpdate(uint256 _tokenId)",
    "event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId)"
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

async function runCronJob() {
    console.log('Starting blockchain sync for Lore Lands...');
    let state = { last_processed_block: 50150000, max_minted_id: 0 };
    if (fs.existsSync(STATE_FILE)) {
        try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
    }
    
    if (!state.max_minted_id) state.max_minted_id = 0;

    let currentBlock;
    try {
        currentBlock = await provider.getBlockNumber();
    } catch (e) {
        console.error('Failed to fetch current block:', e.message);
        return;
    }
    
    const startBlock = state.last_processed_block + 1;
    if (startBlock > currentBlock) {
        console.log('Already up to date.');
        return;
    }
    
    console.log(`Fetching logs from block ${startBlock} to ${currentBlock}...`);
    
    // Map of tokenId -> boolean (true if metadata was explicitly updated via EIP-4906, false if just minted)
    const tokenUpdates = new Map();
    
    for (let i = startBlock; i <= currentBlock; i += 10000) {
        const toBlock = Math.min(i + 9999, currentBlock);
        
        try {
            const logs = await provider.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: i,
                toBlock: toBlock,
                topics: [[TRANSFER_EVENT, METADATA_UPDATE_EVENT, BATCH_METADATA_UPDATE_EVENT]]
            });
            
            for (const log of logs) {
                const topic0 = log.topics[0];
                if (topic0 === TRANSFER_EVENT) {
                    // Check if it's a mint (from == 0x0)
                    const from = ethers.getAddress(ethers.dataSlice(log.topics[1], 12));
                    if (from === ethers.ZeroAddress) {
                        const tokenId = parseInt(log.topics[3], 16);
                        if (tokenId > state.max_minted_id) {
                            state.max_minted_id = tokenId;
                        }
                        if (!tokenUpdates.has(tokenId)) {
                            tokenUpdates.set(tokenId, false); // Just minted
                        }
                    }
                } else if (topic0 === METADATA_UPDATE_EVENT) {
                    const decoded = contract.interface.decodeEventLog('MetadataUpdate', log.data, log.topics);
                    tokenUpdates.set(Number(decoded[0]), true); // Explicitly updated
                } else if (topic0 === BATCH_METADATA_UPDATE_EVENT) {
                    const decoded = contract.interface.decodeEventLog('BatchMetadataUpdate', log.data, log.topics);
                    const fromId = Number(decoded[0]);
                    let toId = Number(decoded[1]);
                    
                    // Cap toId to max_minted_id to avoid infinite loops if contract uses type(uint256).max
                    if (toId > state.max_minted_id) {
                        toId = state.max_minted_id;
                    }
                    
                    for (let id = fromId; id <= toId; id++) {
                        tokenUpdates.set(id, true); // Explicitly updated
                    }
                }
            }
        } catch (e) {
            console.error(`Error fetching logs for range ${i}-${toBlock}:`, e.message);
            return;
        }
    }
    
    if (tokenUpdates.size === 0) {
        console.log('No new mints or metadata updates found.');
        state.last_processed_block = currentBlock;
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
        return;
    }
    
    console.log(`Found ${tokenUpdates.size} tokens with potential updates.`);
    
    // Sort keys for predictable processing
    const sortedTokenIds = Array.from(tokenUpdates.keys()).sort((a,b)=>a-b);
    let processedCount = 0;

    for (const tokenId of sortedTokenIds) {
        const isExplicitUpdate = tokenUpdates.get(tokenId);
        
        // Skip if we already have it AND it wasn't explicitly updated
        if (landsData[tokenId] && !isExplicitUpdate) {
            continue;
        }
        
        try {
            const uri = await contract.tokenURI(tokenId);
            const success = await fetchIPFSData(uri, tokenId);
            if (success) {
                fs.writeFileSync(LANDS_FILE, JSON.stringify(landsData, null, 2));
                processedCount++;
            }
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`Error processing token ${tokenId}:`, e.message);
        }
    }
    
    state.last_processed_block = currentBlock;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    console.log(`Sync complete up to block ${currentBlock}. Processed ${processedCount} new/updated tokens.`);
}

let isRunning = false;
async function run() {
    if (isRunning) return;
    isRunning = true;
    try {
        await runCronJob();
    } catch (e) {
        console.error("Cron job error:", e);
    }
    isRunning = false;
}

setInterval(run, 10 * 60 * 1000);
run();

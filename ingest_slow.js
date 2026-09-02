const fs = require('fs');
const path = require('path');

const TOTAL_TOKENS = 2869;
const IPFS_CID = "QmePpWhx8kmPJZBsQwP1bYQxJAdFUorE59ARtCUxew2ZRV";
const DATA_DIR = path.join(__dirname, 'data');
const LANDS_FILE = path.join(DATA_DIR, 'lands.json');
const FAILED_FILE = path.join(DATA_DIR, 'failed.json');
const CONCURRENCY = 1; // Concurrent requests

// Gateway list sorted by reliability for this specific metadata
const GATEWAYS = [
    `https://gateway.pinata.cloud/ipfs/`,
    `https://ipfs.io/ipfs/`,
    `https://dweb.link/ipfs/`,
    `https://cloudflare-ipfs.com/ipfs/`
];

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Load existing data to resume
let landsData = {};
if (fs.existsSync(LANDS_FILE)) {
    try {
        landsData = JSON.parse(fs.readFileSync(LANDS_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to parse lands.json, starting fresh.");
    }
}

let failedTokens = [];
if (fs.existsSync(FAILED_FILE)) {
    try {
        failedTokens = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
    } catch (e) {
        // Ignore
    }
}

async function fetchWithFallback(tokenId) {
    for (let i = 0; i < GATEWAYS.length; i++) {
        const gateway = GATEWAYS[i];
        const url = `${gateway}${IPFS_CID}/${tokenId}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout per gateway
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            // Silently try next gateway
        }
    }
    throw new Error(`All gateways failed for token ${tokenId}`);
}

function normalizeImage(ipfsUri) {
    if (!ipfsUri) return null;
    if (ipfsUri.startsWith('ipfs://')) {
        const cidPath = ipfsUri.replace('ipfs://', '');
        return `https://gateway.pinata.cloud/ipfs/${cidPath}`;
    }
    return ipfsUri;
}

function processAttributes(attributesArr) {
    const attrObj = {};
    if (Array.isArray(attributesArr)) {
        attributesArr.forEach(attr => {
            if (attr.trait_type && attr.value) {
                attrObj[attr.trait_type] = attr.value;
            }
        });
    }
    return attrObj;
}

async function ingestToken(tokenId) {
    if (landsData[tokenId]) {
        return; // Already ingested
    }
    
    try {
        const rawData = await fetchWithFallback(tokenId);
        
        // Transform the data
        const processed = {
            tokenId: tokenId,
            name: rawData.name,
            description: rawData.description,
            image: rawData.image,
            gateway_image_url: normalizeImage(rawData.image),
            external_url: rawData.external_url,
            attributes: processAttributes(rawData.attributes)
        };
        
        landsData[tokenId] = processed;
        console.log(`[SUCCESS] Token ${tokenId}`);
    } catch (error) {
        console.error(`[ERROR] Token ${tokenId}: ${error.message}`);
        failedTokens.push(tokenId);
    }
}

async function run() {
    console.log(`Starting ingestion of ${TOTAL_TOKENS} tokens...`);
    const startTime = Date.now();
    let tokensToProcess = [];
    
    for (let i = 1; i <= TOTAL_TOKENS; i++) {
        if (!landsData[i]) {
            tokensToProcess.push(i);
        }
    }
    
    console.log(`Tokens remaining to ingest: ${tokensToProcess.length}`);
    
    // Process in batches (concurrency limit)
    for (let i = 0; i < tokensToProcess.length; i += CONCURRENCY) {
        const batch = tokensToProcess.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(tokenId => ingestToken(tokenId)));
        
        // Save progress after each batch
        fs.writeFileSync(LANDS_FILE, JSON.stringify(landsData, null, 2));
        fs.writeFileSync(FAILED_FILE, JSON.stringify(failedTokens, null, 2));
    }
    
    const timeTaken = (Date.now() - startTime) / 1000;
    const successCount = Object.keys(landsData).length;
    
    console.log("=========================================");
    console.log("INGESTION REPORT");
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failedTokens.length}`);
    console.log(`Time taken: ${timeTaken.toFixed(2)} seconds`);
    console.log("=========================================");
}

run();

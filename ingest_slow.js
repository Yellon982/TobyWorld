const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));
const DATA_DIR = path.join(__dirname, 'data');
const LANDS_FILE = path.join(DATA_DIR, 'lands.json');
const FAILED_FILE = path.join(DATA_DIR, 'failed.json');
const IPFS_CID = 'QmePpWhx8kmPJZBsQwP1bYQxJAdFUorE59ARtCUxew2ZRV';
const GATEWAYS = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/'];

let landsData = JSON.parse(fs.readFileSync(LANDS_FILE, 'utf8'));
let failedTokens = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
    let stillFailed = [];
    console.log('Processing ' + failedTokens.length + ' failed tokens sequentially...');
    for (const tokenId of failedTokens) {
        if (landsData[tokenId]) continue;
        let success = false;
        for (const gateway of GATEWAYS) {
            try {
                const res = await fetch(gateway + IPFS_CID + '/' + tokenId);
                if (res.ok) {
                    const data = await res.json();
                    data.tokenId = tokenId;
                    data.gateway_image_url = gateway + data.image.replace('ipfs://', '');
                    const processed = {
                        tokenId: tokenId,
                        name: data.name,
                        description: data.description,
                        image: data.image,
                        gateway_image_url: data.gateway_image_url,
                        external_url: data.external_url,
                        attributes: {}
                    };
                    if (data.attributes) {
                        data.attributes.forEach(attr => { if (attr.trait_type && attr.value) processed.attributes[attr.trait_type] = attr.value; });
                    }
                    landsData[tokenId] = processed;
                    console.log('[SUCCESS] ' + tokenId);
                    success = true;
                    break;
                } else if (res.status === 404) {
                    console.log('[SKIPPED 404] ' + tokenId);
                    success = true;
                    break;
                }
            } catch (e) {}
            await delay(1000); // 1s delay between gateway retries
        }
        if (!success) {
            console.log('[FAILED] ' + tokenId);
            stillFailed.push(tokenId);
        }
        await delay(1000); // 1s delay between tokens
        fs.writeFileSync(LANDS_FILE, JSON.stringify(landsData, null, 2));
    }
    fs.writeFileSync(FAILED_FILE, JSON.stringify(stillFailed, null, 2));
    console.log('Done.');
}
run();

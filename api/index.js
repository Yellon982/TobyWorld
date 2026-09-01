const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Note: __dirname in Vercel for api/index.js is the api folder, so go up one level
const DATA_FILE = path.join(__dirname, '..', 'data', 'lands.json');

app.use(cors());
app.use(express.json());

// Utility to read data and calculate statistical rarity
function getLandsData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const traitsCount = {};
        let totalLands = 0;
        
        // Count trait occurrences
        for (const key in data) {
            totalLands++;
            const attrs = data[key].attributes;
            if (attrs) {
                for (const [traitType, traitValue] of Object.entries(attrs)) {
                    if (!traitsCount[traitType]) traitsCount[traitType] = {};
                    if (!traitsCount[traitType][traitValue]) traitsCount[traitType][traitValue] = 0;
                    traitsCount[traitType][traitValue]++;
                }
            }
        }
        
        // Calculate rarity scores and percentages
        const scores = [];
        for (const key in data) {
            const attrs = data[key].attributes;
            data[key].rarity = {};
            let totalRarityScore = 0;
            
            if (attrs) {
                for (const [traitType, traitValue] of Object.entries(attrs)) {
                    const count = traitsCount[traitType][traitValue];
                    const percentage = count / totalLands;
                    data[key].rarity[traitType] = (percentage * 100).toFixed(1) + '%';
                    
                    // NFT Industry Standard Formula: Rarity Score = 1 / (Trait Value Frequency / Total Items)
                    totalRarityScore += (1 / percentage);
                }
            }
            scores.push({ id: key, score: totalRarityScore });
        }
        
        // Sort by score descending to assign global rank (highest score = #1)
        scores.sort((a, b) => b.score - a.score);
        scores.forEach((item, index) => {
            data[item.id].rank = index + 1;
            data[item.id].totalLandsRanked = totalLands;
        });
        
        return data;
    } catch (e) {
        return {};
    }
}

// 1. GET /api/lands (All lands)
app.get('/api/lands', (req, res) => {
    const data = getLandsData();
    res.json(Object.values(data));
});

// 2. GET /api/random/:landType
app.get('/api/random/:landType', (req, res) => {
    const data = getLandsData();
    const targetLandType = req.params.landType.replace(/\s+/g, '').toLowerCase();
    
    // Filter lands that match the requested land type (ignoring spaces and case)
    const matchingLands = Object.values(data).filter(land => {
        if (!land.attributes || !land.attributes.Land) return false;
        return land.attributes.Land.replace(/\s+/g, '').toLowerCase() === targetLandType;
    });
    
    if (matchingLands.length > 0) {
        // Pick a random land from the matches
        const randomLand = matchingLands[Math.floor(Math.random() * matchingLands.length)];
        res.json({ tokenId: randomLand.tokenId });
    } else {
        // Fallback if none found
        res.status(404).json({ error: "No lands found for this type" });
    }
});

// 2. GET /api/lands/search?q=
app.get('/api/lands/search', (req, res) => {
    const data = getLandsData();
    const query = req.query.q;
    
    if (!query) {
        return res.json(Object.values(data));
    }
    
    // Parse queries like "Core:Reactor" or just plain text search
    let searchKey = null;
    let searchValue = query.toLowerCase();
    
    if (query.includes(':')) {
        const parts = query.split(':');
        searchKey = parts[0].trim().toLowerCase();
        searchValue = parts[1].trim().toLowerCase();
    }
    
    const results = Object.values(data).filter(land => {
        if (searchKey) {
            // Check specific attribute
            const attrs = land.attributes || {};
            for (const [k, v] of Object.entries(attrs)) {
                if (k.toLowerCase() === searchKey && String(v).toLowerCase().includes(searchValue)) {
                    return true;
                }
            }
            return false;
        } else {
            // Global text search across name, description, and attributes
            if (land.name && land.name.toLowerCase().includes(searchValue)) return true;
            if (land.description && land.description.toLowerCase().includes(searchValue)) return true;
            
            const attrs = land.attributes || {};
            for (const v of Object.values(attrs)) {
                if (String(v).toLowerCase().includes(searchValue)) return true;
            }
            return false;
        }
    });
    
    res.json(results);
});

// 3. GET /api/lands/stats
app.get('/api/lands/stats', (req, res) => {
    const data = getLandsData();
    const landsArray = Object.values(data);
    
    const stats = {
        totalLands: landsArray.length,
        backgrounds: {},
        lands: {},
        cores: {},
        relics: {},
        keepers: {}
    };
    
    landsArray.forEach(land => {
        const attrs = land.attributes || {};
        
        const bg = attrs['Background'] || 'None';
        stats.backgrounds[bg] = (stats.backgrounds[bg] || 0) + 1;
        
        const lnd = attrs['Land'] || 'None';
        stats.lands[lnd] = (stats.lands[lnd] || 0) + 1;
        
        const core = attrs['Core'] || 'None';
        stats.cores[core] = (stats.cores[core] || 0) + 1;
        
        const relic = attrs['Relic'] || 'None';
        stats.relics[relic] = (stats.relics[relic] || 0) + 1;
        
        const keeper = attrs['Keeper'] || 'None';
        stats.keepers[keeper] = (stats.keepers[keeper] || 0) + 1;
    });
    
    res.json(stats);
});

// 4. GET /api/lands/:tokenId
app.get('/api/lands/:tokenId', (req, res) => {
    const data = getLandsData();
    const tokenId = req.params.tokenId;
    
    if (data[tokenId]) {
        res.json(data[tokenId]);
    } else {
        res.status(404).json({ error: "Land not found or not yet ingested" });
    }
});

// 5. GET /api/lands/:tokenId/attributes
app.get('/api/lands/:tokenId/attributes', (req, res) => {
    const data = getLandsData();
    const tokenId = req.params.tokenId;
    
    if (data[tokenId]) {
        res.json(data[tokenId].attributes || {});
    } else {
        res.status(404).json({ error: "Land not found or not yet ingested" });
    }
});

// 6. GET /api/image/:tokenId - Proxy IPFS images to avoid CORS and frontend rate limits
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

app.get('/api/image/:tokenId', async (req, res) => {
    const data = getLandsData();
    const tokenId = req.params.tokenId;
    
    if (!data[tokenId] || !data[tokenId].image) {
        return res.status(404).send("Image not found");
    }
    
    // Convert ipfs://Qmf5gaeRhx2PBk4X2vH3sRCYfSmNKFHqHUKHWqqfyqwSJK/1.png 
    const cidPath = data[tokenId].image.replace('ipfs://', '');
    
    // Try multiple gateways for the image proxy simultaneously (Promise.any)
    const gateways = [
        `https://ipfs.io/ipfs/${cidPath}`,
        `https://gateway.pinata.cloud/ipfs/${cidPath}`,
        `https://dweb.link/ipfs/${cidPath}`,
        `https://cloudflare-ipfs.com/ipfs/${cidPath}`
    ];
    
    const fetchPromises = gateways.map(url => {
        return new Promise(async (resolve, reject) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(`Status ${response.status}`));
                }
            } catch (e) {
                reject(e);
            }
        });
    });

    try {
        const fastestResponse = await Promise.any(fetchPromises);
        
        res.setHeader('Content-Type', fastestResponse.headers.get('content-type') || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        
        if (fastestResponse.body.pipe) {
            return fastestResponse.body.pipe(res);
        } else {
            const arrayBuffer = await fastestResponse.arrayBuffer();
            return res.send(Buffer.from(arrayBuffer));
        }
    } catch (e) {
        return res.status(502).send("All IPFS gateways failed to load image");
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`TobyWorld API running on port ${PORT}`);
    });
}

// Export for Vercel Serverless
module.exports = app;

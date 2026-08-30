const fs = require('fs');
const https = require('https');

function get(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if(res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    const counts = {
        'Emberreach': 0, 'Frostveil': 0, 'Meadow': 0, 'Mossmere': 0,
        'Sporegrove': 0, 'Stillwater': 0, 'Sunfield': 0, 'ThePond': 0, 'Waystones': 0
    };
    
    let current = 1;
    const MAX = 1331; // From binary search
    
    // Concurrency of 20
    const workers = 20;
    
    async function worker() {
        while(true) {
            const id = current++;
            if (id > MAX) break;
            
            const meta = await get('https://ipfs.io/ipfs/QmePpWhx8kmPJZBsQwP1bYQxJAdFUorE59ARtCUxew2ZRV/' + id);
            if (meta && meta.attributes) {
                const landAttr = meta.attributes.find(a => a.trait_type.toUpperCase() === 'LAND');
                if (landAttr) {
                    let name = landAttr.value.replace(' ', '');
                    if (counts[name] !== undefined) {
                        counts[name]++;
                    }
                }
            }
        }
    }
    
    const pool = [];
    for(let i=0; i<workers; i++) pool.push(worker());
    
    await Promise.all(pool);
    
    console.log(JSON.stringify(counts, null, 2));
    fs.writeFileSync('land_counts.json', JSON.stringify(counts, null, 2));
}
run();

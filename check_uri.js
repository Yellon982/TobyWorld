const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));
const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/alch_s1a7cJSLhqnu5XLdkRSxg';
const CONTRACT = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';

async function getTokenUri(tokenId) {
    const hexTokenId = tokenId.toString(16).padStart(64, '0');
    const data = '0xc87b56dd' + hexTokenId;
    
    const response = await fetch(ALCHEMY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: CONTRACT, data: data }, 'latest']
        })
    });
    const result = await response.json();
    if (result.error) {
        console.log('Token ' + tokenId + ': REVERTED (Likely unminted or burned)');
    } else if (result.result && result.result !== '0x') {
        const hexStr = result.result.substring(130);
        let str = '';
        for (let i = 0; i < hexStr.length; i += 2) {
            const charCode = parseInt(hexStr.substr(i, 2), 16);
            if (charCode > 0) str += String.fromCharCode(charCode);
        }
        console.log('Token ' + tokenId + ': ' + str);
    } else {
        console.log('Token ' + tokenId + ': DOES NOT EXIST');
    }
}

async function run() {
    await getTokenUri(1);
    await getTokenUri(1738);
    await getTokenUri(1739);
    await getTokenUri(1792);
    await getTokenUri(2000);
    await getTokenUri(2869);
}
run();

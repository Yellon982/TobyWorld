const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));
const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/alch_s1a7cJSLhqnu5XLdkRSxg';
const CONTRACT = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';

async function getTotalSupply() {
    // totalSupply() -> 0x18160ddd
    const response = await fetch(ALCHEMY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: CONTRACT, data: '0x18160ddd' }, 'latest']
        })
    });
    const result = await response.json();
    if (result.result && result.result !== '0x') {
        const supply = parseInt(result.result, 16);
        console.log('Total Supply on Blockchain: ' + supply);
    } else {
        console.log('Total Supply function not found or failed.');
    }
}
getTotalSupply();

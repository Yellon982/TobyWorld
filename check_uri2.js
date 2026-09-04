const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));
const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/alch_s1a7cJSLhqnu5XLdkRSxg';
async function getUri(tokenId) {
    const data = '0xc87b56dd' + tokenId.toString(16).padStart(64, '0');
    const response = await fetch(ALCHEMY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A', data: data }, 'latest'] })
    });
    const result = await response.json();
    console.log('Token ' + tokenId + ' URI:', result.error ? 'REVERTED' : 'EXISTS');
}
async function run() {
    await getUri(2869);
    await getUri(2870);
    await getUri(3523);
    await getUri(4000);
}
run();

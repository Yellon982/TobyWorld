const ethers = require('ethers');

const CONTRACT_ADDRESS = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';
const RPC_URL = 'https://mainnet.base.org';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: 50150000,
        toBlock: 50160000,
        topics: ["0xbdbb3678ff29a0befcc1ce3c9336057a0a776e7d442359dd836076e312ab51bf"]
    });

    console.log(`Found ${logs.length} logs for the mysterious event.`);
    if (logs.length > 0) {
        console.log(logs[0]);
    }
}

main().catch(console.error);

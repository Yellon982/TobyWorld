const fs = require('node:fs');
const path = require('node:path');
const { Interface, id, zeroPadValue, ZeroAddress } = require('ethers');

const ADDRESS = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';
const TRANSFER = id('Transfer(address,address,uint256)');
const ZERO = zeroPadValue(ZeroAddress, 32);
const tokenABI = new Interface(['function tokenURI(uint256) view returns (string)']);
const multiABI = new Interface(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)']);
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function atomicWrite(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(temp, file);
}

function applyTransfers(state, logs) {
    for (const log of [...logs].sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)))) {
        if (log.removed || log.topics[0].toLowerCase() !== TRANSFER.toLowerCase()) continue;
        const tokenId = BigInt(log.topics[3]).toString();
        if (log.topics[1].toLowerCase() === ZERO) state.minted[tokenId] = true;
        if (log.topics[2].toLowerCase() === ZERO) delete state.active[tokenId];
        else state.active[tokenId] = true;
    }
}

function normalizeMetadata(data, tokenId) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.name !== 'string' || typeof data.image !== 'string') throw new Error('Invalid NFT metadata');
    const attributes = Array.isArray(data.attributes)
        ? Object.fromEntries(data.attributes.filter(a => a && typeof a.trait_type === 'string' && a.value !== undefined && a.value !== null).map(a => [a.trait_type, a.value]))
        : data.attributes;
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) throw new Error('Missing attributes');
    // A minted, unrevealed deed is not yet a rankable Lore Land.
    if (typeof attributes.Land !== 'string' || !attributes.Land.trim()) throw new Error('Metadata has no revealed Land trait');
    return { ...data, tokenId: Number(tokenId), attributes,
        gateway_image_url: data.image.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + data.image.slice(7).replace(/^ipfs\//, '') : data.image };
}

async function refresh(options = {}) {
    const readCar = options.car ? await require('./car-metadata').loadCarMetadata(options.car) : null;
    const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    const checkpointFile = path.join(dataDir, 'refresh_checkpoint.json');
    const landsFile = path.join(dataDir, 'lands.json');
    // A malformed cache is an error, never an excuse to overwrite it with an empty object.
    const lands = fs.existsSync(landsFile) ? JSON.parse(fs.readFileSync(landsFile, 'utf8')) : {};
    const rpcUrl = options.rpcUrl || process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    let requestId = 0;
    async function rpc(method, params) {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }), signal: AbortSignal.timeout(30000) });
                if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
                const result = await response.json();
                if (result.error) throw new Error(`RPC ${result.error.code}: ${result.error.message}`);
                if (result.result === undefined) throw new Error('RPC returned no result');
                return result.result;
            } catch (error) {
                if (attempt >= 4) throw error;
                await delay((/429|rate.limit/i.test(error.message) ? 10000 : 500) * 2 ** attempt);
            }
        }
    }
    if (await rpc('eth_chainId', []) !== '0x2105') throw new Error('Expected Base mainnet');
    const hex = number => '0x' + number.toString(16);
    let state = fs.existsSync(checkpointFile) ? JSON.parse(fs.readFileSync(checkpointFile, 'utf8')) : null;
    if (!state || options.fresh) {
        const block = await rpc('eth_getBlockByNumber', ['finalized', false]);
        const target = Number(BigInt(block.number));
        // Discover deployment instead of assuming a start block that may miss early mints.
        let low = 0, high = target;
        if (await rpc('eth_getCode', [ADDRESS, hex(high)]) === '0x') throw new Error('Contract not found');
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (await rpc('eth_getCode', [ADDRESS, hex(middle)]) === '0x') low = middle + 1;
            else high = middle;
        }
        state = { version: 1, contract: ADDRESS, targetBlock: target, targetHash: block.hash, deploymentBlock: low, nextBlock: low, minted: {}, active: {}, checked: {}, failures: {}, startedAt: new Date().toISOString() };
        atomicWrite(checkpointFile, state);
    }
    if (state.contract !== ADDRESS || state.version !== 1) throw new Error('Incompatible checkpoint');
    const targetBlock = await rpc('eth_getBlockByNumber', [hex(state.targetBlock), false]);
    if (targetBlock.hash !== state.targetHash) throw new Error('Snapshot block changed; rerun with --fresh');
    atomicWrite(path.join(dataDir, 'refresh_report.json'), {
        contract: ADDRESS, chainId: 8453, snapshotBlock: state.targetBlock,
        snapshotHash: state.targetHash, updatedAt: new Date().toISOString(),
        complete: false, refreshInProgress: true, missingMetadata: [],
        message: 'Refresh started; final supply and metadata counts are not yet verified'
    });
    console.log(`Snapshot ${state.targetBlock}; deployment ${state.deploymentBlock}; scanning from ${state.nextBlock}`);
    let chunk = 10000, chunks = 0;
    while (state.nextBlock <= state.targetBlock) {
        const end = Math.min(state.nextBlock + chunk - 1, state.targetBlock);
        let logs;
        try {
            logs = await rpc('eth_getLogs', [{ address: ADDRESS, fromBlock: hex(state.nextBlock), toBlock: hex(end), topics: [TRANSFER] }]);
        } catch (error) {
            if (chunk <= 100) throw error;
            chunk = Math.max(100, Math.floor(chunk / 2));
            console.log(`Reducing scan range to ${chunk} blocks`);
            continue;
        }
        applyTransfers(state, logs);
        state.nextBlock = end + 1;
        atomicWrite(checkpointFile, state);
        if (++chunks % 20 === 0 || state.nextBlock > state.targetBlock) console.log(`Scanned ${end}/${state.targetBlock}; ${Object.keys(state.minted).length} minted, ${Object.keys(state.active).length} active`);
    }
    const ids = Object.keys(state.active).sort((a, b) => Number(a) - Number(b));
    console.log(`Checking metadata for ${ids.length} active deeds (including non-sequential IDs)`);
    const pending = ids.filter(tokenId => !state.checked[tokenId] || state.failures[tokenId]);
    const gateways = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/'];
    async function metadata(uri) {
        if (readCar) {
            const cached = await readCar(uri);
            if (cached !== undefined) return cached;
        }
        if (uri.startsWith('data:application/json;base64,')) return JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString('utf8'));
        const urls = uri.startsWith('ipfs://') ? gateways.map(g => g + uri.slice(7).replace(/^ipfs\//, '')) : /^https:\/\//.test(uri) ? [uri] : [];
        if (!urls.length) throw new Error('Empty or unsupported tokenURI');
        let lastError;
        for (const url of urls) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
                if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
                return await response.json();
            } catch (error) { lastError = error; }
        }
        throw lastError;
    }
    for (let offset = 0; offset < pending.length; offset += 40) {
        const batch = pending.slice(offset, offset + 40);
        const calls = batch.map(tokenId => [ADDRESS, true, tokenABI.encodeFunctionData('tokenURI', [tokenId])]);
        const encoded = await rpc('eth_call', [{ to: MULTICALL, data: multiABI.encodeFunctionData('aggregate3', [calls]) }, hex(state.targetBlock)]);
        const [results] = multiABI.decodeFunctionResult('aggregate3', encoded);
        let cursor = 0;
        await Promise.all(Array.from({ length: 6 }, async () => {
            while (cursor < batch.length) {
                const index = cursor++, tokenId = batch[index];
                try {
                    if (!results[index].success) throw new Error('tokenURI reverted');
                    const [uri] = tokenABI.decodeFunctionResult('tokenURI', results[index].returnData);
                    const normalized = normalizeMetadata(await metadata(uri), tokenId);
                    lands[tokenId] = normalized;
                    state.checked[tokenId] = { uri, checkedAt: new Date().toISOString() };
                    delete state.failures[tokenId];
                } catch (error) {
                    state.failures[tokenId] = { error: error.message, attemptedAt: new Date().toISOString(), attempts: (state.failures[tokenId]?.attempts || 0) + 1 };
                }
            }
        }));
        // Cache first: a crash before checkpoint persistence only repeats harmless reads.
        atomicWrite(landsFile, lands);
        atomicWrite(checkpointFile, state);
        console.log(`Metadata ${Math.min(offset + batch.length, pending.length)}/${pending.length}; cached ${Object.keys(lands).length}; failures ${Object.keys(state.failures).length}`);
        await delay(options.batchDelayMs ?? 2200);
    }
    const stale = Object.keys(lands).filter(tokenId => !state.active[tokenId]);
    for (const tokenId of stale) delete lands[tokenId];
    atomicWrite(landsFile, lands);
    const report = { contract: ADDRESS, chainId: 8453, snapshotBlock: state.targetBlock, snapshotHash: state.targetHash, deploymentBlock: state.deploymentBlock, updatedAt: new Date().toISOString(), mintedSupply: Object.keys(state.minted).length, activeSupply: ids.length, burnedSupply: Object.keys(state.minted).length - ids.length, indexedMetadata: Object.keys(lands).length, verifiedMetadata: Object.keys(state.checked).length, failedMetadata: Object.keys(state.failures).length, missingMetadata: ids.filter(tokenId => !lands[tokenId]), removedInactiveIds: stale, complete: Object.keys(state.failures).length === 0, failures: state.failures };
    atomicWrite(path.join(dataDir, 'refresh_report.json'), report);
    console.log(JSON.stringify({ ...report, missingMetadata: report.missingMetadata.length, failures: undefined }, null, 2));
    return report;
}

module.exports = { refresh, applyTransfers, normalizeMetadata, atomicWrite, TRANSFER, ZERO };

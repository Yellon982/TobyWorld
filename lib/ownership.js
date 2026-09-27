const { Interface, getAddress, ZeroAddress } = require('ethers');

const DEEDS = '0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A';
const POND = '0x7dcF7e9394438CE5E0370b27108c276E6EA6E592';
const abi = new Interface(['function ownerOf(uint256) view returns (address)']);

function validTokenId(value) {
    return typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < (1n << 256n);
}

function createOwnershipHandler(fetchRpc = globalThis.fetch) {
    return async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const tokenId = req.params.tokenId;
        if (!validTokenId(tokenId)) return res.status(400).json({ error: 'Invalid deed ID' });
        try {
            const response = await fetchRpc(process.env.BASE_RPC_URL || 'https://mainnet.base.org', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
                    params: [{ to: DEEDS, data: abi.encodeFunctionData('ownerOf', [tokenId]) }, 'latest'] }),
                signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) throw new Error('RPC unavailable');
            const data = await response.json();
            if (data.error || !data.result) throw new Error('Owner unavailable');
            const owner = getAddress(abi.decodeFunctionResult('ownerOf', data.result)[0]);
            if (owner === ZeroAddress) throw new Error('No current owner');
            res.json({ tokenId, owner, pondAddress: POND,
                status: owner.toLowerCase() === POND.toLowerCase() ? 'In The Pond' : 'Owned',
                checkedAt: new Date().toISOString() });
        } catch {
            // RPC errors and burned/unminted tokens are never classified as Owned.
            res.status(503).json({ status: 'Ownership unavailable' });
        }
    };
}

module.exports = { createOwnershipHandler, validTokenId, DEEDS, POND };

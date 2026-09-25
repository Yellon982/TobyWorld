const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Interface } = require('ethers');
const { refresh, atomicWrite, TRANSFER, ZERO } = require('../lib/refresh');

test('refresh retries failed metadata on resume without losing old cache or rescanning completed blocks', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toby-integration-'));
    const tokenABI = new Interface(['function tokenURI(uint256) view returns(string)']);
    const multiABI = new Interface(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)']);
    const owner = '0x' + '1'.repeat(64);
    let fail = true, scans = 0;
    const block = { number: '0x2', hash: '0x' + 'a'.repeat(64) };
    const server = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const input = JSON.parse(Buffer.concat(chunks));
        let result;
        switch (input.method) {
            case 'eth_chainId': result = '0x2105'; break;
            case 'eth_getBlockByNumber': result = block; break;
            case 'eth_getCode': result = input.params[1] === '0x0' ? '0x' : '0x6000'; break;
            case 'eth_getLogs':
                scans++;
                result = [7, 4000].map((id, index) => ({ topics: [TRANSFER, ZERO, owner, '0x' + id.toString(16)], blockNumber: '0x1', logIndex: '0x' + index.toString(16) }));
                break;
            case 'eth_call': {
                const [calls] = multiABI.decodeFunctionData('aggregate3', input.params[0].data);
                result = multiABI.encodeFunctionResult('aggregate3', [calls.map(call => {
                    const [tokenId] = tokenABI.decodeFunctionData('tokenURI', call.callData);
                    if (tokenId === 4000n && fail) return [false, '0x'];
                    const data = { name: `Deed ${tokenId}`, image: 'ipfs://image', attributes: { Land: 'Mossmere' } };
                    const uri = 'data:application/json;base64,' + Buffer.from(JSON.stringify(data)).toString('base64');
                    return [true, tokenABI.encodeFunctionResult('tokenURI', [uri])];
                })]);
                break;
            }
            default: throw new Error(input.method);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: input.id, result }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const options = { dataDir, rpcUrl: `http://127.0.0.1:${server.address().port}`, batchDelayMs: 0 };
    try {
        atomicWrite(path.join(dataDir, 'lands.json'), { 4000: { name: 'old data', tokenId: 4000 } });
        const first = await refresh(options);
        assert.equal(first.mintedSupply, 2);
        assert.equal(first.verifiedMetadata, 1);
        assert.equal(first.failedMetadata, 1);
        assert.equal(first.complete, false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'lands.json')))[4000].name, 'old data');
        fail = false;
        const second = await refresh(options);
        assert.equal(scans, 1);
        assert.equal(second.complete, true);
        assert.equal(second.verifiedMetadata, 2);
        assert.equal(second.failedMetadata, 0);
        assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'lands.json')))[4000].name, 'Deed 4000');
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

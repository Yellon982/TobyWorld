const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyTransfers, normalizeMetadata, atomicWrite, TRANSFER, ZERO } = require('../lib/refresh');
const owner = '0x' + '1'.repeat(64);
const log = (token, from, to, block, index = 0) => ({ topics: [TRANSFER, from, to, '0x' + token.toString(16)], blockNumber: '0x' + block.toString(16), logIndex: '0x' + index.toString(16) });

test('mint count is distinct from highest token ID and includes IDs above 2869', () => {
    const state = { minted: {}, active: {} };
    applyTransfers(state, [log(7, ZERO, owner, 10), log(4000, ZERO, owner, 11)]);
    assert.equal(Object.keys(state.minted).length, 2);
    assert.deepEqual(Object.keys(state.active), ['7', '4000']);
});
test('burn removes active token but preserves historical mint; replay is idempotent', () => {
    const state = { minted: {}, active: {} };
    const logs = [log(7, owner, ZERO, 11), log(7, ZERO, owner, 10)];
    applyTransfers(state, logs);
    applyTransfers(state, logs);
    assert.deepEqual(state, { minted: { 7: true }, active: {} });
});
test('removed logs are ignored', () => {
    const state = { minted: {}, active: {} };
    applyTransfers(state, [{ ...log(7, ZERO, owner, 10), removed: true }]);
    assert.deepEqual(state.active, {});
});
test('metadata preserves falsy trait values and authoritative token ID', () => {
    const data = normalizeMetadata({ tokenId: 99, name: 'Deed', image: 'ipfs://cid/7.png', attributes: [{ trait_type: 'Land', value: 'Mossmere' }, { trait_type: 'Count', value: 0 }, { trait_type: 'Flag', value: false }] }, 7);
    assert.equal(data.tokenId, 7);
    assert.equal(data.attributes.Count, 0);
    assert.equal(data.attributes.Flag, false);
});
test('unrevealed and malformed metadata cannot replace a valid cache entry', () => {
    for (const value of [null, [], {}, { name: 'Unrevealed', image: 'ipfs://cid', attributes: [] }]) assert.throws(() => normalizeMetadata(value, 7));
});
test('atomic write produces valid JSON and leaves no temporary file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toby-refresh-'));
    try {
        const file = path.join(dir, 'cache.json');
        atomicWrite(file, { 7: 'old' });
        atomicWrite(file, { 7: 'new', 4000: 'present' });
        assert.deepEqual(JSON.parse(fs.readFileSync(file)), { 7: 'new', 4000: 'present' });
        assert.deepEqual(fs.readdirSync(dir), ['cache.json']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

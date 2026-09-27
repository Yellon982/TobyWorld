const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Interface, ZeroAddress } = require('ethers');
const { createOwnershipHandler, POND, DEEDS } = require('../lib/ownership');
const abi = new Interface(['function ownerOf(uint256) view returns(address)']);

async function check(tokenId, rpc) {
    const result = { code: 200, headers: {} };
    const res = { setHeader(k, v) { result.headers[k] = v; }, status(code) { result.code = code; return this; }, json(body) { result.body = body; } };
    await createOwnershipHandler(rpc)({ params: { tokenId } }, res);
    return result;
}
const ownerResponse = owner => async () => ({ ok: true, json: async () => ({ result: abi.encodeFunctionResult('ownerOf', [owner]) }) });

test('current Pond holder is In The Pond, with case-insensitive address matching', async () => {
    const result = await check('1127', ownerResponse(POND.toLowerCase()));
    assert.equal(result.body.status, 'In The Pond');
    assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('a different holder is Owned; later return to the Pond updates the status', async () => {
    assert.equal((await check('4000', ownerResponse('0xdF78485f8C99a7Be3F01b016C2f54A176D466237'))).body.status, 'Owned');
    assert.equal((await check('4000', ownerResponse(POND))).body.status, 'In The Pond');
});
test('queries ownerOf on the deed contract at latest, including IDs above supply', async () => {
    await check('4000', async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.params[0].to, DEEDS);
        assert.equal(body.params[1], 'latest');
        assert.equal(abi.decodeFunctionData('ownerOf', body.params[0].data)[0], 4000n);
        return ownerResponse(POND)();
    });
});
test('RPC failures, missing tokens and malformed responses never become Owned', async () => {
    for (const rpc of [async () => { throw new Error('timeout'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ error: { code: 3 } }) }), async () => ({ ok: true, json: async () => ({ result: '0x' }) }), ownerResponse(ZeroAddress)]) {
        const result = await check('1127', rpc);
        assert.equal(result.code, 503);
        assert.equal(result.body.status, 'Ownership unavailable');
    }
});
test('invalid IDs are rejected before RPC access', async () => {
    for (const id of ['-1', '1.5', '1e3', 'abc', '01', (1n << 256n).toString()]) {
        assert.equal((await check(id, () => assert.fail('RPC should not run'))).code, 400);
    }
});

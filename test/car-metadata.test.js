const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadCarMetadata } = require('../lib/car-metadata');

test('CAR metadata is matched to the URI root and tampered bytes are rejected', async () => {
    const { CarWriter } = await import('@ipld/car');
    const { CID } = await import('multiformats/cid');
    const { sha256 } = await import('multiformats/hashes/sha2');
    const bytes = Buffer.from('{"name":"test"}');
    const cid = CID.createV1(0x55, await sha256.digest(bytes));
    const { writer, out } = CarWriter.create([cid]);
    const chunks = [];
    const collect = (async () => { for await (const chunk of out) chunks.push(chunk); })();
    await writer.put({ cid, bytes });
    await writer.close();
    await collect;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toby-car-'));
    try {
        const file = path.join(dir, 'metadata.car');
        const archive = Buffer.concat(chunks);
        fs.writeFileSync(file, archive);
        const read = await loadCarMetadata(file);
        assert.deepEqual(await read('ipfs://' + cid), { name: 'test' });
        const other = CID.createV1(0x55, await sha256.digest(Buffer.from('other')));
        assert.equal(await read('ipfs://' + other), undefined);
        archive[archive.length - 1] ^= 1;
        fs.writeFileSync(file, archive);
        await assert.rejects(loadCarMetadata(file), /hash mismatch/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

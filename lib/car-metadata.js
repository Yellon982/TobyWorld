const fs = require('node:fs');
const { createHash } = require('node:crypto');

// Verify every block before trusting an IPFS directory archive.
async function loadCarMetadata(file) {
    const { CarReader } = await import('@ipld/car');
    const { exporter } = await import('ipfs-unixfs-exporter');
    const { CID } = await import('multiformats/cid');
    const reader = await CarReader.fromIterable(fs.createReadStream(file));
    for await (const { cid, bytes } of reader.blocks()) {
        if (cid.multihash.code !== 0x12) throw new Error('Unsupported CAR hash algorithm');
        const digest = createHash('sha256').update(bytes).digest();
        if (!digest.equals(Buffer.from(cid.multihash.digest))) throw new Error('CAR block hash mismatch');
    }
    const roots = (await reader.getRoots()).map(cid => cid.toV1().toString());
    const blockstore = { async *get(cid) {
        const block = await reader.get(cid);
        if (!block) throw new Error(`CAR missing block ${cid}`);
        yield block.bytes;
    } };
    return async uri => {
        if (!uri.startsWith('ipfs://')) return undefined;
        const resource = uri.slice(7).replace(/^ipfs\//, '');
        const root = resource.split('/')[0];
        // Only use the archive when the on-chain URI points to its verified root.
        if (!roots.includes(CID.parse(root).toV1().toString())) return undefined;
        const entry = await exporter(resource, blockstore);
        if (entry.type !== 'file' && entry.type !== 'raw') throw new Error('Metadata path is not a file');
        const chunks = [];
        for await (const chunk of entry.content()) chunks.push(chunk);
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    };
}
module.exports = { loadCarMetadata };

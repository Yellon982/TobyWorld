# TobyWorld

## Local preview

Requires Node.js 22 or later. Run `npm ci`, then `npm start` and open
`http://127.0.0.1:3000`. Local and Vercel routes share `api/index.js`.

## Refresh land metadata

Run `npm run refresh:fresh` to start a new snapshot, or `npm run refresh:data`
to resume the saved snapshot and retry failures. These commands do not commit,
push, schedule jobs, or deploy. `npm run cron` and `node backfill.js` are also
one-shot resumable refreshes; there is no implicit background timer.

The refresh discovers the contract deployment block, scans every Transfer event
through a finalized Base block, and checks tokenURI for every active token at
that same block. It does not assume sequential token IDs or use supply as an ID
limit. Minted supply, active supply, and indexed metadata are separate counts.
Every fresh snapshot rechecks all URIs, including silent metadata changes.

`BASE_RPC_URL` optionally selects a Base mainnet RPC endpoint. The default is
the public Base endpoint. Provider failures stop the scan without advancing
past the failed range. A saved block hash guards against a changed snapshot.

Files:

- `data/lands.json`: metadata consumed by the site, replaced atomically.
- `data/refresh_report.json`: snapshot block/hash, supply, verified metadata,
  missing IDs, and per-token failures. Included in the Vercel API build.
- `data/refresh_checkpoint.json`: local resumable scan and metadata state;
  intentionally excluded from Git.

A gateway failure preserves the previous cached record and remains in the retry
queue. An unrevealed deed without a Land trait is reported as unresolved and is
not added to the ranked dataset. Exit code 0 means the snapshot is complete;
2 means unresolved metadata; 1 means the refresh stopped on an error. Do not
run multiple refresh commands against the same data directory simultaneously.

For gateway rate limits, download the metadata root as a CAR archive (HTTP
`Accept: application/vnd.ipld.car` with `?format=car`), then run
`node refresh_data.js --car /path/to/metadata.car`. The refresh validates each
block's SHA-256 hash and only reads archive paths matching the on-chain tokenURI
root. Other roots fall back to the gateways. CAR support requires devDependencies.

`GET /api/health` reports the saved refresh result; it is not a live blockchain
query. Vercel serves the committed snapshot and does not persist indexer writes.
Refresh and review the data before deliberately publishing a new deployment.

## Verification

Run `npm test`. Regression checks cover non-sequential IDs, burn/replay behavior,
removed logs, metadata normalization, invalid metadata, and atomic writes.

const { refresh } = require('./lib/refresh');
const carIndex = process.argv.indexOf('--car');
refresh({ fresh: process.argv.includes('--fresh'), car: carIndex >= 0 ? process.argv[carIndex + 1] : undefined }).then(report => {
    if (!report.complete) process.exitCode = 2;
}).catch(error => { console.error(error.message); process.exitCode = 1; });

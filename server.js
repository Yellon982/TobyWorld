const path = require('node:path');
const express = require('express');
const app = require('./api/index');
app.use(express.static(__dirname, { dotfiles: 'deny' }));
if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, '127.0.0.1', () => console.log(`TobyWorld preview: http://127.0.0.1:${port}`));
}
module.exports = app;

const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');

const faucetCss = \
.faucet-link {
    position: absolute;
    top: 160px;
    right: 20px;
    z-index: 999;
    pointer-events: auto;
    transition: transform 0.2s ease, filter 0.2s ease;
}

.faucet-link:hover {
    transform: scale(1.1);
    filter: drop-shadow(0 0 10px #00ffff);
}

.faucet-link img {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid #00ffff;
    background: rgba(0,20,30,0.8);
    object-fit: cover;
}
\;

css = css.replace('.toby-link {', faucetCss + '.toby-link {');

css = css.replace('.toby-link {\\r\\n    position: absolute;\\r\\n    top: 160px;', '.toby-link {\\r\\n    position: absolute;\\r\\n    top: 230px;');
css = css.replace('.toby-link {\\n    position: absolute;\\n    top: 160px;', '.toby-link {\\n    position: absolute;\\n    top: 230px;');

css = css.replace('.taboshi-link {\\r\\n    position: absolute;\\r\\n    top: 230px;', '.taboshi-link {\\r\\n    position: absolute;\\r\\n    top: 300px;');
css = css.replace('.taboshi-link {\\n    position: absolute;\\n    top: 230px;', '.taboshi-link {\\n    position: absolute;\\n    top: 300px;');

css = css.replace('.patience-link {\\r\\n    position: absolute;\\r\\n    top: 300px;', '.patience-link {\\r\\n    position: absolute;\\r\\n    top: 370px;');
css = css.replace('.patience-link {\\n    position: absolute;\\n    top: 300px;', '.patience-link {\\n    position: absolute;\\n    top: 370px;');

const faucetMobile = \
    .faucet-link {
        top: 130px;
        right: 10px;
    }
    .faucet-link img {
        width: 45px;
        height: 45px;
    }
\;

css = css.replace('    .toby-link {\\r\\n        top: 130px;', faucetMobile + '    .toby-link {\\r\\n        top: 185px;');
css = css.replace('    .toby-link {\\n        top: 130px;', faucetMobile + '    .toby-link {\\n        top: 185px;');

css = css.replace('    .taboshi-link {\\r\\n        top: 185px;', '    .taboshi-link {\\r\\n        top: 240px;');
css = css.replace('    .taboshi-link {\\n        top: 185px;', '    .taboshi-link {\\n        top: 240px;');

css = css.replace('    .patience-link {\\r\\n        top: 240px;', '    .patience-link {\\r\\n        top: 295px;');
css = css.replace('    .patience-link {\\n        top: 240px;', '    .patience-link {\\n        top: 295px;');

fs.writeFileSync('style.css', css);



fetch('https://tobyworld.app/world/assets/index-CKh6SPy5.js').then(r => r.text()).then(js => {
  const apis = js.match(/https?:\/\/[^\s\'\\")\]]+/g);
  if(apis) {
    const unique = [...new Set(apis)];
    console.log('Found URLs in JS:');
    console.log(unique.join('\n'));
  }
}).catch(console.error);

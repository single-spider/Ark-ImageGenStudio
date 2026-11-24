const assert = require('node:assert/strict');
const m = require('./manifest.json');
assert.equal(m.browser_specific_settings.gecko.id, 'ark-local-bridge@single-spider.github.io');
assert.deepEqual(m.content_scripts[0].matches, ['https://single-spider.github.io/Ark-ImageGenStudio/*']);
assert.equal(m.content_scripts[0].all_frames, false);
assert(!m.permissions.includes('<all_urls>'));
assert(m.permissions.includes('nativeMessaging'));
console.log('Firefox manifest scope checks passed');

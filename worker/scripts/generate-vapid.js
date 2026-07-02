// web-push VAPID keys script
// Run: node worker/scripts/generate-vapid.js
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log(JSON.stringify(keys, null, 2));

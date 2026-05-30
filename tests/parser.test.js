const fs = require('fs');
const path = require('path');

test('parse results', () => {
  const results = JSON.parse(fs.readFileSync(path.join(__dirname, '../all-results.json'), 'utf8'));
  const failed = {};
  results.testResults.forEach(tr => {
    const trName = tr.name.replace(/.*\/tests\//, '');
    tr.assertionResults.forEach(ar => {
      if (ar.status === 'failed') {
        if (!failed[trName]) {
          failed[trName] = [];
        }
        failed[trName].push({
          fullName: ar.fullName,
          title: ar.title,
          message: ar.failureMessages[0] ? ar.failureMessages[0].substring(0, 300) : ''
        });
      }
    });
  });
  fs.writeFileSync(path.join(__dirname, '../failed-suites.json'), JSON.stringify(failed, null, 2));
});

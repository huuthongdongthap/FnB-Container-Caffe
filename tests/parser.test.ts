import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

test('parse results', () => {
  const results = JSON.parse((fs as any).readFileSync(path.join(__dirname, '../all-results.json'), 'utf8'));
  const failed: Record<string, Array<{ fullName: string; title: string; message: string }>> = {};
  results.testResults.forEach((tr: any) => {
    const trName = tr.name.replace(/.*\/tests\//, '');
    tr.assertionResults.forEach((ar: any) => {
      if (ar.status === 'failed') {
        if (!failed[trName]) {
          failed[trName] = [];
        }
        failed[trName].push({
          fullName: ar.fullName,
          title: ar.title,
          message: ar.failureMessages[0] ? ar.failureMessages[0].substring(0, 300) : '',
        });
      }
    });
  });
  expect(Object.keys(failed).length).toBeGreaterThanOrEqual(0);
});

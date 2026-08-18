/**
 * CLI wrapper around the deterministic Nordhaus demo. Run with: pnpm demo
 */

import { runNordhausDemo } from '../apps/api/src/scenario/nordhaus-demo.js';

runNordhausDemo()
  .then((report) => {
    console.log('\n=== Final audit trail ===');
    for (const action of report.auditActions) {
      console.log(`  ${action}`);
    }
    console.log('\nDemo completed successfully.');
  })
  .catch((error: unknown) => {
    console.error('Demo failed:', error);
    process.exitCode = 1;
  });

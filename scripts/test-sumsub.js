import 'dotenv/config';
import { createSumsubClient } from '../sumsub';
const mask = (s) => s ? `${s.slice(0,6)}...${s.slice(-6)} (${s.length})` : '<empty>';

(async () => {
  const client = createSumsubClient();
  console.log('SUMSUB_APP_TOKEN:', mask(process.env.SUMSUB_APP_TOKEN));
  console.log('SUMSUB_SECRET_KEY:', mask(process.env.SUMSUB_SECRET_KEY));
  try {
    const applicant = await client.createApplicant({
      externalUserId: `test-${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });
    console.log('Sumsub createApplicant success:', applicant.id);
  } catch (err) {
    console.error('Sumsub error (detailed):', err.message || err);
    if (err && err.stack) console.error(err.stack?.split('\n').slice(0,2).join('\n'));
  }
})();

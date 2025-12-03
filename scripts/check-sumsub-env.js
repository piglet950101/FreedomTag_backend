import 'dotenv/config';
const mask = (s) => s ? `${s.slice(0,6)}...${s.slice(-6)} (${s.length})` : '<empty>';
console.log('SUMSUB_APP_TOKEN:', mask(process.env.SUMSUB_APP_TOKEN));
console.log('SUMSUB_SECRET_KEY:', mask(process.env.SUMSUB_SECRET_KEY));

if (!process.env.SUMSUB_APP_TOKEN || !process.env.SUMSUB_SECRET_KEY) {
  console.warn('SUMSUB tokens are missing; the server may use the DemoSumsubClient fallback.');
}

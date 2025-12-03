import dns from 'dns';

dns.lookup(
  'db.tpngkqpxzmwgktxojweb.supabase.co',
  { family: 6 }, // 6 = IPv6, 4 = IPv4
  (err, address, family) => {
    if (err) console.error('DNS lookup failed:', err);
    else console.log(`DNS resolved to: ${address}, family: IPv${family}`);
  }
);

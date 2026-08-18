import { Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

const CONNECT_TIMEOUT_MS = 8000;
const STAGE_TIMEOUT_MS = 8000;
const TOTAL_TIMEOUT_MS = 24000;

async function probeDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return { database: 'error', stage: 'env', error: 'DATABASE_URL not set' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:')
      throw new Error('bad protocol');
  } catch {
    return { database: 'error', stage: 'env', error: 'DATABASE_URL unparsable' };
  }
  const user = decodeURIComponent(parsed.username);
  const pass = decodeURIComponent(parsed.password);
  const database = parsed.pathname.replace(/^\//, '');
  const host = parsed.hostname;
  const port = Number(parsed.port || 5432);

  const stages = [];
  const started = Date.now();

  try {
    const socket = new Socket();
    await new Promise((resolve, reject) => {
      socket.setTimeout(CONNECT_TIMEOUT_MS, () => reject(new Error('connect timeout')));
      socket.connect({ host, port }, () => {
        socket.setTimeout(0);
        resolve();
      });
      socket.once('error', reject);
    });
    stages.push('tcp');

    await new Promise((resolve, reject) => {
      const buf = Buffer.alloc(8);
      buf.writeInt32BE(8, 0);
      buf.writeInt32BE(80877103, 4);
      socket.write(buf);
      socket.once('data', (d) => {
        if (d[0] === 0x53) resolve();
        else reject(new Error(`SSLRequest rejected (0x${d[0].toString(16)})`));
      });
      socket.once('error', reject);
    });
    stages.push('ssl-request');

    const tls = tlsConnect({ socket, servername: host });
    await new Promise((resolve, reject) => {
      tls.once('secureConnect', resolve);
      tls.once('error', reject);
    });
    stages.push('tls');

    const params = ['user', user, 'database', database];
    let len = 8;
    for (let i = 0; i < params.length; i += 2) {
      len += Buffer.byteLength(params[i]) + 1 + Buffer.byteLength(params[i + 1]) + 1;
    }
    len += 1;
    const startup = Buffer.alloc(len);
    let off = 0;
    startup.writeInt32BE(len, 0);
    off = 4;
    startup.writeInt32BE(196608, off);
    off += 4;
    for (let i = 0; i < params.length; i += 2) {
      startup.write(params[i], off);
      off += Buffer.byteLength(params[i]) + 1;
      startup.write(params[i + 1], off);
      off += Buffer.byteLength(params[i + 1]) + 1;
    }
    startup.writeInt8(0, off);
    tls.write(startup);

    const nonce = randomBytes(18).toString('base64');
    const clientFirstBare = `n=${user},r=${nonce}`;
    const state = { authed: false, ready: false, gotDataRow: false };
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server idle timeout')), STAGE_TIMEOUT_MS);
      let open = [];
      tls.on('data', (chunk) => {
        const buf = Buffer.clone ? Buffer.from(chunk) : Buffer.from(chunk);
        open = Buffer.concat([open, buf]);
        while (open.length >= 5) {
          const len = open.readInt32BE(1);
          if (open.length < 1 + len) break;
          const type = open[0];
          const body = open.subarray(5, 1 + len);
          open = open.subarray(1 + len);

          if (type === 0x52) {
            const code = body.readInt32BE(0);
            if (code === 0) {
              state.authed = true;
            } else if (code === 10) {
              const init = Buffer.concat([
                Buffer.from('SCRAM-SHA-256\0', 'utf8'),
                (() => {
                  const p = Buffer.from(`n,,${clientFirstBare}`, 'utf8');
                  const out = Buffer.alloc(4 + p.length);
                  out.writeInt32BE(p.length, 0);
                  p.copy(out, 4);
                  return out;
                })(),
              ]);
              const m = Buffer.alloc(4 + init.length);
              m.writeInt32BE(init.length + 4, 0);
              init.copy(m, 4);
              tls.write(Buffer.concat([Buffer.from([0x70]), m]));
            } else if (code === 11) {
              const serverFirst = body.toString('utf8');
              const [nonce2, saltB64, itersRaw] = serverFirst.split(',');
              const serverNonce = nonce2?.slice(2) ?? '';
              const salt = Buffer.from(saltB64?.slice(2) ?? '=', 'base64');
              const iters = Number(itersRaw?.slice(2));
              const clientFinalNoProof = `c=biws,r=${serverNonce}`;
              const authMsg = `${clientFirstBare},${serverFirst},${clientFinalNoProof}`;
              const salted = pbkdf2Sync(Buffer.from(pass, 'utf8'), salt, iters, 32, 'sha256');
              const clientKey = createHmac('sha256', salted).update('Client Key').digest();
              const storedKey = createHash('sha256').update(clientKey).digest();
              const clientSig = createHmac('sha256', storedKey).update(authMsg).digest();
              const proof = Buffer.alloc(32);
              for (let i = 0; i < 32; i++) proof[i] = clientKey[i] ^ clientSig[i];
              const final = Buffer.from(
                `${clientFinalNoProof},p=${proof.toString('base64')}`,
                'utf8',
              );
              const m = Buffer.alloc(4 + final.length);
              m.writeInt32BE(final.length + 4, 0);
              final.copy(m, 4);
              tls.write(Buffer.concat([Buffer.from([0x70]), m]));
            } else if (code === 12) {
              // SCRAM final — server signature verified already at protocol level
            } else if (code === 3 || code === 5) {
              reject(new Error(`auth failure (code ${code})`));
            } else {
              reject(new Error(`unexpected auth code ${code}`));
            }
          } else if (type === 0x45) {
            reject(new Error(`server error: ${body.subarray(4).toString('utf8')}`));
          } else if (type === 0x5a) {
            if (!state.ready) {
              state.ready = true;
              const q = Buffer.from('SELECT 1\0', 'utf8');
              const m = Buffer.alloc(4 + q.length);
              m.writeInt32BE(q.length + 4, 0);
              q.copy(m, 4);
              tls.write(Buffer.concat([Buffer.from([0x51]), m]));
            } else if (state.gotDataRow) {
              clearTimeout(timer);
              resolve('ok');
            } else {
              reject(new Error('no data row'));
            }
          } else if (type === 0x44) {
            state.gotDataRow = true;
          }
        }
      });
      tls.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    stages.push('auth');
    stages.push('select1');

    tls.destroy();
    return { database: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      database: 'error',
      stage: stages.join('>') || 'connect',
      error: message.slice(0, 160),
    };
  }
}

async function probePrisma() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    if (!PrismaClient) return 'unavailable';
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `failed: ${message.trim().split('\n')[0]?.slice(0, 120)}`;
  }
}

async function run() {
  const database = await probeDatabase();
  const prisma = await probePrisma();
  return { ...database, prisma };
}

const isDirectRun = process.argv[1] === new URL(import.meta.url).pathname;

export default async function handler(_req, res) {
  try {
    const body = await Promise.race([
      run(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('overall timeout')), TOTAL_TIMEOUT_MS),
      ),
    ]);
    res.status(200).json(body);
  } catch {
    res.status(200).json({
      database: 'error',
      stage: 'overall',
      error: 'overall timeout',
      prisma: 'unavailable',
    });
  }
}

export { run };

if (isDirectRun) {
  run().then((r) => {
    console.log(JSON.stringify(r));
    process.exit(0);
  });
}

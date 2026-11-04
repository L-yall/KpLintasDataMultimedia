const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const keyFile = path.join(__dirname, '..', 'config', '.router-encryption.key');
const aad = Buffer.from('router_mikrotik.password:v1');
let keyPromise;

function credentialError() {
  const error = new Error('Kunci enkripsi router tidak tersedia atau kredensial tidak dapat didekripsi.');
  error.statusCode = 503;
  return error;
}

function parseKey(value) {
  const text = value.trim();
  if (/^[a-f\d]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  if (/^[A-Za-z\d+/]{43}=$/.test(text)) {
    const key = Buffer.from(text, 'base64');
    if (key.length === 32 && key.toString('base64') === text) return key;
  }
  throw credentialError();
}

async function loadKey(create) {
  if (process.env.ROUTER_ENCRYPTION_KEY !== undefined) {
    return parseKey(process.env.ROUTER_ENCRYPTION_KEY);
  }
  try {
    return parseKey(await fs.readFile(keyFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw credentialError();
  }

  // Publish a complete key atomically; concurrent processes must use the same winner.
  await fs.mkdir(path.dirname(keyFile), { recursive: true });
  const temporary = keyFile + '.' + crypto.randomBytes(16).toString('hex') + '.tmp';
  try {
    await fs.writeFile(temporary, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
    try {
      await fs.link(temporary, keyFile);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    return parseKey(await fs.readFile(keyFile, 'utf8'));
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

async function getKey(create) {
  if (!keyPromise) {
    keyPromise = loadKey(create).catch(() => {
      keyPromise = undefined;
      throw credentialError();
    });
  }
  return keyPromise;
}

module.exports = {
  async encrypt(password) {
    try {
      const key = await getKey(true);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad);
      const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
    } catch (_) {
      throw credentialError();
    }
  },

  async decrypt(value) {
    try {
      const parts = value.split(':');
      if (parts.length !== 4 || parts[0] !== 'v1') throw credentialError();
      const iv = Buffer.from(parts[1], 'base64');
      const tag = Buffer.from(parts[2], 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw credentialError();
      // Never generate a replacement key when existing ciphertext cannot be read.
      const decipher = crypto.createDecipheriv('aes-256-gcm', await getKey(false), iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
    } catch (_) {
      throw credentialError();
    }
  }
};

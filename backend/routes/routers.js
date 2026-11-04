const express = require('express');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/auth');
const Router = require('../models/Router');
const router = express.Router();

router.use(verifyToken);
router.use(function requireExplicitAdmin(req, res, next) {
  // verifyToken supplies an admin fallback for missing roles; inspect verified claims.
  let claims;
  try {
    claims = jwt.decode(req.headers.authorization.split(' ')[1]);
  } catch (_) {
    claims = null;
  }
  if (!claims || !['admin', 'superadmin'].includes(claims.role) ||
    !Number.isSafeInteger(Number(claims.id)) || Number(claims.id) < 1 ||
    Object.hasOwn(claims, 'id_pelanggan') || claims.type === 'customer') {
    return res.status(403).json({ success: false, message: 'Akses hanya untuk admin atau superadmin.' });
  }
  req.adminRole = claims.role;
  next();
});

function superadmin(req, res, next) {
  if (req.adminRole !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Tindakan ini hanya untuk superadmin.' });
  }
  next();
}

function endpoint(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      const status = [400, 404, 409, 503].includes(error.statusCode) ? error.statusCode : 500;
      res.status(status).json({ success: false, message: status === 500 ? 'Operasi router gagal.' : error.message });
    }
  };
}

router.get('/', endpoint(async (req, res) => {
  const active = req.query.active_only;
  if (active !== undefined && active !== 'true' && active !== 'false') {
    return res.status(400).json({ success: false, message: 'active_only harus true atau false.' });
  }
  res.json({ success: true, data: await Router.list({ activeOnly: active === 'true' }) });
}));

router.post('/', superadmin, endpoint(async (req, res) => {
  res.status(201).json({ success: true, data: await Router.create(req.body) });
}));

router.put('/:id', superadmin, endpoint(async (req, res) => {
  res.json({ success: true, data: await Router.update(req.params.id, req.body) });
}));

router.delete('/:id', superadmin, endpoint(async (req, res) => {
  res.json({ success: true, data: await Router.remove(req.params.id) });
}));

router.post('/:id/test', superadmin, endpoint(async (req, res) => {
  // Saved inactive routers may be tested, but must never be used as a fallback.
  const saved = await Router.getById(req.params.id, { includePassword: true });
  if (!saved.configured) {
    return res.status(409).json({ success: false, message: 'Router belum dikonfigurasi lengkap.' });
  }
  const config = { host: saved.host, user: saved.username, pass: saved.password, port: saved.port,
    id_router: saved.id_router, nama_router: saved.nama_router };
  // Lazy load: future service integration can safely import the Router model.
  const service = require('../services/mikrotik');
  let online = false;
  try {
    const result = await service.ping(config, true);
    online = Boolean(result && result.online === true);
  } catch (_) {
    // Neither service exceptions nor ping errors are safe to echo to a client.
  }
  res.json({ success: true, data: { id_router: saved.id_router, online,
    ...(online ? {} : { error: 'Router tidak dapat dihubungi.' }) } });
}));

module.exports = router;

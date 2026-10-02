var crypto = require('crypto');

var otpStore = new Map();
var OTP_TTL_MS = 5 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest();
}

function removeExpiredOtps(now) {
  otpStore.forEach(function (record, email) {
    if (record.expiresAt <= now) otpStore.delete(email);
  });
}

function matchesOtp(record, otp) {
  return crypto.timingSafeEqual(record.hash, hashOtp(otp));
}

var Otp = {
  createOtp: function (email, otp, callback) {
    var now = Date.now();
    var normalizedEmail = normalizeEmail(email);
    removeExpiredOtps(now);
    otpStore.set(normalizedEmail, {
      hash: hashOtp(otp),
      expiresAt: now + OTP_TTL_MS
    });
    callback(null);
  },

  checkOtp: function (email, otp, callback) {
    var normalizedEmail = normalizeEmail(email);
    var record = otpStore.get(normalizedEmail);
    if (!record || record.expiresAt <= Date.now()) {
      otpStore.delete(normalizedEmail);
      return callback(null, null);
    }
    if (!matchesOtp(record, otp)) return callback(null, null);
    callback(null, { email: normalizedEmail, expires_at: new Date(record.expiresAt) });
  },

  verifyOtp: function (email, otp, callback) {
    var normalizedEmail = normalizeEmail(email);
    var record = otpStore.get(normalizedEmail);
    if (!record || record.expiresAt <= Date.now()) {
      otpStore.delete(normalizedEmail);
      return callback(null, null);
    }
    if (!matchesOtp(record, otp)) return callback(null, null);
    otpStore.delete(normalizedEmail);
    callback(null, { email: normalizedEmail, expires_at: new Date(record.expiresAt) });
  }
};

module.exports = Otp;

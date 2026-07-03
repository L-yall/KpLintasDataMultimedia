var db = require('../config/db');

var Otp = {
  // Simpan OTP baru untuk email
  createOtp: function(email, otp, callback) {
    // Hapus OTP lama terlebih dahulu agar tidak menumpuk
    var deleteSql = 'DELETE FROM customer_otp WHERE email = ?';
    db.query(deleteSql, [email], function(err) {
      if (err) return callback(err);

      // Set expiry to 5 minutes from now
      var expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      var insertSql = 'INSERT INTO customer_otp (email, otp, expires_at) VALUES (?, ?, ?)';
      
      db.query(insertSql, [email, otp, expiresAt], function(err, result) {
        if (err) return callback(err);
        callback(null, result);
      });
    });
  },

  // Verifikasi OTP
  verifyOtp: function(email, otp, callback) {
    var sql = `
      SELECT * FROM customer_otp 
      WHERE email = ? AND otp = ? AND expires_at > NOW()
    `;
    db.query(sql, [email, otp], function(err, results) {
      if (err) return callback(err, null);
      if (results.length === 0) {
        return callback(null, null); // OTP invalid atau expired
      }
      
      // Hapus OTP setelah berhasil digunakan
      var deleteSql = 'DELETE FROM customer_otp WHERE email = ?';
      db.query(deleteSql, [email], function() {
        callback(null, results[0]);
      });
    });
  }
};

module.exports = Otp;

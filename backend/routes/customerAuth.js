var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var Pelanggan = require('../models/Pelanggan');
var Otp = require('../models/Otp');
var EmailService = require('../services/emailService');

/* POST /api/customer/auth/request-otp - Request OTP via Email */
router.post('/request-otp', function(req, res) {
  var { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email wajib diisi.' });
  }

  // Search customer by email in database
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email tidak terdaftar. Silakan hubungi admin ESP Lintas Data.' 
      });
    }

    var customer = results[0];
    // Generate random 6 digit OTP
    var otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database (using email as identifier)
    Otp.createOtp(customer.email, otpCode, async function(otpErr) {
      if (otpErr) {
        return res.status(500).json({ success: false, message: 'Gagal membuat kode verifikasi.' });
      }

      // Send OTP via Email
      var sendRes = await EmailService.sendOtpEmail(customer.email, {
        nama: customer.nama,
        otp: otpCode
      });

      if (sendRes.success) {
        res.json({ 
          success: true, 
          message: 'Kode OTP telah dikirim ke Email Anda!', 
          email: customer.email 
        });
      } else {
        // Fallback info in response if email fails
        res.status(500).json({ 
          success: false, 
          message: 'Gagal mengirim Email OTP. Silakan coba lagi nanti.' 
        });
      }
    });
  });
});

/* POST /api/customer/auth/verify-otp - Verify OTP and login */
router.post('/verify-otp', function(req, res) {
  var { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi.' });
  }

  // Find customer by email
  var db = require('../config/db');
  var sql = 'SELECT * FROM pelanggan WHERE email = ? LIMIT 1';

  db.query(sql, [email], function(err, results) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    var customer = results[0];

    // Verify OTP using email
    Otp.verifyOtp(customer.email, otp, function(verifyErr, otpRecord) {
      if (verifyErr) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
      }

      // Generate JWT Customer Token
      var token = jwt.sign(
        { 
          id_pelanggan: customer.id_pelanggan, 
          email: customer.email,
          role: 'customer' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Customer stays logged in longer (30 days)
      );

      res.json({
        success: true,
        message: 'Login berhasil!',
        data: {
          token: token,
          customer: {
            id_pelanggan: customer.id_pelanggan,
            nama: customer.nama,
            email: customer.email,
            no_hp: customer.no_hp,
            paket: customer.paket
          }
        }
      });
    });
  });
});

module.exports = router;

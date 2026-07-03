var nodemailer = require('nodemailer');

// Create reusable transporter using Gmail SMTP
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter on startup
transporter.verify(function(error) {
  if (error) {
    console.error('[Email Service] ⚠️  Gagal terhubung ke SMTP Gmail:', error.message);
    console.log('[Email Service] Email akan berjalan dalam mode SANDBOX (log ke console).');
  } else {
    console.log('[Email Service] ✅ SMTP Gmail terhubung dan siap mengirim email.');
  }
});

var EmailService = {
  /**
   * Send a generic email
   * @param {string} toEmail - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML body content
   */
  sendEmail: async function(toEmail, subject, htmlContent) {
    var fromName = process.env.EMAIL_FROM || 'ESP Lintas Data <24percobaan24@gmail.com>';

    console.log('[Email Service] Menyiapkan email ke ' + toEmail + ' | Subject: ' + subject);

    // Sandbox mode if credentials are missing
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('========================================================');
      console.log('⚠️  EMAIL_USER/EMAIL_PASS tidak terkonfigurasi. Mode SANDBOX.');
      console.log('Tujuan: ' + toEmail);
      console.log('Subject: ' + subject);
      console.log('Body:\n' + htmlContent);
      console.log('========================================================');
      return { success: true, status: 'simulated', message: 'Simulated success (Sandbox)' };
    }

    try {
      var info = await transporter.sendMail({
        from: fromName,
        to: toEmail,
        subject: subject,
        html: htmlContent
      });

      console.log('[Email Service] Email berhasil dikirim ke ' + toEmail + ' | MessageId: ' + info.messageId);
      return { success: true, status: 'terkirim', messageId: info.messageId };
    } catch (err) {
      console.error('[Email Service] Gagal mengirim email ke ' + toEmail + ':', err.message);
      return { success: false, status: 'gagal', error: err.message };
    }
  },

  /**
   * Send OTP verification email for customer login
   */
  sendOtpEmail: async function(toEmail, data) {
    var subject = 'Kode OTP Login - ESP Lintas Data Multimedia';
    var html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">🔐 Kode Verifikasi OTP</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">ESP Lintas Data Multimedia</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #333; font-size: 15px;">Halo <strong>${data.nama}</strong>,</p>
          <p style="color: #555; font-size: 14px;">Berikut adalah kode OTP Anda untuk masuk ke Portal Pembayaran:</p>
          <div style="background: #f8f9ff; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #667eea;">${data.otp}</span>
          </div>
          <p style="color: #888; font-size: 13px; text-align: center;">⏳ Kode ini berlaku selama <strong>5 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        </div>
        <div style="background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 11px; margin: 0;">© ESP Lintas Data Multimedia</p>
        </div>
      </div>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send billing reminder email (cron/manual trigger)
   */
  sendReminderEmail: async function(toEmail, data) {
    var subject = 'Pengingat Tagihan Internet - Periode ' + data.periode;
    var html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">⏰ Pengingat Tagihan</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">ESP Lintas Data Multimedia</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #333; font-size: 15px;">Halo <strong>${data.nama}</strong>,</p>
          <p style="color: #555; font-size: 14px;">Ini adalah pengingat otomatis dari ESP Lintas Data Multimedia.</p>
          <div style="background: #fff5f5; border-left: 4px solid #f5576c; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #333; font-size: 14px;">📌 <strong>Detail Tagihan:</strong></p>
            <table style="width: 100%; font-size: 14px; color: #555;">
              <tr><td style="padding: 4px 0;">Periode</td><td style="text-align: right; font-weight: 600;">${data.periode}</td></tr>
              <tr><td style="padding: 4px 0;">Nominal</td><td style="text-align: right; font-weight: 600; color: #f5576c;">Rp ${data.nominal}</td></tr>
              <tr><td style="padding: 4px 0;">Jatuh Tempo</td><td style="text-align: right; font-weight: 600;">${data.dueDateString}</td></tr>
            </table>
          </div>
          <p style="color: #555; font-size: 14px;">Silakan lakukan pembayaran dan konfirmasi melalui portal pembayaran kami:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Bayar Sekarang</a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">Abaikan email ini jika Anda sudah melakukan pembayaran.</p>
        </div>
        <div style="background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 11px; margin: 0;">© ESP Lintas Data Multimedia</p>
        </div>
      </div>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send payment approved confirmation email
   */
  sendPaymentApprovedEmail: async function(toEmail, data) {
    var subject = '✅ Pembayaran Disetujui - Periode ' + data.periode;
    var html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">✅ Pembayaran Disetujui</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">ESP Lintas Data Multimedia</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #333; font-size: 15px;">Halo <strong>${data.nama}</strong>,</p>
          <p style="color: #555; font-size: 14px;">Pembayaran tagihan internet Anda telah <strong style="color: #11998e;">DISETUJUI</strong> oleh Admin.</p>
          <div style="background: #f0fff4; border-left: 4px solid #38ef7d; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; font-size: 14px; color: #555;">
              <tr><td style="padding: 4px 0;">Periode</td><td style="text-align: right; font-weight: 600;">${data.periode}</td></tr>
              <tr><td style="padding: 4px 0;">Nominal</td><td style="text-align: right; font-weight: 600; color: #11998e;">Rp ${data.nominal}</td></tr>
              <tr><td style="padding: 4px 0;">Jatuh Tempo Berikutnya</td><td style="text-align: right; font-weight: 600;">${data.dueDateFormatted}</td></tr>
            </table>
          </div>
          <p style="color: #555; font-size: 14px;">Layanan internet Anda telah aktif kembali. Terima kasih telah berlangganan di ESP Lintas Data Multimedia. 🙏</p>
        </div>
        <div style="background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 11px; margin: 0;">© ESP Lintas Data Multimedia</p>
        </div>
      </div>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send payment rejected notification email
   */
  sendPaymentRejectedEmail: async function(toEmail, data) {
    var subject = '❌ Pembayaran Ditolak - Periode ' + data.periode;
    var html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">❌ Pembayaran Ditolak</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">ESP Lintas Data Multimedia</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #333; font-size: 15px;">Halo <strong>${data.nama}</strong>,</p>
          <p style="color: #555; font-size: 14px;">Bukti transfer pembayaran internet Anda sebesar <strong>Rp ${data.nominal}</strong> untuk periode <strong>${data.periode}</strong> telah <strong style="color: #eb3349;">DITOLAK</strong> oleh Admin.</p>
          <div style="background: #fff5f5; border-left: 4px solid #eb3349; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 4px; color: #333; font-weight: 600; font-size: 14px;">📋 Alasan Penolakan:</p>
            <p style="margin: 0; color: #666; font-style: italic; font-size: 14px;">"${data.alasan_tolak}"</p>
          </div>
          <p style="color: #555; font-size: 14px;">Silakan login kembali ke portal pembayaran dan upload bukti transfer yang benar:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Upload Ulang Bukti</a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">Terima kasih.</p>
        </div>
        <div style="background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 11px; margin: 0;">© ESP Lintas Data Multimedia</p>
        </div>
      </div>
    `;
    return await this.sendEmail(toEmail, subject, html);
  }
};

module.exports = EmailService;

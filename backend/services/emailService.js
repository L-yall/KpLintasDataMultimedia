var nodemailer = require('nodemailer');
var path = require('path');
var fs = require('fs');
var ConfigService = require('./configService');

// Publicly hosted logo URL on raw GitHub to ensure it renders instantly and reliably in Gmail
var LOGO_URL = 'https://raw.githubusercontent.com/rassyhvre/KpLintasDataMultimedia/main/backend/public/logo_ldm.png';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character];
  });
}

/**
 * Creates a Nodemailer transporter instance dynamically using ConfigService or custom options
 */
function getTransporter(customAuth) {
  var emailUser = (customAuth && customAuth.user) || ConfigService.get('EMAIL_USER') || process.env.EMAIL_USER;
  var emailPass = (customAuth && customAuth.pass) || ConfigService.get('EMAIL_PASS') || process.env.EMAIL_PASS;
  var smtpHost = (customAuth && customAuth.host) || ConfigService.get('SMTP_HOST') || process.env.SMTP_HOST;
  var smtpPort = (customAuth && customAuth.port) || ConfigService.get('SMTP_PORT') || process.env.SMTP_PORT;

  if (!emailUser || !emailPass) {
    return null;
  }

  var cleanUser = String(emailUser).trim();
  var cleanPass = String(emailPass).trim();

  if (smtpHost) {
    var portNum = parseInt(smtpPort, 10) || 587;
    return nodemailer.createTransport({
      host: smtpHost,
      port: portNum,
      secure: portNum === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: cleanUser,
      pass: cleanPass
    }
  });
}

var EmailService = {
  /**
   * Send a generic email
   * @param {string} toEmail - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML body content
   * @param {Array} attachments - Optional Nodemailer attachments array
   * @param {Object} customAuth - Optional custom SMTP credentials for testing
   */
  sendEmail: async function (toEmail, subject, htmlContent, attachments, customAuth) {
    // Jika cache belum terisi kredensial, coba muat ulang dari database
    if (!customAuth && (!ConfigService.get('EMAIL_USER') || !ConfigService.get('EMAIL_PASS'))) {
      try {
        await ConfigService.init();
      } catch (initErr) {
        console.warn('[Email Service] ConfigService.init warn:', initErr.message);
      }
    }

    var fromName = (customAuth && customAuth.from) || ConfigService.get('EMAIL_FROM') || process.env.EMAIL_FROM || 'ESP Lintas Data <24percobaan24@gmail.com>';
    var transporter = getTransporter(customAuth);

    console.log('[Email Service] Menyiapkan email ke ' + toEmail + ' | Subject: ' + subject);

    // Sandbox mode if credentials are missing
    if (!transporter) {
      console.log('========================================================');
      console.warn('⚠️  EMAIL_USER/EMAIL_PASS tidak terkonfigurasi di database atau .env.');
      console.warn('Tujuan: ' + toEmail);
      console.warn('Subject: ' + subject);
      console.log('========================================================');
      return {
        success: false,
        status: 'simulated',
        error: 'Konfigurasi EMAIL_USER / EMAIL_PASS belum tersedia di sistem.'
      };
    }

    try {
      var mailOptions = {
        from: fromName,
        to: toEmail,
        subject: subject,
        html: htmlContent
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      var info = await transporter.sendMail(mailOptions);

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
  sendOtpEmail: async function (toEmail, data) {
    var subject = `[${data.otp}] Ini Adalah Kode Verifikasi Kamu`;
    var logoUrl = LOGO_URL;
    var otpImgSrc = 'https://raw.githubusercontent.com/rassyhvre/KpLintasDataMultimedia/main/backend/public/otp_illustration.png';

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        
        <!-- Main Card Container -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.03); overflow: hidden;">
          <tr>
            <td style="padding: 36px 36px 40px;">
              
              <!-- Logo (Top Left) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="left">
                    <a href="https://lintasdata.net.id" target="_blank" style="text-decoration: none; border: 0;">
                      <img src="${logoUrl}" alt="PT. Lintas Data Multimedia" width="130" style="display: block; height: auto; max-width: 130px; border: 0;">
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Custom Character Illustration Showing Phone with WiFi & LDM Logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <img src="${otpImgSrc}" alt="Verifikasi OTP LDM" width="180" style="display: block; height: auto; max-width: 180px; margin: 0 auto; border: 0; border-radius: 8px;">
                  </td>
                </tr>
              </table>

              <!-- Main Headline -->
              <h2 style="margin: 0 0 12px; font-size: 17px; font-weight: 700; color: #0f172a; text-align: left; line-height: 24px;">
                [${data.otp}] Ini Adalah Kode Verifikasi Kamu
              </h2>

              <!-- Subtitle Description -->
              <p style="margin: 0 0 28px; font-size: 14.5px; color: #475569; text-align: left; line-height: 22px;">
                Berikut adalah kode verifikasi yang dapat digunakan untuk login ke Portal Pelanggan LDM Connect:
              </p>

              <!-- Prominent Centered OTP Code -->
              <div style="text-align: center; margin: 32px 0;">
                <span style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #0f172a; display: inline-block;">
                  ${data.otp}
                </span>
              </div>

              <!-- Expiry & Security Notice -->
              <p style="margin: 28px 0 16px; font-size: 13.5px; color: #475569; text-align: left; line-height: 20px;">
                Kode di atas hanya berlaku untuk <strong>5 Menit</strong>. Jangan memberitahukan kode tersebut ke siapapun, termasuk pihak PT Lintas Data Multimedia.
              </p>

              <!-- Support Note -->
              <p style="margin: 0; font-size: 13.5px; color: #475569; text-align: left; line-height: 20px;">
                Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:helpdesk@ldm.net.id" style="color: #006190; text-decoration: underline;">helpdesk@ldm.net.id</a>.
              </p>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send billing reminder email (cron/manual trigger) - Minimalist text style
   */
  sendReminderEmail: async function (toEmail, data, pdfBuffer) {
    var daysDiff = data.daysDiff !== undefined ? data.daysDiff : 1;
    var subject = 'Invoice Tagihan Internet ' + data.nama + ' ' + data.periode;
    var messageText = 'Berikut terlampir invoice tagihan internet Anda untuk periode <strong>' + data.periode + '</strong> sebesar <strong>Rp ' + data.nominal + '</strong>.';
    var dueText = (daysDiff === 14)
      ? 'Tagihan internet ini diterbitkan H-14 sebelum jatuh tempo (<strong>' + data.dueDateString + '</strong>). Mohon dapat melakukan pembayaran sebelum jatuh tempo melalui portal kami:'
      : 'Mohon dapat melakukan pembayaran sebelum tanggal jatuh tempo (<strong>' + data.dueDateString + '</strong>) melalui portal kami:';

    if (daysDiff < 0) {
      subject = ' Tagihan Terlambat ' + data.nama + ' ' + data.periode;
      dueText = 'Tagihan Anda telah <strong>melewati tanggal jatuh tempo</strong> (' + data.dueDateString + '). Mohon segera melakukan pembayaran melalui portal kami:';
    } else if (daysDiff === 0) {
      subject = ' Tagihan Jatuh Tempo Hari Ini ' + data.nama + ' ' + data.periode;
      dueText = 'Tagihan Anda <strong>jatuh tempo pada hari ini</strong> (' + data.dueDateString + '). Mohon segera melakukan pembayaran melalui portal kami:';
    }

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #006190; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 12px 0; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>${messageText}</p>

  <p>${dueText}</p>

  <p><a href="${data.paymentUrl}" class="btn">Bayar & Konfirmasi Sekarang &rarr;</a></p>

  <p>Terima kasih telah mempercayakan PT. Lintas Data Multimedia sebagai teman koneksi internet Anda.</p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:helpdesk@ldm.net.id">helpdesk@ldm.net.id</a> atau WhatsApp <strong>+62 857-2242-2448</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;

    var attachments = null;
    if (pdfBuffer) {
      var cleanName = (data.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
      var cleanPeriode = (data.periode || 'tagihan').replace('-', '');
      attachments = [{
        filename: `Invoice_${cleanPeriode}_${cleanName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }
    return await this.sendEmail(toEmail, subject, html, attachments);
  },

  /**
   * Send payment approved confirmation email - Minimalist text style
   */
  sendPaymentApprovedEmail: async function (toEmail, data, pdfBuffer) {
    var subject = 'Bukti Pembayaran Disetujui ' + data.nama + ' ' + data.periode;

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>Terima kasih, pembayaran tagihan internet Anda untuk periode <strong>${data.periode}</strong> sebesar <strong>Rp ${data.nominal}</strong> telah berhasil kami terima dan disetujui.</p>

  <p>Berikut terlampir bukti kwitansi/invoice lunas resmi Anda untuk tanggal <strong>${data.tanggalBayar || 'hari ini'}</strong>.</p>

  <p>Terima kasih telah mempercayakan PT. Lintas Data Multimedia sebagai penyedia layanan internet Anda.</p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:helpdesk@ldm.net.id">helpdesk@ldm.net.id</a> atau WhatsApp <strong>+62 857-2242-2448</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;

    var attachments = null;
    if (pdfBuffer) {
      var cleanName = (data.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
      var cleanPeriode = (data.periode || 'tagihan').replace('-', '');
      attachments = [{
        filename: `Kwitansi_${cleanPeriode}_${cleanName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }
    return await this.sendEmail(toEmail, subject, html, attachments);
  },

  /**
   * Send payment rejected notification email - Minimalist text style
   */
  sendPaymentRejectedEmail: async function (toEmail, data) {
    var subject = '❌ Pembayaran Ditolak - Periode ' + data.periode;

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
    a { color: #006190; text-decoration: underline; }
  </style>
</head>
<body>
  <p>👋 <strong>${data.nama}</strong>,</p>

  <p>Pengajuan pembayaran Anda untuk periode <strong>${data.periode}</strong> sebesar <strong>Rp ${data.nominal}</strong> belum dapat disetujui oleh admin.</p>

  <p><strong>Alasan Penolakan:</strong> <em>"${data.alasan_tolak}"</em></p>

  <p>Silakan mengunggah ulang bukti pembayaran yang valid melalui link berikut:<br>
  <a href="${data.paymentUrl}">${data.paymentUrl}</a></p>

  <p>Bila ada pertanyaan, silakan hubungi kami pada email <a href="mailto:helpdesk@ldm.net.id">helpdesk@ldm.net.id</a> atau WhatsApp <strong>+62 822-9913-9449</strong>.</p>

  <p>Terima kasih,<br>
  <strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  /**
   * Send PPPoE / WiFi activation notification email
   */
  sendPppoeActivatedEmail: async function (toEmail, data) {
    var nama = escapeHtml(data.nama);
    var pppoeUsername = escapeHtml(data.pppoe_username);
    var paket = escapeHtml(data.paket || '-');
    var dueDate = escapeHtml(data.due_date || '-');
    var loginUrl = data.loginUrl || 'http://localhost:3001/login';
    var registeredEmail = escapeHtml(toEmail);

    var namaIsp = ConfigService.get('NAMA_ISP', 'PT. Lintas Data Multimedia');
    var telpCs = ConfigService.get('TELP_CS', '+62 851-8200-1676');
    var emailCs = ConfigService.get('EMAIL_CS', 'helpdesk@ldm.net.id');
    var logoUrl = LOGO_URL;

    var subject = `🎉 Akun & WiFi Telah Aktif - ${data.nama} | ${namaIsp}`;

    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Akun & Layanan WiFi Telah Diaktifkan</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        
        <!-- Main Card Container -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.04); overflow: hidden;">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 28px 36px 20px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <img src="${logoUrl}" alt="${namaIsp}" width="140" style="display: block; height: auto; max-width: 140px; border: 0;">
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 5px 12px; background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ● Layanan Aktif
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 28px;">
                🎉 Akun & Koneksi WiFi Anda Sudah Aktif!
              </h1>
              
              <p style="margin: 0 0 16px; font-size: 14.5px; color: #475569; line-height: 24px;">
                Halo <strong>${nama}</strong>,
              </p>

              <p style="margin: 0 0 24px; font-size: 14.5px; color: #475569; line-height: 24px;">
                Kabar gembira! Akun PPPoE dan koneksi WiFi Anda telah berhasil dihubungkan dan diaktifkan oleh admin operasional kami. Sekarang Anda sudah dapat menikmati layanan internet berkecepatan tinggi dari <strong>${namaIsp}</strong>.
              </p>

              <!-- Service Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 20px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                    <strong style="font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Informasi Layanan Internet</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 5px 0; font-size: 13.5px; color: #64748b; width: 42%;">Nama Pelanggan</td>
                        <td style="padding: 5px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">${nama}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 13.5px; color: #64748b;">Paket Layanan</td>
                        <td style="padding: 5px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">${paket}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; font-size: 13.5px; color: #64748b;">PPPoE Username</td>
                        <td style="padding: 5px 0; font-size: 13.5px; font-family: monospace; font-weight: 700; color: #006190;">${pppoeUsername}</td>
                      </tr>
                      ${dueDate !== '-' ? `
                      <tr>
                        <td style="padding: 5px 0; font-size: 13.5px; color: #64748b;">Jatuh Tempo</td>
                        <td style="padding: 5px 0; font-size: 13.5px; font-weight: 600; color: #0f172a;">${dueDate}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Login Web Information Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 24px; padding: 18px 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #166534;">
                      🔑 Akses Portal Pelanggan
                    </h3>
                    <p style="margin: 0 0 12px; font-size: 13.5px; color: #15803d; line-height: 22px;">
                      Untuk memantau tagihan, mengunggah bukti pembayaran, dan melihat status layanan internet Anda, silakan login ke web portal pelanggan:
                    </p>
                    <div style="background-color: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px;">
                      <div style="font-size: 12px; color: #6b7280; margin-bottom: 2px;">Email Login:</div>
                      <div style="font-size: 14.5px; font-weight: 700; color: #111827; font-family: monospace;">${registeredEmail}</div>
                      <div style="font-size: 12px; color: #059669; margin-top: 4px;">✓ Gunakan email yang telah didaftarkan oleh admin operasional</div>
                    </div>
                    <div style="text-align: center; margin: 16px 0 6px;">
                      <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 11px 26px; background-color: #006190; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,97,144,0.25);">
                        Masuk ke Portal Pelanggan &rarr;
                      </a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice / Ubah Password Warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; margin-bottom: 24px; padding: 16px 18px;">
                <tr>
                  <td>
                    <strong style="display: block; font-size: 14px; color: #92400e; margin-bottom: 6px;">
                      ⚠️ PENTING: Segera Ubah Password Anda
                    </strong>
                    <p style="margin: 0; font-size: 13px; color: #b45309; line-height: 20px;">
                      Saat pertama kali login, gunakan password yang telah dibuatkan oleh admin operasional. <strong>Demi menjaga privasi dan keamanan akun Anda, jangan lupa untuk segera mengubah password default tersebut</strong> melalui menu profil setelah Anda berhasil masuk ke portal pelanggan.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Support Note -->
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 20px;">
                Bila Anda membutuhkan bantuan atau informasi lebih lanjut, silakan hubungi customer service kami melalui WhatsApp <strong>${telpCs}</strong> atau email <a href="mailto:${emailCs}" style="color: #006190; text-decoration: underline;">${emailCs}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 36px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12.5px; font-weight: 600; color: #475569;">
                ${namaIsp}
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #94a3b8;">
                Email ini dikirim otomatis oleh sistem notifikasi ${namaIsp}.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  },

  sendRegistrationApprovedEmail: async function (toEmail, data) {
    return await this.sendPppoeActivatedEmail(toEmail, data);
  },

  sendRegistrationRejectedEmail: async function (toEmail, data) {
    var nama = escapeHtml(data.nama);
    var alasanTolak = escapeHtml(data.alasan_tolak).replace(/\r?\n/g, '<br>');
    var subject = 'Informasi Pendaftaran Internet - ' + data.nama;
    var html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; margin: 0; padding: 20px; }
  </style>
</head>
<body>
  <p>Halo <strong>${nama}</strong>,</p>
  <p>Mohon maaf, pendaftaran layanan internet Anda belum dapat disetujui.</p>
  <p><strong>Alasan penolakan:</strong><br>${alasanTolak}</p>
  <p>Jika ada pertanyaan atau ingin mengajukan kembali, silakan hubungi kami melalui email <a href="mailto:helpdesk@ldm.net.id">helpdesk@ldm.net.id</a>.</p>
  <p>Terima kasih,<br><strong>PT Lintas Data Multimedia</strong></p>
</body>
</html>
    `;
    return await this.sendEmail(toEmail, subject, html);
  }
};

module.exports = EmailService;

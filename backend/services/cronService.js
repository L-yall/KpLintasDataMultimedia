var cron = require('node-cron');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var ReminderLog = require('../models/ReminderLog');
var EmailService = require('./emailService');
var PdfService = require('./pdfService');
var SocketService = require('./socket');
var MikrotikService = require('./mikrotik');
var BillingService = require('./billingService');
var logger = require('../utils/logger');

// Helper to calculate difference in days between two dates
function getDaysDifference(date1, date2) {
  var d1 = new Date(date1.toISOString().split('T')[0]);
  var d2 = new Date(date2.toISOString().split('T')[0]);
  var diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

var CronService = {
  start: function() {
    logger.box({
      title: 'CRON JOB & AUTOMATION SERVICE',
      subtitle: 'Evaluator Tagihan, Auto-Isolir & Reminder',
      color: 'cyan',
      items: [
        { label: 'Status Service', value: 'Aktif & Siap', color: 'green' },
        { label: 'Jadwal Otomatis', value: 'Setiap Hari Pukul 07:00 WIB' },
        { label: 'Zona Waktu', value: 'Asia/Jakarta (WIB)' },
        { label: 'Otomasi Fitur', value: 'Isolir PPPoE & Lampiran PDF Invoice' }
      ]
    });
    
    // Schedule to run every day at 07:00 AM
    cron.schedule('0 7 * * *', () => {
      logger.info('CRON', 'Menjalankan evaluasi harian tagihan (07:00 WIB)...');
      this.checkAndSendReminders();
    }, {
      scheduled: true,
      timezone: 'Asia/Jakarta'
    });

    // Jalankan verifikasi tagihan dan evaluasi di background (non-blocking agar npm start instan)
    setTimeout(() => {
      BillingService.ensureActiveBills();
      this.checkAndSendReminders();
    }, 2500);
  },

  checkAndSendReminders: async function() {
    var today = new Date();
    
    // We fetch all active unpaid bills
    Tagihan.getUnpaid(async (err, unpaidBills) => {
      if (err) {
        logger.once('cron_db_err', 'warn', 'CRON', `Menunggu database siap: ${err.message}`);
        return;
      }

      if (unpaidBills.length > 0) {
        logger.info('CRON', `Mengevaluasi ${unpaidBills.length} tagihan aktif belum lunas...`);
      }

      // Periksa konektivitas MikroTik sekali saja untuk seluruh tagihan (mencegah timeout berulang kali)
      var pingRes = await MikrotikService.ping();
      var isRouterOnline = pingRes && pingRes.online;
      if (!isRouterOnline) {
        logger.stateChange('cron_mikrotik_status', 'offline', () => {
          logger.warn('CRON', `Router MikroTik tidak terjangkau (${pingRes.error || 'offline'}), penyesuaian isolir PPPoE otomatis dilewati.`);
        });
      }

      for (var i = 0; i < unpaidBills.length; i++) {
        var bill = unpaidBills[i];
        var dueDate = new Date(bill.due_date);
        var daysDiff = getDaysDifference(dueDate, today);
        
        var newStatus = 'hijau';
        var shouldSendReminder = false;

        if (daysDiff < 0) {
          // Overdue / Late
          newStatus = 'merah';
          shouldSendReminder = true; // Email tetap dikirim setiap hari saat menunggak

          if (bill.status !== 'terlambat') {
            Tagihan.updateStatus(bill.id_tagihan, 'terlambat', function(err) {
              if (err) console.error('Failed to update bill status to terlambat:', err.message);
            });
          }

          // ISOLIR MIKROTIK OTOMATIS: Matikan secret PPPoE & putus sesi jika menunggak (hanya jika router online)
          if (bill.pppoe_username && isRouterOnline) {
            try {
              var isolirResult = await MikrotikService.disableSecret(bill.pppoe_username);
              if (isolirResult && isolirResult.success) {
                logger.warn('CRON', `Berhasil isolir PPPoE '${isolirResult.secretName || bill.pppoe_username}' (${bill.nama}) - ${isolirResult.kickedCount || 0} sesi aktif diputus.`);
              }
            } catch (mikrotikErr) {
              logger.error('CRON', `Gagal mengisolir MikroTik untuk ${bill.pppoe_username}: ${mikrotikErr.message}`);
            }
          }
        } else if (daysDiff >= 0 && daysDiff <= 3) {
          // Due in 0 to 3 days (hari-H atau 0-3 hari sebelum jatuh tempo)
          newStatus = 'kuning';
          shouldSendReminder = true;
        } else {
          // Far from due date
          newStatus = 'hijau';
        }

        // 1. Update customer status if changed
        if (bill.status_tagihan !== newStatus) {
          const idPelanggan = bill.id_pelanggan;
          const targetStatus = newStatus;
          const updateData = { status_tagihan: targetStatus };
          if (targetStatus === 'merah') {
            updateData.pppoe_status = 'inactive';
          }
          
          Pelanggan.update(idPelanggan, updateData, function(updateErr) {
            if (updateErr) {
              logger.error('CRON', `Gagal memperbarui status pelanggan #${idPelanggan}: ${updateErr.message}`);
            } else {
              logger.info('CRON', `Status pelanggan #${idPelanggan} (${bill.nama}) -> ${targetStatus}`);
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: idPelanggan,
                status_tagihan: targetStatus,
                pppoe_status: targetStatus === 'merah' ? 'inactive' : bill.pppoe_status
              });
            }
          });
        }

        // 2. Send Email Reminder if shouldSendReminder is true
        if (shouldSendReminder) {
          // Mengirimkan data daysDiff agar pesan email bisa dibedakan
          await this.processEmailReminder(bill, daysDiff);
        }
      }
      
      if (unpaidBills.length > 0) {
        logger.info('CRON', `Evaluasi billing selesai (${unpaidBills.length} tagihan diperiksa).`);
      }
    });
  },

  processEmailReminder: async function(bill, daysDiff) {
    var idPelanggan = bill.id_pelanggan;
    var name = bill.nama;
    var email = bill.email;
    var nominal = Number(bill.nominal).toLocaleString('id-ID');
    var dueDateString = new Date(bill.due_date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    var periode = bill.periode;
    var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}/${encodeURIComponent(email)}`;

    // Check if customer has email
    if (!email) {
      console.log(`[Cron Service] Pelanggan ${name} tidak memiliki email. Skipping reminder.`);
      return;
    }

    return new Promise((resolve) => {
      // Fungsi ini akan mengecek tabel reminder_log
      ReminderLog.hasBeenSentToday(idPelanggan, async (err, alreadySent) => {
        if (err) {
          console.error('[Cron Service] DB check failed for reminder log:', err.message);
          resolve();
          return;
        }

        // Mencegah spam jika cron tereksekusi 2x di hari yang sama
        if (alreadySent) {
          console.log(`[Cron Service] Reminder already sent today to ${name} (${email}). Skipping.`);
          resolve();
          return;
        }

        // Menyusun isi pesan secara dinamis (untuk logging)
        var message = `Halo ${name},\n\nIni adalah pesan otomatis dari ESP Lintas Data Multimedia.\n\n`;

        if (daysDiff < 0) {
            message += `🚨 *PEMBERITAHUAN TUNGGAKAN* 🚨\nTagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* TELAH LEWAT JATUH TEMPO pada tanggal ${dueDateString}.\n\nMohon segera lakukan pembayaran agar koneksi internet Anda tidak terputus secara otomatis.\n\n`;
        } else if (daysDiff === 0) {
            message += `⚠️ *JATUH TEMPO HARI INI* ⚠️\nTagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* telah jatuh tempo pada hari ini (${dueDateString}).\n\n`;
        } else {
            message += `Tagihan internet Anda untuk periode ${periode} sebesar *Rp ${nominal}* akan jatuh tempo dalam *${daysDiff} hari* (${dueDateString}).\n\n`;
        }

        message += `Silakan lakukan pembayaran dan konfirmasi melalui portal kami:\n${paymentUrl}\n\nAbaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.`;

        // Generate PDF Invoice for reminder (isPaid = false)
        var pdfBuffer = null;
        try {
          pdfBuffer = await PdfService.generateInvoicePdf({
            id_tagihan: bill.id_tagihan,
            periode: bill.periode,
            nominal: bill.nominal,
            status: bill.status,
            due_date: bill.due_date,
            created_at: bill.created_at || new Date(),
            nama: name,
            email: email,
            no_hp: bill.no_hp || '-',
            alamat: bill.alamat || '-',
            paket: bill.paket || '-'
          }, false);
        } catch (pdfErr) {
          console.error('[Cron Service] Failed to generate PDF invoice:', pdfErr.message);
        }

        // Send via Email with PDF attachment
        var result = await EmailService.sendReminderEmail(email, {
          nama: name,
          periode: periode,
          nominal: nominal,
          dueDateString: dueDateString,
          paymentUrl: paymentUrl,
          daysDiff: daysDiff,
          paket: bill.paket || '-',
          idPelanggan: idPelanggan,
          idTagihan: bill.id_tagihan,
          alamat: bill.alamat || '-'
        }, pdfBuffer);

        // Record in reminder_log dengan datetime (Terkirim masuk database)
        ReminderLog.create({
          id_pelanggan: idPelanggan,
          status_kirim: result.success ? 'terkirim' : 'gagal',
          pesan: message,
          tanggal_kirim: new Date()
        }, function(logErr) {
          if (logErr) {
            logger.error('CRON', `Gagal mencatat log reminder untuk ${name}: ${logErr.message}`);
          } else {
            logger.success('CRON', `Reminder tagihan berhasil dikirim & dicatat untuk ${name}`);
          }
          resolve();
        });
      });
    });
  }
};

module.exports = CronService;
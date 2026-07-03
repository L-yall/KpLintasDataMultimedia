var cron = require('node-cron');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var ReminderLog = require('../models/ReminderLog');
var EmailService = require('./emailService');
var SocketService = require('./socket');

// Helper to calculate difference in days between two dates
function getDaysDifference(date1, date2) {
  var d1 = new Date(date1.toISOString().split('T')[0]);
  var d2 = new Date(date2.toISOString().split('T')[0]);
  var diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

var CronService = {
  start: function() {
    console.log('Daily Cron Job for billing status & Email reminder initialized.');
    
    // Schedule to run every day at 07:00 AM
    cron.schedule('0 7 * * *', () => {
      console.log('[Cron Job] Running daily check at 07:00 AM...');
      this.checkAndSendReminders();
    });
  },

  checkAndSendReminders: async function() {
    console.log('[Cron Service] Starting billing status evaluation...');
    var today = new Date();
    
    // We fetch all active unpaid bills
    Tagihan.getUnpaid(async (err, unpaidBills) => {
      if (err) {
        console.error('[Cron Service] Error fetching unpaid bills:', err.message);
        return;
      }

      console.log(`[Cron Service] Evaluating ${unpaidBills.length} unpaid bill(s)`);

      for (var i = 0; i < unpaidBills.length; i++) {
        var bill = unpaidBills[i];
        var dueDate = new Date(bill.due_date);
        var daysDiff = getDaysDifference(dueDate, today);
        
        var newStatus = 'hijau';
        var shouldSendReminder = false;

        if (daysDiff < 0) {
          // Overdue / Late
          newStatus = 'merah';
          shouldSendReminder = true; // DITAMBAHKAN: Agar Email tetap dikirim setiap hari saat menunggak

          if (bill.status !== 'terlambat') {
            Tagihan.updateStatus(bill.id_tagihan, 'terlambat', function(err) {
              if (err) console.error('Failed to update bill status to terlambat:', err.message);
            });
          }
        } else if (daysDiff >= 0 && daysDiff <= 3) {
          // Due in 0 to 3 days (diperbaiki agar hari-H atau 0 hari juga terdeteksi)
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
          
          Pelanggan.update(idPelanggan, { status_tagihan: targetStatus }, function(updateErr) {
            if (updateErr) {
              console.error(`[Cron Service] Failed to update customer ${idPelanggan} status:`, updateErr.message);
            } else {
              console.log(`[Cron Service] Updated customer ${idPelanggan} billing status to ${targetStatus}`);
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: idPelanggan,
                status_tagihan: targetStatus
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
      
      console.log('[Cron Service] Billing status evaluation completed.');
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
    var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}`;

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

        // Send via Email
        var result = await EmailService.sendReminderEmail(email, {
          nama: name,
          periode: periode,
          nominal: nominal,
          dueDateString: dueDateString,
          paymentUrl: paymentUrl
        });

        // Record in reminder_log dengan datetime (Terkirim masuk database)
        ReminderLog.create({
          id_pelanggan: idPelanggan,
          status_kirim: result.success ? 'terkirim' : 'gagal',
          pesan: message,
          tanggal_kirim: new Date()
        }, function(logErr) {
          if (logErr) {
            console.error('[Cron Service] Failed to create reminder log:', logErr.message);
          } else {
            console.log(`[Cron Service] Reminder log created for ${name}`);
          }
          resolve();
        });
      });
    });
  }
};

module.exports = CronService;
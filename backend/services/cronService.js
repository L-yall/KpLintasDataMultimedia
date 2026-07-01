var cron = require('node-cron');
var Tagihan = require('../models/Tagihan');
var Pelanggan = require('../models/Pelanggan');
var ReminderLog = require('../models/ReminderLog');
var WhatsAppService = require('./whatsapp');
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
    console.log('Daily Cron Job for billing status & WA reminder initialized.');
    
    // Schedule to run every day at 07:00 AM
    // Schedule format: minute hour day-of-month month day-of-week
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
        var shouldSendWA = false;

        if (daysDiff < 0) {
          // Overdue / Late
          newStatus = 'merah';
          // Update bill status in tagihan to 'terlambat'
          if (bill.status !== 'terlambat') {
            Tagihan.updateStatus(bill.id_tagihan, 'terlambat', function(err) {
              if (err) console.error('Failed to update bill status to terlambat:', err.message);
            });
          }
        } else if (daysDiff >= 1 && daysDiff <= 3) {
          // Due in 1 to 3 days
          newStatus = 'kuning';
          shouldSendWA = true;
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
              // Broadcast via WebSocket
              SocketService.broadcast('pelanggan_updated', {
                id_pelanggan: idPelanggan,
                status_tagihan: targetStatus
              });
            }
          });
        }

        // 2. Send WhatsApp Reminder if status is kuning and not sent today
        if (shouldSendWA) {
          await this.processWAReminder(bill);
        }
      }
      
      console.log('[Cron Service] Billing status evaluation completed.');
    });
  },

  processWAReminder: async function(bill) {
    var idPelanggan = bill.id_pelanggan;
    var name = bill.nama;
    var phone = bill.no_hp;
    var nominal = Number(bill.nominal).toLocaleString('id-ID');
    var dueDateString = new Date(bill.due_date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    var periode = bill.periode;
    var paymentUrl = `${process.env.PAYMENT_PORTAL_URL || 'http://localhost:3001/bayar'}/${phone}`;

    // Check if reminder was already sent today to prevent duplicates
    return new Promise((resolve) => {
      ReminderLog.hasBeenSentToday(idPelanggan, async (err, alreadySent) => {
        if (err) {
          console.error('[Cron Service] DB check failed for reminder log:', err.message);
          resolve();
          return;
        }

        if (alreadySent) {
          console.log(`[Cron Service] Reminder already sent today to ${name} (${phone}). Skipping.`);
          resolve();
          return;
        }

        // Construct message
        var message = `Halo ${name},\n\n` +
          `Ini adalah pengingat otomatis dari ESP Lintas Data Multimedia.\n` +
          `Tagihan internet Anda untuk periode ${periode} sebesar Rp ${nominal} akan jatuh tempo pada tanggal *${dueDateString}*.\n\n` +
          `Silakan lakukan pembayaran dan konfirmasi melalui link berikut:\n` +
          `${paymentUrl}\n\n` +
          `Abaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.`;

        // Send via Fonnte API
        var result = await WhatsAppService.sendWhatsApp(phone, message);

        // Record in reminder_log
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

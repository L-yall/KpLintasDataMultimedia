var axios = require('axios');

// Function to format phone number from local 08xxx to international 628xxx
function formatPhoneNumber(phone) {
  if (!phone) return '';
  // Remove spaces, dashes, or other non-numeric characters
  var cleanPhone = phone.replace(/[^0-9]/g, '');
  
  if (cleanPhone.startsWith('0')) {
    return '62' + cleanPhone.substring(1);
  }
  if (cleanPhone.startsWith('8')) {
    return '62' + cleanPhone;
  }
  return cleanPhone;
}

var WhatsAppService = {
  sendWhatsApp: async function(phone, message) {
    var token = process.env.FONNTE_TOKEN;
    var targetPhone = formatPhoneNumber(phone);

    console.log(`[WhatsApp Service] Menyiapkan pesan ke ${phone} (${targetPhone})`);

    // If Fonnte token is missing, run in sandbox simulation mode
    if (!token || token === 'your-fonnte-token-here') {
      console.log('========================================================');
      console.log('⚠️  FONNTE_TOKEN tidak terkonfigurasi. Berjalan dalam mode SANDBOX.');
      console.log(`Tujuan: ${targetPhone}`);
      console.log(`Pesan:\n${message}`);
      console.log('========================================================');
      return { success: true, status: 'simulated', message: 'Simulated success (Sandbox)' };
    }

    try {
      var response = await axios.post('https://api.fonnte.com/send', {
        target: targetPhone,
        message: message,
        countryCode: '62'
      }, {
        headers: {
          Authorization: token
        },
        timeout: 10000
      });

      // Fonnte returns status true/false
      if (response.data && response.data.status === true) {
        console.log(`[WhatsApp Service] Pesan berhasil dikirim ke ${targetPhone}`);
        return { success: true, status: 'terkirim', raw: response.data };
      } else {
        console.error(`[WhatsApp Service] Fonnte API failure:`, response.data);
        return { success: false, status: 'gagal', error: response.data?.reason || 'Fonnte rejection' };
      }
    } catch (err) {
      console.error(`[WhatsApp Service] Request error to Fonnte:`, err.message);
      return { success: false, status: 'gagal', error: err.message };
    }
  }
};

module.exports = WhatsAppService;

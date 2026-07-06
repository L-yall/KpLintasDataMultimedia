import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TemplateIcon from '../components/TemplateIcon';

function CustomerPortalPage({ onLogout }) {
  var [billing, setBilling] = useState(null);
  var [loading, setLoading] = useState(true);
  var [file, setFile] = useState(null);
  var [preview, setPreview] = useState('');
  var [uploading, setUploading] = useState(false);
  var [message, setMessage] = useState({ type: '', text: '' });

  var token = localStorage.getItem('customer_token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function() {
    fetchBilling();
  }, []);

  async function fetchBilling() {
    try {
      var response = await axios.get('http://localhost:3000/api/customer/portal/billing', { headers: headers });
      if (response.data.success) {
        setBilling(response.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data tagihan:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e) {
    var selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setMessage({ type: 'error', text: 'Silakan pilih file gambar bukti transfer terlebih dahulu.' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    var formData = new FormData();
    formData.append('id_tagihan', billing.id_tagihan);
    formData.append('bukti', file);

    try {
      var response = await axios.post('http://localhost:3000/api/customer/portal/pay', formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setFile(null);
        setPreview('');
        fetchBilling(); // Reload billing data to reflect new status
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Gagal mengunggah bukti pembayaran.' });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <TemplateIcon name="loading" size={20} style={{ marginRight: '8px' }} /> Memuat tagihan Anda...
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', padding: '24px 16px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Portal Pelanggan</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ESP Lintas Data Multimedia</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>
            <TemplateIcon name="logout" size={16} style={{ marginRight: '6px' }} /> Keluar
          </button>
        </div>

        {message.text && (
          <div className={message.type === 'success' ? 'status-badge hijau' : 'login-error'} style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
            {message.type === 'success' ? <TemplateIcon name="check" size={16} /> : <TemplateIcon name="alert" size={16} />} <span style={{ marginLeft: '8px' }}>{message.text}</span>
          </div>
        )}

        {/* Billing Info Card */}
        {!billing ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}><TemplateIcon name="check" size={56} color="var(--primary-light)" /></div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Semua Tagihan Lunas</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Terima kasih atas pembayaran Anda. Layanan internet Anda aktif.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status & Price */}
            <div className="card animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tagihan Periode {billing.periode}
                </span>
                <span className={`status-badge ${billing.status_tagihan}`}>
                  {billing.status === 'menunggu_verifikasi' ? 'Verifikasi Pending' : (billing.status_tagihan === 'kuning' ? 'Jatuh Tempo' : (billing.status_tagihan === 'merah' ? 'Menunggak' : 'Belum Bayar'))}
                </span>
              </div>
              
              <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0', background: 'linear-gradient(135deg, var(--text-primary), var(--primary-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Rp {Number(billing.nominal).toLocaleString('id-ID')}
              </div>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Batas Jatuh Tempo: <strong>{new Date(billing.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            </div>

            {/* Payment instructions */}
            {billing.status !== 'menunggu_verifikasi' && (
              <div className="card animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}><TemplateIcon name="money" size={18} style={{ marginRight: '8px' }} /> Cara Pembayaran</h3>
                
                {/* Bank Transfer */}
                <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Transfer Bank Mandiri</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0', color: 'var(--primary-light)' }}>131-00-1572912-3</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>a/n ESP Lintas Data Multimedia</div>
                </div>

                {/* QRIS */}
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>Atau Scan Kode QRIS di bawah:</div>
                  <div style={{ display: 'inline-block', padding: '10px', background: 'white', borderRadius: '12px', marginBottom: '8px' }}>
                    <img 
                      src="http://localhost:3000/images/qris.png" 
                      alt="QRIS ESP Lintas Data" 
                      style={{ width: '180px', height: '180px', display: 'block', objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Support semua bank & e-wallet (Gopay, OVO, Dana, LinkAja)</div>
                </div>
              </div>
            )}

            {/* Upload Payment Proof */}
            <div className="card animate-fadeIn" style={{ animationDelay: '0.2s' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>
                {billing.status === 'menunggu_verifikasi' ? <><TemplateIcon name="document" size={18} style={{ marginRight: '8px' }} /> Bukti Transfer Anda</> : <><TemplateIcon name="upload" size={18} style={{ marginRight: '8px' }} /> Upload Bukti Transfer</>}
              </h3>

              {billing.status === 'menunggu_verifikasi' ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '10px 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}><TemplateIcon name="loading" size={42} color="var(--primary-light)" /></div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pembayaran Sedang Diverifikasi Admin</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Admin sedang mencocokkan nominal transfer Anda. Internet Anda akan otomatis aktif setelah verifikasi disetujui.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUpload}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', padding: '16px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color-light)', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }}>
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}><TemplateIcon name="camera" size={28} /></span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-light)' }}>
                        {file ? 'Ganti File Gambar' : 'Pilih Foto / Screenshot Bukti'}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                        required
                      />
                    </label>
                  </div>

                  {preview && (
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Preview Bukti:</div>
                      <img 
                        src={preview} 
                        alt="Preview Bukti Transfer" 
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '12px' }}
                    disabled={uploading || !file}
                  >
                    {uploading ? <><TemplateIcon name="loading" size={16} style={{ marginRight: '6px' }} /> Mengunggah...</> : <><TemplateIcon name="upload" size={16} style={{ marginRight: '6px' }} /> Kirim Konfirmasi Pembayaran</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerPortalPage;

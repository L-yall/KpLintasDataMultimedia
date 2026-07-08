var express = require('express');
var router = express.Router();
var db = require('../config/db');
var Pengeluaran = require('../models/Pengeluaran');
var verifyToken = require('../middleware/auth');
var ExcelJS = require('exceljs');
var path = require('path'); // Wajib ditambahkan untuk memanggil path template

// Protect all report routes with admin token
router.use(verifyToken);

/* GET /api/reports/summary - Get financial summary for a period */
router.get('/summary', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  var incomeSql = `
    SELECT COALESCE(SUM(nominal), 0) as total_pemasukan 
    FROM tagihan 
    WHERE status = 'lunas' AND periode = ?
  `;

  var expenseSql = `
    SELECT COALESCE(SUM(nominal), 0) as total_pengeluaran 
    FROM pengeluaran 
    WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
  `;

  db.query(incomeSql, [periode], function(err, incomeRes) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pemasukan.' });
    }

    db.query(expenseSql, [periode], function(err, expenseRes) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran.' });
      }

      var pemasukan = parseFloat(incomeRes[0].total_pemasukan);
      var pengeluaran = parseFloat(expenseRes[0].total_pengeluaran);
      var profit = pemasukan - pengeluaran;

      res.json({
        success: true,
        data: {
          periode: periode,
          total_pemasukan: pemasukan,
          total_pengeluaran: pengeluaran,
          laba_bersih: profit
        }
      });
    });
  });
});

/* GET /api/reports/details - Get financial transactions detail lists */
router.get('/details', function(req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  var incomeSql = `
    SELECT t.*, p.nama, p.no_hp 
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    WHERE t.status = 'lunas' AND t.periode = ?
    ORDER BY t.updated_at DESC
  `;

  db.query(incomeSql, [periode], function(err, incomes) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil detail pemasukan.' });
    }

    Pengeluaran.getAll(periode, function(err, expenses) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil detail pengeluaran.' });
      }

      res.json({
        success: true,
        data: {
          pemasukan_list: incomes,
          pengeluaran_list: expenses
        }
      });
    });
  });
});

/* GET /api/reports/export-excel - EXPORT TABEL ATAS-BAWAH DENGAN DETAIL LENGKAP */
router.get('/export-excel', function (req, res) {
  var { periode } = req.query;
  if (!periode) {
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth() + 1;
    periode = y + '-' + (m < 10 ? '0' + m : m);
  }

  // Menarik data lebih detail (Alamat, Paket, Username PPPoE)
  var incomeSql = `
    SELECT 
      t.*, 
      p.nama, p.email, p.no_hp, p.alamat, p.pppoe_username,
      pk.nama_paket, pk.harga
    FROM tagihan t 
    JOIN pelanggan p ON t.id_pelanggan = p.id_pelanggan 
    LEFT JOIN paket_layanan pk ON p.paket = pk.nama_paket
    WHERE t.status = 'lunas' AND t.periode = ?
    ORDER BY t.updated_at DESC
  `;
  db.query(incomeSql, [periode], function (err, incomes) {
    if (err) {
      console.error("Error SQL Pemasukan:", err);
      return res.status(500).send('Gagal mengambil data pemasukan.');
    }

    Pengeluaran.getAll(periode, async function (err, expenses) {
      if (err) return res.status(500).send('Gagal mengambil data pengeluaran.');

      try {
        var totalPemasukan = incomes.reduce((sum, item) => sum + parseFloat(item.nominal), 0);
        var totalPengeluaran = expenses.reduce((sum, item) => sum + parseFloat(item.nominal), 0);
        var labaBersih = totalPemasukan - totalPengeluaran;

        const templatePath = path.join(__dirname, '../public/templates/template_laporan.xlsx');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);

        const sheet = workbook.getWorksheet('Dashboard');
        if (!sheet) return res.status(500).send('Sheet "Dashboard" tidak ditemukan.');

        // Tembakkan nilai Total
        sheet.getCell('B8').value = totalPemasukan;
        sheet.getCell('D8').value = totalPengeluaran;
        sheet.getCell('E8').value = labaBersih;

        var borderThin = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
        var alignCenter = { vertical: 'middle', horizontal: 'center', wrapText: true };
        var fontTNR = { name: 'Times New Roman', size: 11 };
        var fontTNRHeader = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };

        // ==========================================
        // 1. TABEL DETAIL PEMASUKAN (Di Atas)
        // ==========================================
        var currentRow = 11; 
        
        sheet.getCell(`B${currentRow}`).value = 'DETAIL PEMASUKAN (TAGIHAN LUNAS)';
        sheet.getCell(`B${currentRow}`).font = { name: 'Times New Roman', bold: true, size: 12, color: { argb: 'FF1F497D' } };
        currentRow++;

        var incomeHeaders = [
          'No', 'Tanggal Bayar', 'Nama Pelanggan', 'Alamat', 
          'Email', 'No. HP', 'Paket & Harga', 'Username PPPoE', 'Nominal'
        ];
        
        incomeHeaders.forEach((h, idx) => {
          var cell = sheet.getCell(currentRow, idx + 2); // Mulai dari Kolom B
          cell.value = h;
          cell.font = fontTNRHeader;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; 
          cell.border = borderThin;
          cell.alignment = alignCenter;
        });
        currentRow++;

        incomes.forEach((item, index) => {
          var row = sheet.getRow(currentRow);
          row.getCell(2).value = index + 1; 
          row.getCell(3).value = new Date(item.updated_at).toLocaleDateString('id-ID'); 
          row.getCell(4).value = item.nama;                                             
          row.getCell(5).value = item.alamat || '-';
          row.getCell(6).value = item.email || '-';
          row.getCell(7).value = item.no_hp || '-';
          
          var hargaFormat = item.harga ? item.harga.toLocaleString('id-ID') : '0';
          row.getCell(8).value = `${item.nama_paket || '-'} (Rp ${hargaFormat})`;
          
          row.getCell(9).value = item.pppoe_username || '-';

          var nominalCell = row.getCell(10);                                             
          nominalCell.value = parseFloat(item.nominal);
          nominalCell.numFormat = '"Rp"#,##0'; 
          
          // Loop kolom B (2) sampai J (10)
          for(let col = 2; col <= 10; col++) {
              row.getCell(col).border = borderThin;
              row.getCell(col).font = fontTNR;
              row.getCell(col).alignment = alignCenter;
          }
          currentRow++;
        });

        // ==========================================
        // 2. TABEL DETAIL PENGELUARAN (Di Bawah Pemasukan)
        // ==========================================
        currentRow += 2; 
        
        sheet.getCell(`B${currentRow}`).value = 'DETAIL PENGELUARAN OPERASIONAL';
        sheet.getCell(`B${currentRow}`).font = { name: 'Times New Roman', bold: true, size: 12, color: { argb: 'FFC65911' } };
        currentRow++;

        var expenseHeaders = ['No', 'Tanggal Pengeluaran', 'Kategori', 'Petugas', 'Nominal Pengeluaran'];
        expenseHeaders.forEach((h, idx) => {
          var cell = sheet.getCell(currentRow, idx + 2); 
          cell.value = h;
          cell.font = fontTNRHeader;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC65911' } }; 
          cell.border = borderThin;
          cell.alignment = alignCenter;
        });
        currentRow++;

        expenses.forEach((item, index) => {
          var row = sheet.getRow(currentRow);
          row.getCell(2).value = index + 1; 
          row.getCell(3).value = new Date(item.tanggal).toLocaleDateString('id-ID');     
          row.getCell(4).value = item.kategori || '-';                  
          row.getCell(5).value = item.nama_admin || '-'; 
          
          var nominalCell = row.getCell(6);                                              
          nominalCell.value = parseFloat(item.nominal);
          nominalCell.numFormat = '"Rp"#,##0'; 

          // Loop kolom B (2) sampai F (6)
          for(let col = 2; col <= 6; col++) {
              row.getCell(col).border = borderThin;
              row.getCell(col).font = fontTNR;
              row.getCell(col).alignment = alignCenter;
          }
          currentRow++;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Keuangan_${periode}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Gagal mengekspor laporan.');
      }
    });
  });
});

/* GET /api/reports/yearly-chart - Get 12 months of financial data for line chart */
router.get('/yearly-chart', function(req, res) {
  var year = req.query.year;
  if (!year) {
    year = new Date().getFullYear();
  }
  year = parseInt(year, 10);

  var incomeSql = `
    SELECT 
      CAST(SUBSTRING(periode, 6, 2) AS UNSIGNED) as bulan,
      COALESCE(SUM(nominal), 0) as total
    FROM tagihan
    WHERE status = 'lunas' AND LEFT(periode, 4) = ?
    GROUP BY bulan
    ORDER BY bulan
  `;

  var expenseSql = `
    SELECT 
      MONTH(tanggal) as bulan,
      COALESCE(SUM(nominal), 0) as total
    FROM pengeluaran
    WHERE YEAR(tanggal) = ?
    GROUP BY bulan
    ORDER BY bulan
  `;

  db.query(incomeSql, [year], function(err, incomeRows) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data pemasukan tahunan.' });
    }

    db.query(expenseSql, [year], function(err, expenseRows) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran tahunan.' });
      }

      // Build a map for quick lookup
      var incomeMap = {};
      incomeRows.forEach(function(r) { incomeMap[r.bulan] = parseFloat(r.total); });

      var expenseMap = {};
      expenseRows.forEach(function(r) { expenseMap[r.bulan] = parseFloat(r.total); });

      // Build 12-month array
      var months = [];
      for (var m = 1; m <= 12; m++) {
        var pemasukan = incomeMap[m] || 0;
        var pengeluaran = expenseMap[m] || 0;
        months.push({
          bulan: m,
          pemasukan: pemasukan,
          pengeluaran: pengeluaran,
          laba_bersih: pemasukan - pengeluaran
        });
      }

      res.json({
        success: true,
        data: {
          year: year,
          months: months
        }
      });
    });
  });
});

module.exports = router;
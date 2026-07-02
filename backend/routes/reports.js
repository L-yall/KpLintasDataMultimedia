var express = require('express');
var router = express.Router();
var db = require('../config/db');
var Pengeluaran = require('../models/Pengeluaran');
var verifyToken = require('../middleware/auth');
var ExcelJS = require('exceljs');

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

/* GET /api/reports/export-excel - Export beautifully formatted XLSX report using exceljs */
router.get('/export-excel', function(req, res) {
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
      return res.status(500).send('Gagal mengambil data pemasukan.');
    }

    Pengeluaran.getAll(periode, function(err, expenses) {
      if (err) {
        return res.status(500).send('Gagal mengambil data pengeluaran.');
      }

      var totalPemasukan = incomes.reduce((sum, item) => sum + parseFloat(item.nominal), 0);
      var totalPengeluaran = expenses.reduce((sum, item) => sum + parseFloat(item.nominal), 0);
      var labaBersih = totalPemasukan - totalPengeluaran;

      // 1. Create workbook & sheet
      var workbook = new ExcelJS.Workbook();
      var sheet = workbook.addWorksheet('Laporan Keuangan');
      sheet.views = [{ showGridLines: true }];

      // Styles variables
      var fontName = 'Segoe UI';
      var navyBlue = 'FF1F4E78';
      var lightGray = 'FFF2F2F2';
      var borderThin = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };

      // 2. Add Title Block
      sheet.mergeCells('A1:G1');
      var titleCell = sheet.getCell('A1');
      titleCell.value = 'LAPORAN KEUANGAN BULANAN - ESP LINTAS DATA MULTIMEDIA';
      titleCell.font = { name: fontName, size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyBlue } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(1).height = 36;

      sheet.mergeCells('A2:G2');
      var subtitleCell = sheet.getCell('A2');
      subtitleCell.value = `Periode Penagihan: ${periode}`;
      subtitleCell.font = { name: fontName, size: 10, italic: true, color: { argb: 'FF595959' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 18;

      // 3. Add Summary Cards (Row 4-5)
      // Card 1: Pemasukan
      sheet.mergeCells('A4:B4');
      var card1Lbl = sheet.getCell('A4');
      card1Lbl.value = 'TOTAL PEMASUKAN';
      card1Lbl.font = { name: fontName, size: 9, bold: true, color: { argb: 'FF595959' } };
      card1Lbl.alignment = { horizontal: 'center', vertical: 'middle' };
      card1Lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

      sheet.mergeCells('A5:B5');
      var card1Val = sheet.getCell('A5');
      card1Val.value = totalPemasukan;
      card1Val.font = { name: fontName, size: 13, bold: true, color: { argb: 'FF375623' } };
      card1Val.alignment = { horizontal: 'center', vertical: 'middle' };
      card1Val.numFormat = '"Rp"#,##0';
      card1Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

      // Card 2: Pengeluaran
      sheet.mergeCells('C4:D4');
      var card2Lbl = sheet.getCell('C4');
      card2Lbl.value = 'TOTAL PENGELUARAN';
      card2Lbl.font = { name: fontName, size: 9, bold: true, color: { argb: 'FF595959' } };
      card2Lbl.alignment = { horizontal: 'center', vertical: 'middle' };
      card2Lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };

      sheet.mergeCells('C5:D5');
      var card2Val = sheet.getCell('C5');
      card2Val.value = totalPengeluaran;
      card2Val.font = { name: fontName, size: 13, bold: true, color: { argb: 'FFC65911' } };
      card2Val.alignment = { horizontal: 'center', vertical: 'middle' };
      card2Val.numFormat = '"Rp"#,##0';
      card2Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };

      // Card 3: Laba Bersih
      sheet.mergeCells('E4:G4');
      var card3Lbl = sheet.getCell('E4');
      card3Lbl.value = 'LABA BERSIH (PROFIT)';
      card3Lbl.font = { name: fontName, size: 9, bold: true, color: { argb: 'FF595959' } };
      card3Lbl.alignment = { horizontal: 'center', vertical: 'middle' };
      card3Lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

      sheet.mergeCells('E5:G5');
      var card3Val = sheet.getCell('E5');
      card3Val.value = labaBersih;
      card3Val.font = { name: fontName, size: 13, bold: true, color: { argb: 'FF1F497D' } };
      card3Val.alignment = { horizontal: 'center', vertical: 'middle' };
      card3Val.numFormat = '"Rp"#,##0';
      card3Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

      sheet.getRow(4).height = 18;
      sheet.getRow(5).height = 24;

      // 4. Section: Detail Pemasukan Table (Row 7)
      sheet.mergeCells('A7:F7');
      var incSecCell = sheet.getCell('A7');
      incSecCell.value = '📈 DETAIL PEMASUKAN (TAGIHAN LUNAS)';
      incSecCell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF1F497D' } };
      incSecCell.alignment = { vertical: 'middle' };
      sheet.getRow(7).height = 24;

      // Headers (Row 8)
      var incHeaders = ['No', 'Nama Pelanggan', 'No HP', 'Periode', 'Nominal Pemasukan', 'Tanggal Bayar'];
      incHeaders.forEach((h, idx) => {
        var cell = sheet.getCell(8, idx + 1);
        cell.value = h;
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navyBlue } };
        cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 3 ? 'center' : (idx === 4 ? 'right' : 'left') };
      });
      sheet.getRow(8).height = 20;

      // Rows Pemasukan
      var currentR = 9;
      incomes.forEach((item, idx) => {
        var row = sheet.getRow(currentR);
        row.height = 18;
        
        var dateVal = new Date(item.updated_at).toLocaleDateString('id-ID');

        var cells = [
          idx + 1,
          item.nama,
          item.no_hp,
          item.periode,
          parseFloat(item.nominal),
          dateVal
        ];

        cells.forEach((val, cIdx) => {
          var cell = row.getCell(cIdx + 1);
          cell.value = val;
          cell.font = { name: fontName, size: 10 };
          cell.border = borderThin;
          
          if (cIdx === 0 || cIdx === 3) {
            cell.alignment = { horizontal: 'center' };
          } else if (cIdx === 4) {
            cell.numFormat = '"Rp"#,##0';
            cell.alignment = { horizontal: 'right' };
          }

          // Alternating row background (zebra striping)
          if (currentR % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
          }
        });
        currentR++;
      });

      // 5. Section: Detail Pengeluaran Table
      currentR += 1;
      sheet.mergeCells(`A${currentR}:G${currentR}`);
      var expSecCell = sheet.getCell(`A${currentR}`);
      expSecCell.value = '💸 DETAIL PENGELUARAN OPERASIONAL';
      expSecCell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF833C0C' } };
      expSecCell.alignment = { vertical: 'middle' };
      sheet.getRow(currentR).height = 24;
      
      currentR++;
      // Headers
      var expHeaders = ['No', 'Kategori', 'Tipe', 'Nominal Pengeluaran', 'Tanggal', 'Keterangan', 'Petugas'];
      expHeaders.forEach((h, idx) => {
        var cell = sheet.getCell(currentR, idx + 1);
        cell.value = h;
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF833C0C' } }; // Brownish Accent
        cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 2 || idx === 4 ? 'center' : (idx === 3 ? 'right' : 'left') };
      });
      sheet.getRow(currentR).height = 20;
      
      currentR++;
      expenses.forEach((item, idx) => {
        var row = sheet.getRow(currentR);
        row.height = 18;
        
        var dateVal = new Date(item.tanggal).toLocaleDateString('id-ID');
        var typeLabel = item.tipe === 'fix' ? 'Fix (Bulanan)' : 'Tidak Fix';

        var cells = [
          idx + 1,
          item.kategori,
          typeLabel,
          parseFloat(item.nominal),
          dateVal,
          item.keterangan || '-',
          item.nama_admin || '-'
        ];

        cells.forEach((val, cIdx) => {
          var cell = row.getCell(cIdx + 1);
          cell.value = val;
          cell.font = { name: fontName, size: 10 };
          cell.border = borderThin;
          
          if (cIdx === 0 || cIdx === 2 || cIdx === 4) {
            cell.alignment = { horizontal: 'center' };
          } else if (cIdx === 3) {
            cell.numFormat = '"Rp"#,##0';
            cell.alignment = { horizontal: 'right' };
          }

          if (currentR % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
          }
        });
        currentR++;
      });

      // 6. Autofit column widths dynamically
      sheet.columns.forEach(column => {
        var maxLen = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          var val = cell.value ? cell.value.toString() : '';
          if (val.length > maxLen) maxLen = val.length;
        });
        column.width = Math.max(maxLen + 4, 13);
      });

      // Set explicit format to send Excel response
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Laporan_Keuangan_ESP_${periode}.xlsx`
      );

      workbook.xlsx.write(res).then(function() {
        res.end();
      }).catch(function(err) {
        console.error('Error writing excel workbook:', err);
        res.status(500).send('Gagal mengekspor berkas Excel.');
      });

    });
  });
});

module.exports = router;

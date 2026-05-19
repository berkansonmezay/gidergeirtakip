import { useState, useEffect, useMemo, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight, Clock, Repeat, AlertCircle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, GitCompareArrows } from 'lucide-react';
import api from '../services/api';
import { robotoBase64 } from '../utils/fonts/Roboto.js';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
function formatMoney(n) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n); }

export default function Reports() {
  const [activeTab, setActiveTab] = useState('summary'); // summary, annual, monthly, compare
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catTotal, setCatTotal] = useState(0);

  // Annual Report State
  const [year, setYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [annualLoading, setAnnualLoading] = useState(false);

  // Monthly Report State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyTransactions, setMonthlyTransactions] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Trend Selection State
  const [selectedCatTrend, setSelectedCatTrend] = useState('');
  const [selectedPayeeTrend, setSelectedPayeeTrend] = useState('');

  // Comparison State
  const [compareMonthA, setCompareMonthA] = useState(new Date().getMonth() === 0 ? 10 : new Date().getMonth() - 2);
  const [compareYearA, setCompareYearA] = useState(new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [compareMonthB, setCompareMonthB] = useState(new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1);
  const [compareYearB, setCompareYearB] = useState(new Date().getMonth() < 1 ? new Date().getFullYear() - 1 : new Date().getFullYear());
  const [compareDataA, setCompareDataA] = useState([]);
  const [compareDataB, setCompareDataB] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  useEffect(() => {
    if (activeTab === 'annual' || activeTab === 'monthly') {
      fetchAnnualData();
    }
    if (activeTab === 'monthly') {
      fetchMonthlyDetails();
    }
  }, [activeTab, year, selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeTab === 'compare') {
      fetchCompareData();
    }
  }, [activeTab, compareMonthA, compareYearA, compareMonthB, compareYearB]);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      const [m, c, t] = await Promise.all([
        api.get('/reports/monthly?months=12'),
        api.get('/reports/category-breakdown?type=expense'),
        api.get('/reports/trends?months=12'),
      ]);
      setMonthlyData(m.data.data);
      setCategoryData(c.data.breakdown);
      setCatTotal(c.data.total);
      setTrendData(t.data.data);
    } catch (err) {
      console.error('Summary report error:', err);
    }
    setLoading(false);
  };

  const fetchAnnualData = async () => {
    setAnnualLoading(true);
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const res = await api.get(`/transactions?start_date=${startOfYear}&end_date=${endOfYear}&limit=1000`);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Annual report data error:', err);
    }
    setAnnualLoading(false);
  };

  const fetchMonthlyDetails = async () => {
    setMonthlyLoading(true);
    try {
      const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      const res = await api.get(`/transactions?start_date=${startOfMonth}&end_date=${endOfMonth}&limit=1000`);
      setMonthlyTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Monthly details data error:', err);
    }
    setMonthlyLoading(false);
  };

  const fetchCompareData = async () => {
    setCompareLoading(true);
    try {
      const startA = new Date(compareYearA, compareMonthA, 1).toISOString().split('T')[0];
      const endA = new Date(compareYearA, compareMonthA + 1, 0).toISOString().split('T')[0];
      const startB = new Date(compareYearB, compareMonthB, 1).toISOString().split('T')[0];
      const endB = new Date(compareYearB, compareMonthB + 1, 0).toISOString().split('T')[0];
      const [resA, resB] = await Promise.all([
        api.get(`/transactions?start_date=${startA}&end_date=${endA}&limit=1000`),
        api.get(`/transactions?start_date=${startB}&end_date=${endB}&limit=1000`),
      ]);
      setCompareDataA(resA.data.transactions || []);
      setCompareDataB(resB.data.transactions || []);
    } catch (err) {
      console.error('Compare data error:', err);
    }
    setCompareLoading(false);
  };

  const getCompareStats = () => {
    const processTransactions = (txs) => {
      const cats = {};
      const payees = {};
      let totalIncome = 0;
      let totalExpense = 0;
      txs.forEach(t => {
        if (t.type === 'income') {
          totalIncome += t.amount;
        } else {
          totalExpense += t.amount;
          const cname = t.category_name || 'Diğer';
          const pname = t.payee_name || 'Diğer';
          cats[cname] = (cats[cname] || 0) + t.amount;
          payees[pname] = (payees[pname] || 0) + t.amount;
        }
      });
      return { cats, payees, totalIncome, totalExpense };
    };

    const statsA = processTransactions(compareDataA);
    const statsB = processTransactions(compareDataB);

    const labelA = `${MONTHS[compareMonthA]} ${compareYearA}`;
    const labelB = `${MONTHS[compareMonthB]} ${compareYearB}`;

    // Merge all category keys
    const allCats = [...new Set([...Object.keys(statsA.cats), ...Object.keys(statsB.cats)])];
    const catCompare = allCats.map(name => {
      const valA = statsA.cats[name] || 0;
      const valB = statsB.cats[name] || 0;
      const change = valA > 0 ? ((valB - valA) / valA) * 100 : (valB > 0 ? 100 : 0);
      return { name, [labelA]: valA, [labelB]: valB, change };
    }).sort((a, b) => Math.max(b[labelA], b[labelB]) - Math.max(a[labelA], a[labelB]));

    // Merge all payee keys
    const allPayees = [...new Set([...Object.keys(statsA.payees), ...Object.keys(statsB.payees)])];
    const payeeCompare = allPayees.map(name => {
      const valA = statsA.payees[name] || 0;
      const valB = statsB.payees[name] || 0;
      const change = valA > 0 ? ((valB - valA) / valA) * 100 : (valB > 0 ? 100 : 0);
      return { name, [labelA]: valA, [labelB]: valB, change };
    }).sort((a, b) => Math.max(b[labelA], b[labelB]) - Math.max(a[labelA], a[labelB]));

    const totalChangeExpense = statsA.totalExpense > 0 ? ((statsB.totalExpense - statsA.totalExpense) / statsA.totalExpense) * 100 : 0;
    const totalChangeIncome = statsA.totalIncome > 0 ? ((statsB.totalIncome - statsA.totalIncome) / statsA.totalIncome) * 100 : 0;

    return { statsA, statsB, labelA, labelB, catCompare, payeeCompare, totalChangeExpense, totalChangeIncome };
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      if (activeTab === 'summary') {
        const ws1 = XLSX.utils.json_to_sheet(monthlyData.map(d => ({ Ay: d.month, Yıl: d.year, Gelir: d.income, Gider: d.expense, Bakiye: d.balance })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Aylık Rapor');
        const ws2 = XLSX.utils.json_to_sheet(categoryData.map(d => ({ Kategori: d.name, Toplam: d.total, İşlem: d.count, Yüzde: `${d.percentage}%` })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Kategori Dağılımı');
      } else if (activeTab === 'annual') {
        const { reportData } = getAnnualReportData();
        const exportData = [];
        Object.keys(reportData).sort().forEach(payee => {
          exportData.push({ HarcamaYeri: payee, ...reportData[payee].months.reduce((acc, amt, i) => ({ ...acc, [MONTHS[i]]: amt }), {}), Toplam: reportData[payee].total });
          Object.keys(reportData[payee].categories).sort().forEach(cat => {
            exportData.push({ HarcamaYeri: `  - ${cat}`, ...reportData[payee].categories[cat].months.reduce((acc, amt, i) => ({ ...acc, [MONTHS[i]]: amt }), {}), Toplam: reportData[payee].categories[cat].total });
          });
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Yıllık Gider Listesi');
      } else if (activeTab === 'compare') {
        const { labelA, labelB, catCompare, payeeCompare, statsA, statsB } = getCompareStats();
        const ws1 = XLSX.utils.json_to_sheet(catCompare.map(d => ({
          Kategori: d.name,
          [labelA]: d[labelA],
          [labelB]: d[labelB],
          'Değişim (%)': `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}%`,
        })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Kategori Karşılaştırma');
        const ws2 = XLSX.utils.json_to_sheet(payeeCompare.map(d => ({
          'Harcama Yeri': d.name,
          [labelA]: d[labelA],
          [labelB]: d[labelB],
          'Değişim (%)': `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}%`,
        })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Harcama Yeri Karşılaştırma');
        const ws3 = XLSX.utils.json_to_sheet([{
          Dönem: labelA, Gelir: statsA.totalIncome, Gider: statsA.totalExpense,
        }, {
          Dönem: labelB, Gelir: statsB.totalIncome, Gider: statsB.totalExpense,
        }]);
        XLSX.utils.book_append_sheet(wb, ws3, 'Özet Karşılaştırma');
      } else {
        const { catStats, payeeStats } = getMonthlyStats();
        const ws1 = XLSX.utils.json_to_sheet(catStats.map(d => ({ Kategori: d.name, Tutar: d.value })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Kategori Bazlı Giderler');
        const ws2 = XLSX.utils.json_to_sheet(payeeStats.map(d => ({ HarcamaYeri: d.name, Tutar: d.value })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Harcama Yeri Bazlı Giderler');
      }
      
      XLSX.writeFile(wb, `Aile_Butcesi_Rapor_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { console.error(err); }
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const formatNumber = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

      if (activeTab === 'summary') {
        const doc = new jsPDF();
        doc.setLanguage('tr');
        doc.setDocumentProperties({
          title: 'Aile Bütçesi - Özet Rapor',
          subject: 'Aylık gelir-gider ve kategori dağılımı özet raporu',
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        doc.setFontSize(18);
        doc.text('Aile Bütçesi Raporu', 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        doc.setFontSize(14);
        doc.text('Aylık Gelir-Gider', 14, 42);
        const monthlyTotalIncome = monthlyData.reduce((s, d) => s + d.income, 0);
        const monthlyTotalExpense = monthlyData.reduce((s, d) => s + d.expense, 0);
        const monthlyTotalBalance = monthlyTotalIncome - monthlyTotalExpense;

        autoTable(doc, {
          startY: 46,
          head: [['Ay', 'Gelir', 'Gider', 'Bakiye']],
          body: monthlyData.map(d => [d.month, formatMoney(d.income), formatMoney(d.expense), formatMoney(d.balance)]),
          foot: [['Toplam', formatMoney(monthlyTotalIncome), formatMoney(monthlyTotalExpense), formatMoney(monthlyTotalBalance)]],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        });

        const y2 = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text('Kategori Dağılımı', 14, y2);
        const catTotalAmount = categoryData.reduce((s, d) => s + d.total, 0);
        const catTotalCount = categoryData.reduce((s, d) => s + d.count, 0);

        autoTable(doc, {
          startY: y2 + 4,
          head: [['Kategori', 'Toplam', 'İşlem', 'Yüzde']],
          body: categoryData.map(d => [d.name, formatMoney(d.total), d.count, `${d.percentage}%`]),
          foot: [['Toplam', formatMoney(catTotalAmount), catTotalCount, '100%']],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
        });
        doc.save(`Aile_Butcesi_Ozet_Rapor_${new Date().toISOString().split('T')[0]}.pdf`);

      } else if (activeTab === 'annual') {
        // Yıllık Gider Listesi PDF - Landscape for 12 month columns
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setLanguage('tr');
        doc.setDocumentProperties({
          title: `Yıllık Gider Listesi - ${year}`,
          subject: `${year} yılına ait aylık bazda gider detay raporu`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        doc.setFontSize(18);
        doc.text(`Yıllık Gider Listesi - ${year}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const { reportData, monthTotals, grandTotal } = getAnnualReportData();
        const payeesList = Object.keys(reportData).sort();

        // Build table body rows
        const tableBody = [];
        payeesList.forEach(payee => {
          // Payee header row (bold)
          const payeeRow = [payee, ...reportData[payee].months.map(amt => amt > 0 ? formatNumber(amt) : ''), formatNumber(reportData[payee].total)];
          tableBody.push({ row: payeeRow, isPayee: true });

          // Category rows
          Object.keys(reportData[payee].categories).sort().forEach(cat => {
            const catData = reportData[payee].categories[cat];
            const catRow = [`  ${cat}`, ...catData.months.map(amt => amt > 0 ? formatNumber(amt) : ''), formatNumber(catData.total)];
            tableBody.push({ row: catRow, isPayee: false });
          });
        });

        const head = [['', ...MONTHS, 'Toplam']];
        const foot = [['Genel Toplam', ...monthTotals.map(t => t > 0 ? formatNumber(t) : ''), formatNumber(grandTotal)]];

        autoTable(doc, {
          startY: 36,
          head,
          body: tableBody.map(r => r.row),
          foot,
          styles: { font: 'Roboto', fontSize: 7, cellPadding: 2 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241], halign: 'center', fontSize: 7 },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right', fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 40, halign: 'left' },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
            7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' },
            10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' },
            13: { halign: 'right', font: 'Roboto', fontStyle: 'normal', fontSize: 8 },
          },
          didParseCell: function(data) {
            if (data.section === 'body') {
              const rowInfo = tableBody[data.row.index];
              if (rowInfo && rowInfo.isPayee) {
                data.cell.styles.fillColor = [241, 245, 249];
                data.cell.styles.font = 'Roboto';
                data.cell.styles.fontStyle = 'normal';
                data.cell.styles.fontSize = 8;
                data.cell.styles.textColor = [15, 23, 42];
              }
            }
          },
        });

        // Grand total summary at bottom
        const finalY = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.setTextColor(99, 102, 241);
        doc.text(`Yıllık Toplam Gider: ${formatMoney(grandTotal)}`, 14, finalY);

        doc.save(`Yillik_Gider_Listesi_${year}.pdf`);

      } else if (activeTab === 'monthly') {
        // Aylık Gider Raporu PDF
        const doc = new jsPDF();
        doc.setLanguage('tr');
        doc.setDocumentProperties({
          title: `Aylık Gider Raporu - ${MONTHS[selectedMonth]} ${selectedYear}`,
          subject: `${MONTHS[selectedMonth]} ${selectedYear} aylık gelir, gider ve kategori bazlı analiz raporu`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        doc.setFontSize(18);
        doc.text(`Aylık Gider Raporu - ${MONTHS[selectedMonth]} ${selectedYear}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const { catStats, payeeStats, totalIncome, totalExpense, balance } = getMonthlyStats();

        // Summary box
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Özet', 14, 42);

        autoTable(doc, {
          startY: 46,
          head: [['', 'Tutar']],
          body: [
            ['Gelir', formatMoney(totalIncome)],
            ['Gider', formatMoney(totalExpense)],
            ['Bakiye', formatMoney(balance)],
          ],
          styles: { font: 'Roboto', fontSize: 10 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          columnStyles: { 1: { halign: 'right' } },
          didParseCell: function(data) {
            if (data.section === 'body') {
              if (data.row.index === 0) data.cell.styles.textColor = [16, 185, 129]; // green for income
              if (data.row.index === 1) data.cell.styles.textColor = [239, 68, 68]; // red for expense
              if (data.row.index === 2) data.cell.styles.textColor = balance >= 0 ? [16, 185, 129] : [239, 68, 68];
            }
          },
        });

        // Category breakdown table
        let y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Kategori Bazlı Giderler', 14, y);

        const catTotalAmount = catStats.reduce((s, d) => s + d.value, 0);
        autoTable(doc, {
          startY: y + 4,
          head: [['Kategori', 'Tutar', 'Yüzde']],
          body: catStats.map(d => [
            d.name,
            formatMoney(d.value),
            catTotalAmount > 0 ? `${((d.value / catTotalAmount) * 100).toFixed(1)}%` : '0%',
          ]),
          foot: [['Toplam', formatMoney(catTotalAmount), '100%']],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        // Payee breakdown table
        y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Harcama Yeri Bazlı Giderler', 14, y);

        const payeeTotalAmount = payeeStats.reduce((s, d) => s + d.value, 0);
        autoTable(doc, {
          startY: y + 4,
          head: [['Harcama Yeri', 'Tutar', 'Yüzde']],
          body: payeeStats.map(d => [
            d.name,
            formatMoney(d.value),
            payeeTotalAmount > 0 ? `${((d.value / payeeTotalAmount) * 100).toFixed(1)}%` : '0%',
          ]),
          foot: [['Toplam', formatMoney(payeeTotalAmount), '100%']],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          footStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [241, 245, 249], textColor: [15, 23, 42], halign: 'right' },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        doc.save(`Aylik_Gider_Raporu_${MONTHS[selectedMonth]}_${selectedYear}.pdf`);

      } else if (activeTab === 'compare') {
        // Karşılaştırmalı Analiz PDF
        const doc = new jsPDF();
        doc.setLanguage('tr');
        doc.setDocumentProperties({
          title: `Karşılaştırmalı Analiz`,
          subject: `Dönem karşılaştırma raporu`,
          author: 'Aile Bütçesi',
          creator: 'Aile Bütçesi Finans Yönetimi',
        });
        doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        doc.setFontSize(18);
        doc.text('Karşılaştırmalı Analiz', 14, 22);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const { labelA, labelB, catCompare, payeeCompare, statsA, statsB, totalChangeExpense, totalChangeIncome } = getCompareStats();

        // Summary table
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Dönem Özeti', 14, 42);

        autoTable(doc, {
          startY: 46,
          head: [['', labelA, labelB, 'Değişim']],
          body: [
            ['Gelir', formatMoney(statsA.totalIncome), formatMoney(statsB.totalIncome), `${totalChangeIncome >= 0 ? '+' : ''}${totalChangeIncome.toFixed(1)}%`],
            ['Gider', formatMoney(statsA.totalExpense), formatMoney(statsB.totalExpense), `${totalChangeExpense >= 0 ? '+' : ''}${totalChangeExpense.toFixed(1)}%`],
          ],
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        });

        // Category comparison table
        let y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Kategori Bazlı Karşılaştırma', 14, y);

        autoTable(doc, {
          startY: y + 4,
          head: [['Kategori', labelA, labelB, 'Değişim']],
          body: catCompare.map(d => [
            d.name,
            formatMoney(d[labelA]),
            formatMoney(d[labelB]),
            `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}%`,
          ]),
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
              const row = catCompare[data.row.index];
              if (row) {
                data.cell.styles.textColor = row.change > 0 ? [239, 68, 68] : row.change < 0 ? [16, 185, 129] : [100, 116, 139];
              }
            }
          },
        });

        // Payee comparison table
        y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Harcama Yeri Bazlı Karşılaştırma', 14, y);

        autoTable(doc, {
          startY: y + 4,
          head: [['Harcama Yeri', labelA, labelB, 'Değişim']],
          body: payeeCompare.map(d => [
            d.name,
            formatMoney(d[labelA]),
            formatMoney(d[labelB]),
            `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}%`,
          ]),
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [99, 102, 241] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
              const row = payeeCompare[data.row.index];
              if (row) {
                data.cell.styles.textColor = row.change > 0 ? [239, 68, 68] : row.change < 0 ? [16, 185, 129] : [100, 116, 139];
              }
            }
          },
        });

        doc.save(`Karsilastirmali_Analiz_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (err) { console.error(err); }
  };

  const getAnnualReportData = () => {
    const reportData = {};
    let grandTotal = 0;
    const monthTotals = Array(12).fill(0);
    
    transactions.filter(i => i.type === 'expense').forEach(item => {
      const payee = item.payee_name || 'Diğer Harcama Yeri';
      const cat = item.category_name || 'Belirtilmemiş Kategori';
      const m = new Date(item.date).getMonth();
      
      if (!reportData[payee]) reportData[payee] = { total: 0, categories: {}, months: Array(12).fill(0) };
      if (!reportData[payee].categories[cat]) reportData[payee].categories[cat] = { months: Array(12).fill(0), total: 0 };
      
      reportData[payee].categories[cat].months[m] += item.amount;
      reportData[payee].categories[cat].total += item.amount;
      reportData[payee].months[m] += item.amount;
      reportData[payee].total += item.amount;
      monthTotals[m] += item.amount;
      grandTotal += item.amount;
    });
    return { reportData, monthTotals, grandTotal };
  };

  const getMonthlyStats = () => {
    const cats = {};
    const payees = {};
    let totalIncome = 0;
    let totalExpense = 0;

    monthlyTransactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        const cname = t.category_name || 'Diğer';
        const pname = t.payee_name || 'Diğer';
        cats[cname] = (cats[cname] || 0) + t.amount;
        payees[pname] = (payees[pname] || 0) + t.amount;
      }
    });

    const catStats = Object.keys(cats).map(name => ({ name, value: cats[name] })).sort((a, b) => b.value - a.value);
    const payeeStats = Object.keys(payees).map(name => ({ name, value: payees[name] })).sort((a, b) => b.value - a.value);

    // Annual Trend Logic for the selected year
    const catTrends = {};
    const payeeTrends = {};
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const m = new Date(t.date).getMonth();
      const cname = t.category_name || 'Diğer';
      const pname = t.payee_name || 'Diğer';
      
      if (!catTrends[cname]) catTrends[cname] = Array(12).fill(0);
      if (!payeeTrends[pname]) payeeTrends[pname] = Array(12).fill(0);
      
      catTrends[cname][m] += t.amount;
      payeeTrends[pname][m] += t.amount;
    });

    return { catStats, payeeStats, totalIncome, totalExpense, balance: totalIncome - totalExpense, catTrends, payeeTrends };
  };

  const renderSummaryTab = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Trend chart */}
      <div className="card p-5">
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Gelir-Gider Trendi (12 Ay)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="income" name="Gelir" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="expense" name="Gider" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="savings" name="Tasarruf" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly bar */}
      <div className="card p-5">
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Aylık Karşılaştırma</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
            <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie + table */}
      <div className="card p-5">
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Kategori Dağılımı</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={60} dataKey="total" paddingAngle={2}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatMoney(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1">
            {categoryData.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{c.icon} {c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{c.percentage}%</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatMoney(c.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnnualTab = () => {
    const { reportData, monthTotals, grandTotal } = getAnnualReportData();
    const payeesList = Object.keys(reportData).sort();
    const formatNumber = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    if (annualLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 rounded-full animate-spin border-indigo-500/20 border-t-indigo-500" /></div>;

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"><ChevronLeft size={20} /></button>
            <span className="text-xl font-black">{year}</span>
            <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"><ChevronRight size={20} /></button>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Yıllık Toplam Gider</p>
            <p className="text-xl font-black text-red-500">{formatMoney(grandTotal)}</p>
          </div>
        </div>

        <div className="card overflow-x-auto shadow-sm p-0 md:p-4 animate-fade-in" style={{ backgroundColor: 'var(--bg-card)' }}>
          <div className="min-w-max border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[11px] font-sans">
              <thead>
                <tr className="bg-[var(--bg-card)]">
                  <th className="p-2 border border-[var(--border)] text-left font-bold text-[var(--text-primary)]" style={{ width: '180px' }}></th>
                  {MONTHS.map(m => <th key={m} className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[70px]">{m}</th>)}
                  <th className="p-2 border border-[var(--border)] text-center text-[var(--text-secondary)] font-bold min-w-[80px]">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {payeesList.map(payee => {
                  const cats = Object.keys(reportData[payee].categories).sort();
                  return (
                    <Fragment key={payee}>
                      {/* Payee Header Row */}
                      <tr className="bg-[var(--bg-secondary)]">
                        <td className="p-2 border border-[var(--border)] font-bold text-[var(--text-primary)] text-center text-xs">{payee}</td>
                        {reportData[payee].months.map((amt, i) => (
                          <td key={i} className="p-2 border border-[var(--border)] text-right font-bold text-[var(--income)] text-xs">
                            {amt > 0 ? formatNumber(amt) : ''}
                          </td>
                        ))}
                        <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--income)] text-xs">
                          {formatNumber(reportData[payee].total)}
                        </td>
                      </tr>
                      {/* Category Rows */}
                      {cats.map(cat => {
                        const rowData = reportData[payee].categories[cat];
                        return (
                          <tr key={cat} className="hover:bg-[var(--bg-secondary)] transition-colors bg-[var(--bg-card)]">
                            <td className="p-2 pl-3 border border-[var(--border)] font-semibold text-[var(--text-primary)]">{cat}</td>
                            {rowData.months.map((amt, i) => (
                              <td key={i} className="p-2 border border-[var(--border)] text-right text-[var(--text-secondary)]">
                                {amt > 0 ? formatNumber(amt) : ''}
                              </td>
                            ))}
                            <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)]">
                              {formatNumber(rowData.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {/* Grand Total Row */}
                <tr className="bg-[var(--bg-secondary)]">
                  <td className="p-2 border border-[var(--border)] font-bold text-right text-[var(--text-primary)] text-xs">Genel Toplam</td>
                  {monthTotals.map((total, idx) => (
                    <td key={idx} className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)] text-xs">
                      {total > 0 ? formatNumber(total) : ''}
                    </td>
                  ))}
                  <td className="p-2 border border-[var(--border)] text-right font-bold text-[var(--expense)] text-xs">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyTab = () => {
    const { catStats, payeeStats, totalIncome, totalExpense, balance, catTrends, payeeTrends } = getMonthlyStats();
    
    const catTrendItems = Object.keys(catTrends).sort();
    const payeeTrendItems = Object.keys(payeeTrends).sort();

    const catTrendData = (selectedCatTrend && catTrends[selectedCatTrend]) 
      ? catTrends[selectedCatTrend].map((val, i) => ({ month: MONTHS[i], Tutar: val }))
      : [];
      
    const payeeTrendData = (selectedPayeeTrend && payeeTrends[selectedPayeeTrend]) 
      ? payeeTrends[selectedPayeeTrend].map((val, i) => ({ month: MONTHS[i], Tutar: val }))
      : [];

    if (monthlyLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 rounded-full animate-spin border-indigo-500/20 border-t-indigo-500" /></div>;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row items-center justify-between bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-indigo-500/20"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-indigo-500/20"
            >
              {[year - 2, year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 flex-1 w-full md:w-auto">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Gelir</p>
              <p className="text-sm font-black text-emerald-500">{formatMoney(totalIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Gider</p>
              <p className="text-sm font-black text-red-500">{formatMoney(totalExpense)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Bakiye</p>
              <p className={`text-sm font-black ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatMoney(balance)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-base font-bold mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Kategori Dağılımı ({MONTHS[selectedMonth]})
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catStats} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {catStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-base font-bold mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Harcama Yeri Dağılımı ({MONTHS[selectedMonth]})
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payeeStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip formatter={(v) => formatMoney(v)} cursor={{ fill: 'var(--bg-secondary)', opacity: 0.4 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-base font-bold mb-6">En Çok Harcama Yapılan Yerler ({MONTHS[selectedMonth]})</h3>
          <div className="space-y-3">
            {payeeStats.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-[var(--bg-card)] text-[10px] font-black border border-[var(--border)]">{i + 1}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-1.5 bg-[var(--border)] rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full bg-red-500/60" style={{ width: `${(p.value / payeeStats[0].value) * 100}%` }} />
                  </div>
                  <span className="text-sm font-black text-red-500">{formatMoney(p.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Trend Section */}
        <div className="card p-6 border-2 border-indigo-500/10">
          <h3 className="text-lg font-black flex items-center gap-2 mb-6">
            <Clock className="text-indigo-500" size={20} />
            Yıllık Kategori Trendi
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">Kategori Seçin</p>
              <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar border border-[var(--border)] rounded-xl p-1">
                {catTrendItems.map(item => (
                  <button
                    key={item}
                    onClick={() => setSelectedCatTrend(item)}
                    className={`text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${selectedCatTrend === item ? 'bg-indigo-500 text-white shadow-lg scale-[1.02]' : 'bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              {selectedCatTrend ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(1)}K`} />
                      <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="Tutar" fill="#6366f1" radius={[6, 6, 0, 0]}>
                        {catTrendData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === selectedMonth ? '#4f46e5' : '#818cf8'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center bg-[var(--bg-secondary)]/20 rounded-3xl border-2 border-dashed border-[var(--border)]">
                  <p className="text-sm font-bold text-[var(--text-muted)]">Kategori seçiniz</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payee Trend Section */}
        <div className="card p-6 border-2 border-rose-500/10">
          <h3 className="text-lg font-black flex items-center gap-2 mb-6">
            <Clock className="text-rose-500" size={20} />
            Yıllık Harcama Yeri Trendi
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">Harcama Yeri Seçin</p>
              <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar border border-[var(--border)] rounded-xl p-1">
                {payeeTrendItems.map(item => (
                  <button
                    key={item}
                    onClick={() => setSelectedPayeeTrend(item)}
                    className={`text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${selectedPayeeTrend === item ? 'bg-rose-500 text-white shadow-lg scale-[1.02]' : 'bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              {selectedPayeeTrend ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payeeTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(1)}K`} />
                      <Tooltip formatter={(v) => formatMoney(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="Tutar" fill="#f43f5e" radius={[6, 6, 0, 0]}>
                        {payeeTrendData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === selectedMonth ? '#e11d48' : '#fb7185'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center bg-[var(--bg-secondary)]/20 rounded-3xl border-2 border-dashed border-[var(--border)]">
                  <p className="text-sm font-bold text-[var(--text-muted)]">Harcama yeri seçiniz</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompareTab = () => {
    const { statsA, statsB, labelA, labelB, catCompare, payeeCompare, totalChangeExpense, totalChangeIncome } = getCompareStats();
    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

    const ChangeIcon = ({ val }) => {
      if (val > 0) return <ArrowUpRight size={14} className="text-red-500" />;
      if (val < 0) return <ArrowDownRight size={14} className="text-emerald-500" />;
      return <Minus size={14} className="text-gray-400" />;
    };

    const ChangeBadge = ({ val }) => {
      const color = val > 0 ? 'text-red-500 bg-red-50' : val < 0 ? 'text-emerald-500 bg-emerald-50' : 'text-gray-500 bg-gray-50';
      return (
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${color}`}>
          <ChangeIcon val={val} />
          {val >= 0 ? '+' : ''}{val.toFixed(1)}%
        </span>
      );
    };

    const CustomTooltip = ({ active, payload, label }) => {
      if (!active || !payload?.length) return null;
      const item = catCompare.find(c => c.name === label) || payeeCompare.find(p => p.name === label);
      return (
        <div className="p-3 rounded-2xl border-none shadow-xl" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
          <p className="text-xs font-black mb-2">{label}</p>
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
              <span className="text-[var(--text-muted)]">{p.name}:</span>
              <span className="font-black">{formatMoney(p.value)}</span>
            </div>
          ))}
          {item && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)]">Değişim: </span>
              <ChangeBadge val={item.change} />
            </div>
          )}
        </div>
      );
    };

    if (compareLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 rounded-full animate-spin border-indigo-500/20 border-t-indigo-500" /></div>;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Period Selectors */}
        <div className="card p-5">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-1 w-full">
              <div className="flex items-center gap-2 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-2xl px-4 py-3 flex-1">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mr-2">Dönem A</span>
                <select value={compareMonthA} onChange={e => setCompareMonthA(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-indigo-500/20"
                >
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select value={compareYearA} onChange={e => setCompareYearA(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-indigo-500/20"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border)]">
                <GitCompareArrows size={18} className="text-[var(--text-muted)]" />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-1 w-full">
              <div className="flex items-center gap-2 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-2xl px-4 py-3 flex-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mr-2">Dönem B</span>
                <select value={compareMonthB} onChange={e => setCompareMonthB(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-emerald-500/20"
                >
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select value={compareYearB} onChange={e => setCompareYearB(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border-none text-sm font-bold focus:ring-2 ring-emerald-500/20"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Gider ({labelA})</p>
            <p className="text-lg font-black text-red-500">{formatMoney(statsA.totalExpense)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Gider ({labelB})</p>
            <p className="text-lg font-black text-red-500">{formatMoney(statsB.totalExpense)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Gider Değişimi</p>
            <div className="flex items-center gap-2">
              <p className={`text-lg font-black ${totalChangeExpense > 0 ? 'text-red-500' : totalChangeExpense < 0 ? 'text-emerald-500' : 'text-gray-500'}`}>
                {totalChangeExpense >= 0 ? '+' : ''}{totalChangeExpense.toFixed(1)}%
              </p>
              <ChangeIcon val={totalChangeExpense} />
            </div>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Gelir Değişimi</p>
            <div className="flex items-center gap-2">
              <p className={`text-lg font-black ${totalChangeIncome > 0 ? 'text-emerald-500' : totalChangeIncome < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {totalChangeIncome >= 0 ? '+' : ''}{totalChangeIncome.toFixed(1)}%
              </p>
              <ChangeIcon val={-totalChangeIncome} />
            </div>
          </div>
        </div>

        {/* Category Comparison Chart */}
        <div className="card p-6">
          <h3 className="text-base font-black mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            Kategori Bazlı Karşılaştırma
          </h3>
          {catCompare.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)] text-sm">Seçilen dönemlerde gider verisi bulunamadı</div>
          ) : (
            <div style={{ height: Math.max(300, catCompare.length * 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catCompare} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey={labelA} fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                  <Bar dataKey={labelB} fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payee Comparison Chart */}
        <div className="card p-6">
          <h3 className="text-base font-black mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            Harcama Yeri Bazlı Karşılaştırma
          </h3>
          {payeeCompare.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)] text-sm">Seçilen dönemlerde gider verisi bulunamadı</div>
          ) : (
            <div style={{ height: Math.max(300, payeeCompare.length * 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payeeCompare} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey={labelA} fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                  <Bar dataKey={labelB} fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detailed Comparison Table */}
        <div className="card p-6">
          <h3 className="text-base font-black mb-6">Detaylı Karşılaştırma Tablosu</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Kategori</th>
                  <th className="text-right py-3 px-3 text-xs font-bold" style={{ color: '#6366f1' }}>{labelA}</th>
                  <th className="text-right py-3 px-3 text-xs font-bold" style={{ color: '#10b981' }}>{labelB}</th>
                  <th className="text-right py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Fark</th>
                  <th className="text-right py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Değişim</th>
                </tr>
              </thead>
              <tbody>
                {catCompare.map((item, i) => {
                  const diff = item[labelB] - item[labelA];
                  return (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{item.name}</td>
                      <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{formatMoney(item[labelA])}</td>
                      <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{formatMoney(item[labelB])}</td>
                      <td className={`py-3 px-3 text-right font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {diff > 0 ? '+' : ''}{formatMoney(diff)}
                      </td>
                      <td className="py-3 px-3 text-right"><ChangeBadge val={item.change} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payee Detailed Table */}
        <div className="card p-6">
          <h3 className="text-base font-black mb-6">Harcama Yeri Detaylı Karşılaştırma</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Harcama Yeri</th>
                  <th className="text-right py-3 px-3 text-xs font-bold" style={{ color: '#6366f1' }}>{labelA}</th>
                  <th className="text-right py-3 px-3 text-xs font-bold" style={{ color: '#10b981' }}>{labelB}</th>
                  <th className="text-right py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Fark</th>
                  <th className="text-right py-3 px-3 text-[var(--text-muted)] text-xs font-bold">Değişim</th>
                </tr>
              </thead>
              <tbody>
                {payeeCompare.map((item, i) => {
                  const diff = item[labelB] - item[labelA];
                  return (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{item.name}</td>
                      <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{formatMoney(item[labelA])}</td>
                      <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{formatMoney(item[labelB])}</td>
                      <td className={`py-3 px-3 text-right font-bold ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {diff > 0 ? '+' : ''}{formatMoney(diff)}
                      </td>
                      <td className="py-3 px-3 text-right"><ChangeBadge val={item.change} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-32"><div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Raporlar</h2>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Finansal durumunuzu analiz edin</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="btn btn-secondary btn-sm h-10 px-4"><Download size={18} /> PDF</button>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm h-10 px-4"><FileSpreadsheet size={18} /> Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl w-fit border border-[var(--border)] shadow-inner">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'summary' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Özet Rapor
        </button>
        <button 
          onClick={() => setActiveTab('annual')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'annual' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Yıllık Gider Listesi
        </button>
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'monthly' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Aylık Gider Raporu
        </button>
        <button 
          onClick={() => setActiveTab('compare')}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'compare' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-md translate-y-0' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          Karşılaştırmalı Analiz
        </button>
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'summary' ? renderSummaryTab() : activeTab === 'annual' ? renderAnnualTab() : activeTab === 'monthly' ? renderMonthlyTab() : renderCompareTab()}
      </div>
    </div>
  );
}

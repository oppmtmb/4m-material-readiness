import React, { useState, useMemo, useEffect } from 'react';
import { ComparedResult, MatchStatus, Stats } from '../types';
import { 
  Search, 
  Filter, 
  Download, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  RefreshCw, 
  FileText, 
  TrendingUp, 
  Sparkles, 
  Loader2, 
  Sliders, 
  Eye, 
  Database
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../LanguageContext';
import html2canvas from 'html2canvas';

// Helper to convert oklch(...) colors to standard, html2canvas-supported hsl(...) colors
function oklchToHsl(oklchStr: string): string {
  const match = oklchStr.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+(?:deg)?)(?:\s*[\/]\s*([\d.]+%?))?\s*\)/i) ||
                oklchStr.match(/oklch\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+(?:deg)?)(?:\s*,\s*([\d.]+%?))?\s*\)/i);
  if (!match) return oklchStr;

  let lVal = parseFloat(match[1]);
  if (match[1].includes('%')) lVal /= 100;
  
  let cVal = parseFloat(match[2]);
  if (match[2].includes('%')) cVal /= 100;

  let hVal = parseFloat(match[3]);

  const alpha = match[4] ? match[4] : '1';

  const h = Math.round(hVal);
  const s = Math.min(100, Math.round(cVal * 250));
  const l = Math.min(100, Math.round(lVal * 100));

  if (alpha === '1' || alpha === '100%') {
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else {
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
}

// Helper to convert oklab(...) colors to standard, html2canvas-supported rgb(...) colors
function oklabToRgb(oklabStr: string): string {
  const match = oklabStr.match(/oklab\(\s*([\d.]+%?)\s+([\d.-]+%?)\s+([\d.-]+%?)(?:\s*[\/]\s*([\d.]+%?))?\s*\)/i);
  if (!match) return 'rgb(128, 128, 128)';
  
  let lVal = parseFloat(match[1]);
  if (match[1].includes('%')) lVal /= 100;
  
  const grayVal = Math.max(0, Math.min(255, Math.round(lVal * 255)));
  const alpha = match[4] ? match[4] : '1';
  
  if (alpha === '1' || alpha === '100%') {
    return `rgb(${grayVal}, ${grayVal}, ${grayVal})`;
  } else {
    return `rgba(${grayVal}, ${grayVal}, ${grayVal}, ${alpha})`;
  }
}

function cleanColorValue(val: any): any {
  if (typeof val !== 'string') return val;
  if (!val.includes('oklch') && !val.includes('oklab')) return val;
  
  let cleaned = val;
  cleaned = cleaned.replace(/oklch\([^)]+\)/gi, (m) => oklchToHsl(m));
  cleaned = cleaned.replace(/oklab\([^)]+\)/gi, (m) => oklabToRgb(m));
  return cleaned;
}

// Helper component for beautiful, responsive pure-SVG Donut Pie Charts
function SvgPieChart({ first, second, good, notReported, size = 110 }: { first: number; second: number; good: number; notReported: number; size?: number }) {
  const total = first + second + good + notReported;
  
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="inline-block">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#E5E7EB" strokeWidth="16" />
        <text x="50" y="54" textAnchor="middle" className="text-[9px] font-mono fill-zinc-400">NO DATA</text>
      </svg>
    );
  }

  const data = [
    { label: 'Need to Check', value: first, color: '#EF4444' },
    { label: '2nd', value: second, color: '#F59E0B' },
    { label: 'Good / NR', value: good + notReported, color: '#10B981' },
  ].filter(d => d.value > 0);

  let accumulatedAngle = 0;
  const radius = 38;
  const center = 50;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="inline-block select-none overflow-visible">
      {data.map((slice, index) => {
        const percentage = (slice.value / total) * 100;
        const angle = (slice.value / total) * 360;
        
        const x1 = center + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y1 = center + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        accumulatedAngle += angle;
        
        const x2 = center + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y2 = center + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const pathData = Math.abs(percentage - 100) < 0.01
          ? `M 50 12 A 38 38 0 1 1 49.99 12 Z`
          : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        return (
          <path
            key={index}
            d={pathData}
            fill={slice.color}
            stroke="#ffffff"
            strokeWidth="1.5"
            className="transition-all duration-300 hover:opacity-90 cursor-help"
          >
            <title>{`${slice.label}: ${slice.value} (${Math.round(percentage)}%)`}</title>
          </path>
        );
      })}
      <circle cx="50" cy="50" r="22" fill="#ffffff" stroke="#E5E7EB" strokeWidth="0.5" />
      <text x="50" y="53" textAnchor="middle" className="text-[11px] font-mono font-bold fill-zinc-800">
        {total}
      </text>
    </svg>
  );
}

// Custom specialized Donut chart for the Slide Report (Matching User Image)
function SvgReadinessPieChart({ needToCheck, conflict, goodNr, size = 180 }: { needToCheck: number; conflict: number; goodNr: number; size?: number }) {
  const total = needToCheck + conflict + goodNr;
  
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="inline-block">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#E5E7EB" strokeWidth="16" />
        <text x="50" y="54" textAnchor="middle" className="text-[9px] font-mono fill-zinc-400">NO DATA</text>
      </svg>
    );
  }

  const data = [
    { label: 'Need to Check', value: needToCheck, color: '#EF4444' }, // Red
    { label: '2nd', value: conflict, color: '#F59E0B' },             // Yellow
    { label: 'Good / NR', value: goodNr, color: '#10B981' },         // Green
  ].filter(d => d.value > 0);

  let accumulatedAngle = 0;
  const radius = 38;
  const center = 50;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="inline-block select-none overflow-visible">
      {data.map((slice, index) => {
        const percentage = (slice.value / total) * 100;
        const angle = (slice.value / total) * 360;
        
        const x1 = center + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y1 = center + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        accumulatedAngle += angle;
        
        const x2 = center + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y2 = center + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const pathData = Math.abs(percentage - 100) < 0.01
          ? `M 50 12 A 38 38 0 1 1 49.99 12 Z`
          : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        // Calculate arc mid-angle for clean inner labels
        const labelAngle = accumulatedAngle - (angle / 2) - 90;
        const labelRadius = radius * 0.65;
        const lx = center + labelRadius * Math.cos(labelAngle * Math.PI / 180);
        const ly = center + labelRadius * Math.sin(labelAngle * Math.PI / 180);

        return (
          <g key={index}>
            <path
              d={pathData}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="2.5"
              className="transition-all duration-300 hover:opacity-95"
            >
              <title>{`${slice.label}: ${slice.value} (${Math.round(percentage)}%)`}</title>
            </path>
            {percentage > 4 && (
              <text
                x={lx}
                y={ly + 2}
                textAnchor="middle"
                fill="#ffffff"
                className="text-[6.5px] font-sans font-black pointer-events-none drop-shadow-sm"
              >
                {Math.round(percentage)}%
              </text>
            )}
          </g>
        );
      })}
      {/* Inner donut hole cutout */}
      <circle cx="50" cy="50" r="23" fill="#ffffff" stroke="#F1F3F5" strokeWidth="1" />
      <g className="pointer-events-none select-none">
        <text x="50" y="47" textAnchor="middle" className="text-[6.5px] uppercase font-bold tracking-widest fill-zinc-400">
          Total
        </text>
        <text x="50" y="58" textAnchor="middle" className="text-[12px] font-sans font-black fill-zinc-800">
          {total}
        </text>
      </g>
    </svg>
  );
}

interface ResultsDisplayProps {
  results: ComparedResult[];
  stats: Stats;
}

export default function ResultsDisplay({ results, stats }: ResultsDisplayProps) {
  const { t, locale } = useLanguage();
  const [activeMmoTab, setActiveMmoTab] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'ALL'>('ALL');
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Active Screen View Tab: default to 'report' as requested by the user
  const [activeTab, setActiveTab] = useState<'database' | 'report'>('report');

  // Customizable slide report settings
  const [reportTitle, setReportTitle] = useState('');
  const [reportBomRef, setReportBomRef] = useState('');
  const [reportPeriod, setReportPeriod] = useState('');
  const [reportDate, setReportDate] = useState('');

  const [reportBullet1, setReportBullet1] = useState('');
  const [reportBullet2, setReportBullet2] = useState('');
  const [reportBullet3, setReportBullet3] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Group results by MMO
  const mmoGroups = useMemo(() => {
    const groups: { [mmo: string]: { 
      mmo: string; 
      first: number; 
      second: number; 
      good: number; 
      notReported: number; 
      total: number; 
      pns: ComparedResult[] 
    } } = {};

    results.forEach(row => {
      const mmo = row.MMO || 'Unknown MMO';
      if (!groups[mmo]) {
        groups[mmo] = { 
          mmo, 
          first: 0, 
          second: 0, 
          good: 0, 
          notReported: 0, 
          total: 0, 
          pns: [] 
        };
      }
      if (row.status === '1st') groups[mmo].first++;
      else if (row.status === '2nd') groups[mmo].second++;
      else if (row.status === 'Good') groups[mmo].good++;
      else if (row.status === 'Not reported') groups[mmo].notReported++;
      
      groups[mmo].total++;
      groups[mmo].pns.push(row);
    });

    return Object.values(groups);
  }, [results]);

  // Synchronize activeMmoTab with the first MMO in mmoGroups
  useEffect(() => {
    if (mmoGroups.length > 0) {
      const exists = mmoGroups.some(g => g.mmo === activeMmoTab);
      if (!exists) {
        setActiveMmoTab(mmoGroups[0].mmo);
      }
    } else {
      setActiveMmoTab('');
    }
  }, [mmoGroups, activeMmoTab]);

  const activeGroup = useMemo(() => {
    return mmoGroups.find(g => g.mmo === activeMmoTab) || mmoGroups[0];
  }, [mmoGroups, activeMmoTab]);

  const needToCheckCount = activeGroup ? activeGroup.first : 0; 
  const conflictCount = activeGroup ? activeGroup.second : 0;
  const goodNrCount = activeGroup ? (activeGroup.good + activeGroup.notReported) : 0;
  const totalCount = activeGroup ? activeGroup.total : 0;

  // Handle dynamic pre-population of customizable inputs on active MMO group change
  useEffect(() => {
    if (activeGroup) {
      const currentMmo = activeGroup.mmo === 'Unknown MMO' ? t('unknown_mmo') : activeGroup.mmo;
      setReportBomRef(currentMmo);

      if (locale === 'th') {
        setReportTitle('รายงานความพร้อมชิ้นส่วน 4M');
        setReportPeriod('22 มิ.ย. – 04 ก.ค. 2026');
        setReportDate(new Date().toLocaleDateString('th-TH', { month: 'long', day: '2-digit', year: 'numeric' }));
      } else {
        setReportTitle('4M Material Readiness Report');
        setReportPeriod('Jun 22 – Jul 04, 2026');
        setReportDate(new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }));
      }

      // Extract details for dynamic bullets
      const firstAppeared = locale === 'th' ? "30 มิถุนายน" : "June 30";
      const daysElapsed = locale === 'th' ? "8 วัน" : "8 days";
      const firstEmail = locale === 'th' ? "22 มิ.ย." : "Jun 22";

      // 1. Bullet 1
      const bullet1Text = locale === 'th'
        ? `ใบสั่งผลิต ${currentMmo} ปรากฏตัวครั้งแรกในอีเมลแจ้งของขาดเมื่อวันที่ ${firstAppeared} (${daysElapsed} หลังจากอีเมลฉบับแรกในชุดข้อมูล, ${firstEmail})`
        : `${currentMmo} first appeared in the shortage email on ${firstAppeared} (${daysElapsed} after the first email in the series, ${firstEmail}).`;
      setReportBullet1(bullet1Text);

      // 2. Bullet 2
      const criticalPart = activeGroup.pns.find(r => r.status === '1st');
      if (criticalPart) {
        const pName = criticalPart.PartName || (locale === 'th' ? 'ชิปหน่วยความจำ NAND, LONGSYS' : 'NAND IC, LONGSYS');
        setReportBullet2(locale === 'th'
          ? `ชิ้นส่วนวิกฤต: ${criticalPart.PN} (${pName}) — ขาด ${criticalPart.ShortQty} ชิ้น, ส่งมอบแล้ว 0 ชิ้น`
          : `Critical part: ${criticalPart.PN} (${pName}) — Short ${criticalPart.ShortQty} pcs, Issued 0 pcs.`);
      } else {
        setReportBullet2(locale === 'th'
          ? `ชิ้นส่วนวิกฤต: ไม่พบข้อมูลรายการพาร์ทขาดแคลนระดับที่ 1 (วิกฤต) ที่ตรงกันในชุดข้อมูลนี้`
          : `Critical part: No confirmed matched 1st Priority (Critical) shortages found in this dataset.`);
      }

      // 3. Bullet 3
      setReportBullet3(locale === 'th'
        ? `กำหนดการจัดส่งยังไม่ได้รับการยืนยัน ณ วันที่ส่งอีเมลล่าสุด (4 กรกฎาคม) — วันตามแผน PC เลื่อนออกไปแล้ว 3 ครั้ง`
        : `Delivery remains unconfirmed as of the latest email (July 4) — PC Plan date has been pushed back 3 times.`);
    }
  }, [activeGroup, locale, t]);

  // Filtered results for the Database table
  const filteredResults = useMemo(() => {
    return results.filter(row => {
      const matchesSearch =
        row.PN.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.MMO.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = statusFilter === 'ALL' || row.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [results, searchTerm, statusFilter]);

  const executiveSummaryNarrative = useMemo(() => {
    const mmoCount = mmoGroups.length;
    if (locale === 'th') {
      let text = `รายงานการกระทบยอดนี้สรุปรายการชิ้นส่วนที่ขาดแคลนระหว่างข้อมูล Excel และข้อมูลแจ้งเตือนจากอีเมล ตรวจสอบรหัสชิ้นส่วนทั้งหมดแล้วจำนวน ${stats.total} รายการ ภายใต้รหัสใบสั่งผลิต MMO ที่แตกต่างกัน ${mmoCount} กลุ่ม `;
      if (needToCheckCount > 0) {
        text += `โดยมีข้อมูลสำคัญ: พบรายการพาร์ทที่อยู่ระดับ 'ต้องตรวจสอบ' (Need to Check) จำนวน ${needToCheckCount} รายการ เพื่อยืนยันว่ารายการขาดแคลนตรงกันในทั้งสองแหล่งข้อมูล แนะนำให้ประสานงานฝ่ายซัพพลายเชนและโลจิสติกส์เพื่อเร่งรัดทันทีสำหรับรายการเหล่านี้ `;
      } else {
        text += `ไม่พบรายการที่เข้าเงื่อนไขต้องตรวจสอบความขัดแย้ง ณ ขณะนี้ `;
      }
      if (conflictCount > 0) {
        text += `นอกจากนี้ ยังพบรหัสพาร์ทระดับที่สอง (2nd) จำนวน ${conflictCount} รายการ ซึ่งมีระบุในอีเมลแต่ไม่พบในฐานข้อมูล Excel BOM `;
      }
      if (goodNrCount > 0) {
        text += `และมีรายการที่ได้รับการตรวจสอบว่าอยู่ในสถานะปกติและสมดุล (Good / NR) จำนวน ${goodNrCount} รายการ `;
      }
      return text;
    } else {
      let text = `This reconciliation report summarizes system shortages between the uploaded Excel logs and active email notification data. A total of ${stats.total} part numbers across ${mmoCount} distinct MMO code group(s) have been verified. `;
      if (needToCheckCount > 0) {
        text += `Critically, ${needToCheckCount} part numbers are flagged as Need to Check, confirming matching shortage occurrences in both datasets. Immediate supply chain expediting and logistics follow-up are strongly recommended for these items. `;
      } else {
        text += `Notably, zero Need to Check items are currently detected. `;
      }
      if (conflictCount > 0) {
        text += `We have also detected ${conflictCount} part(s) in 2nd status, indicating part numbers reported in the email but not found in the Excel file. `;
      }
      if (goodNrCount > 0) {
        text += `There are ${goodNrCount} part numbers verified in a stable, fully balanced state (Good / NR). `;
      }
      return text;
    }
  }, [mmoGroups, stats, needToCheckCount, conflictCount, goodNrCount, locale]);

  // Localized narrative helper
  const getMmoGroupNarrative = (group: any) => {
    const displayMmo = group.mmo === 'Unknown MMO' ? t('unknown_mmo') : group.mmo;
    const gNeedToCheck = group.first;
    const gConflict = group.second;
    const gGoodNr = group.good + group.notReported;

    if (locale === 'th') {
      let text = `กลุ่มใบสั่งผลิต "${displayMmo}" ประกอบด้วยรหัสชิ้นส่วน ${group.total} รายการ `;
      if (gNeedToCheck > 0) {
        text += `โดยมี ${gNeedToCheck} รายการอยู่ในสถานะต้องตรวจสอบ (🔴) `;
      }
      if (gConflict > 0) {
        text += `มี ${gConflict} รายการอยู่ในสถานะพาร์ทเฉพาะในอีเมล (🟡) `;
      }
      if (gGoodNr > 0) {
        text += `และมี ${gGoodNr} รายการที่สถานะปกติ (🟢) `;
      }
      return text;
    } else {
      let text = `MMO group "${displayMmo}" contains ${group.total} part numbers. `;
      if (gNeedToCheck > 0) {
        text += `${gNeedToCheck} items are Need to Check (🔴). `;
      }
      if (gConflict > 0) {
        text += `${gConflict} items are in 2nd (🟡). `;
      }
      if (gGoodNr > 0) {
        text += `${gGoodNr} items are in Good / NR (🟢). `;
      }
      return text;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (results.length === 0) return;

    const headers = ['PN', 'PartName', 'MMO', 'ShortQty', 'e (ShortQty > 0)', 'm (PN in Email)', 'MMO in Email', 'Status'];
    const csvRows = [
      headers.join(','),
      ...results.map(row => [
        `"${row.PN.replace(/"/g, '""')}"`,
        `"${(row.PartName || '').replace(/"/g, '""')}"`,
        `"${row.MMO.replace(/"/g, '""')}"`,
        row.ShortQty,
        row.e ? 'TRUE' : 'FALSE',
        row.m ? 'TRUE' : 'FALSE',
        row.mmoInEmail ? 'TRUE' : 'FALSE',
        `"${row.status}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shortage_reconciliation_${reportBomRef}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy formatted TSV
  const handleCopyToClipboard = () => {
    if (results.length === 0) return;

    const headers = ['PN', 'Part Name', 'MMO', 'ShortQty', 'Status'];
    const rowsText = results.map(row => [row.PN, row.PartName || '', row.MMO, row.ShortQty, row.status].join('\t'));
    const clipboardText = [headers.join('\t'), ...rowsText].join('\n');

    navigator.clipboard.writeText(clipboardText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Pagination helper for PDF sheets (comfortable density without overflow)
  const rowsPerPage = 23;
  const tablePages = useMemo(() => {
    const pages: ComparedResult[][] = [];
    const pns = activeGroup ? activeGroup.pns : [];
    for (let i = 0; i < pns.length; i += rowsPerPage) {
      pages.push(pns.slice(i, i + rowsPerPage));
    }
    return pages;
  }, [activeGroup, rowsPerPage]);

  // Export to Multi-page Corporate PDF using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (results.length === 0) return;
    setIsGeneratingPdf(true);
    
    // Select elements from off-screen report workspace
    const page1 = document.getElementById('report-page-1');
    const tablePagesElements = tablePages.map((_, idx) => document.getElementById(`report-page-table-${idx}`));

    if (!page1 || tablePagesElements.some(el => !el)) {
      setIsGeneratingPdf(false);
      console.error('Could not find report DOM elements for capture.');
      return;
    }

    const originalStyles = Array.from(document.querySelectorAll('style'));
    const originalLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    let tempCleanStyle: HTMLStyleElement | null = null;
    let redefinedStyleSheets = false;
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      // Temporarily show the report block so we can capture it
      const reportContainer = document.getElementById('pdf-report-content');
      if (reportContainer) {
        reportContainer.style.display = 'block';
      }

      let combinedCss = '';

      // Get CSS from style tags
      originalStyles.forEach((style) => {
        try {
          let cssText = style.innerHTML;
          // If innerHTML is empty (Vite CSSOM injection), try reading sheet.cssRules
          if (!cssText && style.sheet) {
            try {
              cssText = Array.from(style.sheet.cssRules)
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              console.warn('Could not read style sheet rules via cssRules:', e);
            }
          }
          if (cssText) {
            combinedCss += cssText + '\n';
          }
        } catch (e) {
          console.warn('Could not process style element:', e);
        }
      });

      // Get CSS from same-origin link tags
      for (const link of originalLinks) {
        try {
          if (link.href) {
            const res = await fetch(link.href);
            if (res.ok) {
              const cssText = await res.text();
              combinedCss += cssText + '\n';
            }
          }
        } catch (e) {
          console.warn('Could not fetch external style sheet:', e);
        }
      }

      // Convert oklch and oklab to standard colors to prevent html2canvas parsing errors
      const cleanedCss = combinedCss
        .replace(/oklch\([^)]+\)/gi, (m) => oklchToHsl(m))
        .replace(/oklab\([^)]+\)/gi, (m) => oklabToRgb(m));

      // Create and append our safe, clean style sheet
      tempCleanStyle = document.createElement('style');
      tempCleanStyle.id = 'pdf-temp-clean-styles';
      tempCleanStyle.innerHTML = cleanedCss;
      document.head.appendChild(tempCleanStyle);

      // Redefine document.styleSheets getter so html2canvas only parses our oklch-free sheet
      try {
        const mockStyleSheets = [tempCleanStyle.sheet] as any;
        Object.defineProperty(document, 'styleSheets', {
          get: () => mockStyleSheets,
          configurable: true
        });
        redefinedStyleSheets = true;
      } catch (e) {
        console.warn('Could not override document.styleSheets:', e);
      }

      // Intercept window.getComputedStyle to translate computed oklch and oklab colors
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function (propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                return cleanColorValue(val);
              };
            }
            const val = Reflect.get(target, prop, target);
            if (typeof val === 'string') {
              return cleanColorValue(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm

      // Capture Slide Page 1 (Executive Summary + Pie Chart)
      const canvas1 = await html2canvas(page1, {
        scale: 2.2, // Ultra crisp resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });
      const imgData1 = canvas1.toDataURL('image/png');
      const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
      pdf.addImage(imgData1, 'PNG', 0, 0, imgWidth, imgHeight1);

      // Capture Slide Page 2 and subsequent (Detailed BOM Tables)
      for (let idx = 0; idx < tablePagesElements.length; idx++) {
        const tablePageEl = tablePagesElements[idx];
        if (!tablePageEl) continue;

        const canvasTable = await html2canvas(tablePageEl, {
          scale: 2.2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800
        });

        pdf.addPage();
        const imgDataT = canvasTable.toDataURL('image/png');
        const imgHeightT = (canvasTable.height * imgWidth) / canvasTable.width;
        pdf.addImage(imgDataT, 'PNG', 0, 0, imgWidth, imgHeightT);
      }
      
      if (reportContainer) {
        reportContainer.style.display = 'none';
      }
      
      const fileDateStr = new Date().toISOString().split('T')[0];
      pdf.save(`4M_Material_Readiness_Report_${reportBomRef || 'Summary'}_${fileDateStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      // Restore getComputedStyle
      window.getComputedStyle = originalGetComputedStyle;

      // Restore document.styleSheets
      if (redefinedStyleSheets) {
        try {
          delete (document as any).styleSheets;
        } catch (e) {
          console.warn('Could not restore document.styleSheets:', e);
        }
      }

      // Remove temporary clean style sheet
      if (tempCleanStyle) {
        tempCleanStyle.remove();
      }

      setIsGeneratingPdf(false);
    }
  };

  const getStatusBadgeStyles = (status: MatchStatus) => {
    switch (status) {
      case '1st':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case '2nd':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Good':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Not reported':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const getStatusDisplayText = (status: MatchStatus) => {
    switch (status) {
      case '1st':
        return 'Need to Check';
      case '2nd':
        return '2nd';
      case 'Good':
      case 'Not reported':
        return 'Good / NR';
    }
  };

  return (
    <div className="bg-white rounded border border-[#D1D5DB] shadow-sm overflow-hidden flex flex-col h-full" id="results-card">
      {/* Header */}
      <div className="p-3.5 bg-[#1A1C1E] text-white border-b border-[#2D3135] flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#10B981] rounded-full animate-pulse"></div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-tight text-white">{t('results_title')}</h2>
            <p className="text-[10px] text-[#A6ADB5] uppercase tracking-wider">{t('results_sub')}</p>
          </div>
        </div>

        {/* View Toggle (Tabs) & Downloads */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tabs */}
          <div className="flex bg-[#2D3135] p-0.5 rounded border border-[#3E444B] text-[10px] font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                activeTab === 'report' ? 'bg-[#10B981] text-white' : 'text-[#A6ADB5] hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {locale === 'th' ? '📋 รายงานผู้บริหาร' : '📋 Corporate Report'}
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                activeTab === 'database' ? 'bg-[#10B981] text-white' : 'text-[#A6ADB5] hover:text-white'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              {locale === 'th' ? '📊 ตารางฐานข้อมูล' : '📊 Status Matrix'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-[#2D3135] bg-[#2D3135] hover:bg-[#3E444B] text-[#A6ADB5] hover:text-white rounded transition-colors cursor-pointer"
                id="copy-results-btn"
                title="Copy all database results to clipboard"
              >
                <Copy className="h-3 w-3" />
                {copied ? (locale === 'th' ? 'คัดลอกแล้ว' : 'Copied') : (locale === 'th' ? 'คัดลอก' : 'Copy')}
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#10B981] hover:bg-emerald-600 text-white rounded transition-colors cursor-pointer"
                id="export-csv-btn"
                title="Export results to Excel CSV"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors cursor-pointer disabled:opacity-50 font-sans"
                id="download-pdf-btn"
                title="Compile and download professional slide report PDF"
              >
                {isGeneratingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                {isGeneratingPdf 
                  ? (locale === 'th' ? 'กำลังสร้าง...' : 'Compiling...') 
                  : (locale === 'th' ? 'ส่งออก PDF' : 'PDF Report')}
              </button>
            </div>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex-1 py-16 flex flex-col items-center justify-center text-center p-6 text-zinc-400 gap-2.5">
          <HelpCircle className="h-10 w-10 text-[#6B7280] animate-pulse" />
          <p className="font-bold text-xs uppercase tracking-wider text-[#4B5563]">
            {locale === 'th' ? 'รอข้อมูลเพื่อทำการกระทบยอด' : 'Awaiting inputs for matching'}
          </p>
          <p className="text-[11px] max-w-sm">
            {locale === 'th' 
              ? 'กรุณาอัปโหลดหรือระบุข้อมูลความต้องการชิ้นส่วนทั้งสองแผงด้านบนเพื่อเปรียบเทียบข้อมูล!' 
              : 'Please insert shortage details in both panels above to auto-generate this comparison report.'}
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-4 flex-1 flex flex-col overflow-auto bg-[#F4F6F8]">
          
          {/* TAB 1: 📋 CORPORATE SLIDE REPORT PREVIEW (DEFAULT) */}
          {activeTab === 'report' && (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* MMO Report Set Selector tabs */}
              {mmoGroups.length > 1 && (
                <div className="flex flex-col gap-2 p-3 bg-white border border-[#D1D5DB] rounded shadow-sm shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                    📂 {locale === 'th' ? 'เลือกชุดรายงานตามกลุ่มใบสั่งผลิต MMO:' : 'Select Report Set by MMO Group:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {mmoGroups.map((group) => (
                      <button
                        key={group.mmo}
                        onClick={() => setActiveMmoTab(group.mmo)}
                        className={`px-3 py-1.5 text-xs font-bold rounded border transition-all uppercase tracking-wide cursor-pointer ${
                          activeMmoTab === group.mmo
                            ? 'bg-[#112E51] text-white border-[#112E51] shadow-md scale-[1.02]'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        📂 {group.mmo === 'Unknown MMO' ? t('unknown_mmo') : group.mmo} ({group.total} {locale === 'th' ? 'พาร์ท' : 'PNs'})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Report Live Customization controls (Toggleable Accordion) */}
              <div className="bg-white border border-[#D1D5DB] rounded shadow-sm overflow-hidden shrink-0">
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="w-full flex justify-between items-center p-3 text-left font-bold text-xs uppercase tracking-wider text-[#1A1C1E] bg-[#F8F9FA] border-b border-[#D1D5DB] hover:bg-[#F1F3F5] transition-colors"
                >
                  <span className="flex items-center gap-2 font-black">
                    <Sliders className="h-3.5 w-3.5 text-[#10B981]" />
                    {locale === 'th' ? '🛠️ ปรับแต่งรายละเอียด & บทสรุปรายงาน PDF' : '🛠️ Customize PDF Report Details & Summary'}
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7280]">
                    {showConfig 
                      ? (locale === 'th' ? '[- คลิกเพื่อย่อแผงควบคุม]' : '[- Click to Collapse]') 
                      : (locale === 'th' ? '[+ คลิกเพื่อปรับแต่งข้อความ]' : '[+ Click to Customize Texts]')}
                  </span>
                </button>
                
                {showConfig && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white text-xs divide-y md:divide-y-0 md:divide-x divide-zinc-200">
                    <div className="space-y-2.5 pr-1">
                      <p className="font-bold uppercase text-[10px] tracking-wider text-[#1A1C1E] border-b border-zinc-100 pb-1">
                        {locale === 'th' ? 'ข้อมูลประกอบสไลด์ (Metadata)' : 'Slide Metadata'}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'หัวข้อรายงาน (Report Title)' : 'Report Title'}
                          </label>
                          <input 
                            type="text" 
                            value={reportTitle} 
                            onChange={(e) => setReportTitle(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'เลขอ้างอิง BOM/MMO' : 'BOM Reference'}
                          </label>
                          <input 
                            type="text" 
                            value={reportBomRef} 
                            onChange={(e) => setReportBomRef(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'รอบช่วงเวลาของอีเมล' : 'Email Period'}
                          </label>
                          <input 
                            type="text" 
                            value={reportPeriod} 
                            onChange={(e) => setReportPeriod(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 md:px-3 pt-3 md:pt-0 col-span-2">
                      <p className="font-bold uppercase text-[10px] tracking-wider text-[#1A1C1E] border-b border-zinc-100 pb-1">
                        {locale === 'th' ? 'ประเด็นสรุปสำหรับผู้บริหาร (Executive Summary Bullet Points)' : 'Executive Summary Bullet Points'}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'ข้อความจุดที่ 1 (ไทม์ไลน์ช่วงเวลา)' : 'Bullet Point 1 (Timeline)'}
                          </label>
                          <textarea 
                            rows={2}
                            value={reportBullet1} 
                            onChange={(e) => setReportBullet1(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] text-[11px] resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'ข้อความจุดที่ 2 (ชิ้นส่วนวิกฤต/ต้องตรวจสอบ)' : 'Bullet Point 2 (Critical Part Deficit)'}
                          </label>
                          <textarea 
                            rows={2}
                            value={reportBullet2} 
                            onChange={(e) => setReportBullet2(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] text-[11px] resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-0.5">
                            {locale === 'th' ? 'ข้อความจุดที่ 3 (แผนผลิต PC และสถานะการจัดส่ง)' : 'Bullet Point 3 (PC Plan & Delivery Status)'}
                          </label>
                          <textarea 
                            rows={2}
                            value={reportBullet3} 
                            onChange={(e) => setReportBullet3(e.target.value)}
                            className="w-full p-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-[#10B981] text-[11px] resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Virtual PDF Document View Container */}
              <div className="flex-1 overflow-y-auto space-y-6 max-h-[600px] p-2 bg-[#D1D5DB] rounded border border-zinc-300 flex flex-col items-center">
                <div className="text-[10px] font-bold uppercase text-zinc-600 tracking-wider flex items-center gap-1 py-1 shrink-0">
                  <Eye className="h-3.5 w-3.5 text-zinc-500" />
                  {locale === 'th' 
                    ? `พรีวิวสด: หน้าสไลด์รายงาน PDF (ทั้งหมด ${1 + tablePages.length} หน้า)` 
                    : `Live Preview: PDF document slides (${1 + tablePages.length} Pages total)`}
                </div>

                {/* VIRTUAL PAGE 1 */}
                <div className="bg-white shadow-lg border border-zinc-300 rounded font-sans flex flex-col justify-between select-none relative shrink-0" 
                     style={{ width: '700px', height: '989px', padding: '36px', boxSizing: 'border-box' }}>
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b-2 border-zinc-800 pb-3">
                      <h1 className="text-2xl font-black uppercase tracking-tight text-[#112E51]" style={{ color: '#112E51' }}>
                        {reportTitle}
                      </h1>
                      <div className="text-[10px] text-zinc-500 font-mono flex justify-between mt-1">
                        <span>{locale === 'th' ? 'วันที่สร้าง:' : 'Generated:'} {reportDate}</span>
                        <span>{locale === 'th' ? 'เลขอ้างอิง BOM/MMO:' : 'BOM Reference:'} {reportBomRef}</span>
                        <span>{locale === 'th' ? 'ช่วงเวลาอีเมล:' : 'Email Period:'} {reportPeriod}</span>
                      </div>
                    </div>

                    {/* Section I: Executive Summary */}
                    <div className="space-y-2.5">
                      <h2 className="text-xs font-black uppercase tracking-wider text-[#112E51] border-b border-zinc-200 pb-1">
                        {locale === 'th' ? 'I. บทสรุปสำหรับผู้บริหาร' : 'I. Executive Summary'}
                      </h2>
                      <ul className="space-y-2.5 text-[11px] text-zinc-700 leading-relaxed list-disc pl-5">
                        <li>{reportBullet1}</li>
                        <li>{reportBullet2}</li>
                        <li>{reportBullet3}</li>
                      </ul>
                    </div>

                    {/* Section II: PN Classification Overview */}
                    <div className="space-y-3.5">
                      <h2 className="text-xs font-black uppercase tracking-wider text-[#112E51] border-b border-zinc-200 pb-1">
                        {locale === 'th' ? 'II. ภาพรวมสถานะพาร์ทชิ้นส่วน' : 'II. PN Classification Overview'}
                      </h2>
                      
                      <div className="border border-zinc-200 rounded-lg p-5 bg-zinc-50 flex items-center justify-between gap-6">
                        {/* Donut Chart */}
                        <div className="flex-1 text-center space-y-3">
                          <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-wide">
                            {locale === 'th' ? 'สถานะรหัสชิ้นส่วน (PN) — ' : 'PN Status — '} {reportBomRef}
                          </p>
                          <div className="inline-block relative">
                            <SvgReadinessPieChart 
                              needToCheck={needToCheckCount}
                              conflict={conflictCount}
                              goodNr={goodNrCount}
                              size={150}
                            />
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="w-[240px] space-y-2.5 shrink-0">
                          <p className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">
                            {locale === 'th' ? 'คำอธิบายสัญลักษณ์กลุ่มพาร์ท' : 'Classification Legend'}
                          </p>
                          <div className="space-y-2">
                            {/* Red Row */}
                            <div className="flex items-center justify-between border-b border-zinc-200/60 pb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-[#EF4444] rounded shrink-0"></span>
                                <span className="text-[11px] font-bold text-zinc-800">
                                  {locale === 'th' ? 'ต้องตรวจสอบ (Need to Check)' : 'Need to Check'}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-zinc-600 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">
                                {needToCheckCount} ({totalCount > 0 ? Math.round((needToCheckCount / totalCount) * 100) : 0}%)
                              </span>
                            </div>

                            {/* Yellow Row */}
                            <div className="flex items-center justify-between border-b border-zinc-200/60 pb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-[#F59E0B] rounded shrink-0"></span>
                                <span className="text-[11px] font-bold text-zinc-800">
                                  {locale === 'th' ? 'ขัดแย้ง/เลี่ยงผลกระทบ (2nd)' : '2nd'}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-zinc-600 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">
                                {conflictCount} ({totalCount > 0 ? Math.round((conflictCount / totalCount) * 100) : 0}%)
                              </span>
                            </div>

                            {/* Green Row */}
                            <div className="flex items-center justify-between pb-0.5">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-[#10B981] rounded shrink-0"></span>
                                <span className="text-[11px] font-bold text-zinc-800">
                                  {locale === 'th' ? 'ปกติ / สมบูรณ์ (Good / NR)' : 'Good / NR'}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-zinc-600 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                {goodNrCount} ({totalCount > 0 ? Math.round((goodNrCount / totalCount) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-zinc-100 pt-2.5 text-center text-[9px] font-mono text-zinc-400 uppercase tracking-wider flex justify-between items-center mt-auto">
                    <span>{locale === 'th' ? 'รายงานความพร้อมชิ้นส่วน 4M' : '4M Material Readiness Report'}</span>
                    <span>{locale === 'th' ? `หน้า 1 จาก ${1 + tablePages.length}` : `Page 1 of ${1 + tablePages.length}`}</span>
                  </div>
                </div>

                {/* VIRTUAL PAGES (BOM tables) */}
                {tablePages.map((pageRows, pageIdx) => (
                  <div key={pageIdx} className="bg-white shadow-lg border border-zinc-300 rounded font-sans flex flex-col justify-between select-none relative shrink-0" 
                       style={{ width: '700px', height: '989px', padding: '36px', boxSizing: 'border-box' }}>
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Header */}
                      <div className="border-b border-zinc-200 pb-2.5">
                        <h2 className="text-base font-black uppercase tracking-tight text-[#112E51]" style={{ color: '#112E51' }}>
                          {locale === 'th' ? `ตารางสถานะพาร์ทตามใบสั่งผลิต — ${reportBomRef}` : `BOM Part Number Status — ${reportBomRef}`}
                        </h2>
                        <p className="text-[9.5px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                          {locale === 'th' 
                            ? `จำนวนพาร์ททั้งหมด: ${totalCount} | ต้องตรวจสอบ: ${needToCheckCount} | ขัดแย้ง: ${conflictCount} | ปกติ: ${goodNrCount}`
                            : `Total PNs: ${totalCount} | Need to Check: ${needToCheckCount} | 2nd: ${conflictCount} | Good/NR: ${goodNrCount}`}
                        </p>
                      </div>

                      {/* BOM Table */}
                      <div className="flex-1 overflow-hidden border border-zinc-200 rounded-md bg-zinc-50">
                        <table className="w-full text-left text-[9.5px] font-sans border-collapse">
                          <thead>
                            <tr className="bg-[#112E51] text-white uppercase text-[8.5px] font-black tracking-wider">
                              <th className="p-2 border-b border-zinc-200">{locale === 'th' ? 'รหัสพาร์ท (PN)' : 'Part No.'}</th>
                              <th className="p-2 border-b border-zinc-200">{locale === 'th' ? 'ชื่อชิ้นส่วน / รายละเอียด' : 'Part Name / Desc'}</th>
                              <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'จำนวนขาด' : 'Short Qty'}</th>
                              <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'ในอีเมล' : 'In Email'}</th>
                              <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'ในไฟล์ Excel' : 'In Excel File'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 bg-white font-medium">
                            {pageRows.map((pnRow) => {
                              const isNeedToCheck = pnRow.status === '1st';
                              return (
                                <tr key={pnRow.id} className={`hover:bg-zinc-50 ${isNeedToCheck ? 'bg-red-50/70 font-semibold' : ''}`}>
                                  <td className="p-2 font-mono font-bold text-zinc-800 tracking-tight truncate max-w-[130px]">{pnRow.PN}</td>
                                  <td className="p-2 text-zinc-600 truncate max-w-[250px]" title={pnRow.PartName}>
                                    {pnRow.PartName || <span className="text-zinc-400 font-normal italic">{locale === 'th' ? '[ไม่มีข้อมูลชื่อพาร์ท]' : '[No Name Mapped]'}</span>}
                                  </td>
                                  <td className={`p-2 text-center font-mono font-bold ${pnRow.ShortQty > 0 ? 'text-red-600' : 'text-zinc-500'}`}>
                                    {pnRow.ShortQty}
                                  </td>
                                  <td className="p-2 text-center">
                                    {pnRow.m ? (
                                      <span className="text-[#10B981] font-bold">{locale === 'th' ? 'มี' : 'Yes'}</span>
                                    ) : (
                                      <span className="text-zinc-400">{locale === 'th' ? 'ไม่มี' : 'No'}</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    {!pnRow.id.startsWith('email-discrepancy-') ? (
                                      <span className="text-[#10B981] font-bold">{locale === 'th' ? 'มี' : 'Yes'}</span>
                                    ) : (
                                      <span className="text-zinc-400">{locale === 'th' ? 'ไม่มี' : 'No'}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-zinc-100 pt-2.5 text-center text-[9px] font-mono text-zinc-400 uppercase tracking-wider flex justify-between items-center mt-3">
                      <span>{locale === 'th' ? 'รายงานความพร้อมชิ้นส่วน 4M' : '4M Material Readiness Report'}</span>
                      <span>{locale === 'th' ? `หน้า ${2 + pageIdx} จาก ${1 + tablePages.length}` : `Page ${2 + pageIdx} of ${1 + tablePages.length}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: 📊 RECONCILIATION COMPARISON DATABASE MATRIX */}
          {activeTab === 'database' && (
            <div className="space-y-3 flex-1 flex flex-col overflow-auto">
              {/* Bento Stats Display */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0" id="stats-grid">
                {/* Total */}
                <div className="bg-white border border-[#D1D5DB] rounded p-2.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">
                    {locale === 'th' ? 'จำนวนแถวทั้งหมด' : 'Total Rows'}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-mono font-bold text-[#1A1C1E]">{stats.total}</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-1 rounded overflow-hidden mt-1.5">
                    <div className="bg-[#1A1C1E] h-full" style={{ width: '100%' }} />
                  </div>
                </div>

                {/* Need to Check */}
                <div className="bg-white border border-[#D1D5DB] rounded p-2.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-bold text-[#EF4444] uppercase tracking-wider">
                    {locale === 'th' ? 'ต้องตรวจสอบ (🔴)' : 'Need to Check (🔴)'}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-mono font-bold text-[#B91C1C]">{needToCheckCount}</span>
                    <span className="text-[10px] font-mono text-zinc-500">({stats.total > 0 ? Math.round((needToCheckCount / stats.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-1 rounded overflow-hidden mt-1.5">
                    <div className="bg-[#EF4444] h-full" style={{ width: `${stats.total > 0 ? (needToCheckCount / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* 2nd */}
                <div className="bg-white border border-[#D1D5DB] rounded p-2.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-bold text-[#F59E0B] uppercase tracking-wider">
                    {locale === 'th' ? 'ขัดแย้ง (🟡)' : '2nd (🟡)'}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-mono font-bold text-[#92400E]">{conflictCount}</span>
                    <span className="text-[10px] font-mono text-zinc-500">({stats.total > 0 ? Math.round((conflictCount / stats.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-1 rounded overflow-hidden mt-1.5">
                    <div className="bg-[#F59E0B] h-full" style={{ width: `${stats.total > 0 ? (conflictCount / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Good / NR */}
                <div className="bg-white border border-[#D1D5DB] rounded p-2.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-wider">
                    {locale === 'th' ? 'ปกติ / สมบูรณ์ (🟢)' : 'Good / NR (🟢)'}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-mono font-bold text-[#065F46]">{goodNrCount}</span>
                    <span className="text-[10px] font-mono text-zinc-500">({stats.total > 0 ? Math.round((goodNrCount / stats.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] h-1 rounded overflow-hidden mt-1.5">
                    <div className="bg-[#10B981] h-full" style={{ width: `${stats.total > 0 ? (goodNrCount / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center shrink-0 bg-[#EDEFF2] p-2 rounded border border-[#D1D5DB]">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder={locale === 'th' ? 'ค้นหาจากรหัสพาร์ท (PN), ใบสั่งผลิต (MMO), หรือรายละเอียด...' : 'Search PN, MMO, or Part description...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[11px] font-mono bg-white border border-[#D1D5DB] rounded focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                    id="search-input"
                  />
                </div>

                <div className="flex flex-wrap gap-1 items-center w-full sm:w-auto" id="filter-pills">
                  <span className="text-[10px] text-[#4B5563] font-bold uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                    <Filter className="h-2.5 w-2.5" />
                    {locale === 'th' ? 'ตัวกรอง:' : 'Filter:'}
                  </span>
                  {([
                    { value: 'ALL', label: locale === 'th' ? 'ทั้งหมด (ALL)' : 'ALL' },
                    { value: '1st', label: locale === 'th' ? 'ต้องตรวจสอบ (🔴)' : 'Need to Check' },
                    { value: '2nd', label: locale === 'th' ? 'ขัดแย้ง (🟡)' : '2nd' },
                    { value: 'Good', label: locale === 'th' ? 'ปกติ/สมบูรณ์ (🟢)' : 'Good / NR' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                        statusFilter === opt.value
                          ? 'bg-[#1A1C1E] border-[#1A1C1E] text-white'
                          : 'bg-white border-[#D1D5DB] text-[#4B5563] hover:text-[#1A1C1E] hover:bg-zinc-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Comparison Grid / Table */}
              <div className="border border-[#D1D5DB] rounded overflow-hidden flex-1 flex flex-col bg-white min-h-[250px]">
                <div className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_1.5fr_1fr] gap-2 px-3 py-2 bg-[#F1F3F5] border-b border-[#D1D5DB] text-left text-[10px] font-bold text-[#4B5563] uppercase tracking-wider shrink-0">
                  <div>{locale === 'th' ? 'รหัสชิ้นส่วน (PN)' : 'Part Number (PN)'}</div>
                  <div>{locale === 'th' ? 'ชื่อชิ้นส่วน / รายละเอียด' : 'Part Name / Desc'}</div>
                  <div>{locale === 'th' ? 'รหัสใบสั่งผลิต (MMO)' : 'MMO Code'}</div>
                  <div className="text-right">{locale === 'th' ? 'จำนวนที่ขาด (Excel)' : 'Excel Qty'}</div>
                  <div className="text-center">{locale === 'th' ? 'พารามิเตอร์เปรียบเทียบ (e | m)' : 'Truth parameters (e | m)'}</div>
                  <div className="text-right">{locale === 'th' ? 'ผลลัพธ์การกระทบยอด' : 'Reconciliation'}</div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#D1D5DB] bg-white max-h-[350px]" id="results-table-body">
                  {filteredResults.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 font-mono">
                      {locale === 'th' ? 'ไม่พบข้อมูลความสอดคล้องรหัสพาร์ทตามตัวกรองนี้' : 'NO MATCH OUTCOMES FOUND WITH CURRENT FILTER'}
                    </div>
                  ) : (
                    filteredResults.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_1.5fr_1fr] gap-2 px-3 py-1.5 items-center hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="font-mono text-[11px] text-[#1F2937] break-all font-bold tracking-tight">{row.PN}</div>
                        <div className="text-[11px] text-zinc-500 truncate" title={row.PartName}>
                          {row.PartName || <span className="italic font-normal text-zinc-300">{locale === 'th' ? '[ไม่มีคำอธิบาย]' : '[No Description]'}</span>}
                        </div>
                        <div className="font-mono text-[11px] text-[#4B5563] break-all">
                          {row.MMO === 'Unknown MMO' ? t('unknown_mmo') : row.MMO}
                        </div>
                        <div className="text-right font-mono text-[11px] font-bold pr-1">
                          <span className={row.ShortQty > 0 ? 'text-red-500 font-bold' : 'text-emerald-600'}>
                            {row.ShortQty}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-3 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 font-mono">e:</span>
                            {row.e ? (
                              <span className="font-mono font-bold text-red-500">TRUE</span>
                            ) : (
                              <span className="font-mono font-bold text-[#9CA3AF]">FALSE</span>
                            )}
                          </div>
                          <span className="text-[#D1D5DB] font-mono">|</span>
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 font-mono">m:</span>
                            {row.m ? (
                              <span className="font-mono font-bold text-emerald-500">TRUE</span>
                            ) : (
                              <span className="font-mono font-bold text-[#9CA3AF]">FALSE</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeStyles(row.status)}`}>
                            {getStatusDisplayText(row.status)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OFF-SCREEN DOM ELEMENT FOR PERFECT HIGH-QUALITY EXPORT WITH DYNAMIC COPIED PAGES */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div id="pdf-report-content" className="bg-white p-0 text-zinc-900 font-sans">
          
          {/* SLIDE PAGE 1 */}
          <div id="report-page-1" className="bg-white" style={{ width: '800px', height: '1130px', padding: '48px', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="space-y-8">
              {/* Header */}
              <div className="border-b-2 border-zinc-800 pb-3">
                <h1 className="text-3xl font-black uppercase tracking-tight text-[#112E51]" style={{ color: '#112E51' }}>
                  {reportTitle}
                </h1>
                <div className="text-[11px] text-zinc-500 font-mono flex justify-between mt-1.5">
                  <span>{locale === 'th' ? 'วันที่สร้าง:' : 'Generated:'} {reportDate}</span>
                  <span>{locale === 'th' ? 'เลขอ้างอิง BOM/MMO:' : 'BOM Reference:'} {reportBomRef}</span>
                  <span>{locale === 'th' ? 'ช่วงเวลาอีเมล:' : 'Email Period:'} {reportPeriod}</span>
                </div>
              </div>

              {/* Section I: Executive Summary */}
              <div className="space-y-3.5">
                <h2 className="text-sm font-black uppercase tracking-wider text-[#112E51] border-b border-zinc-200 pb-1.5">
                  {locale === 'th' ? 'I. บทสรุปสำหรับผู้บริหาร' : 'I. Executive Summary'}
                </h2>
                <ul className="space-y-3 text-xs text-zinc-700 leading-relaxed list-disc pl-5">
                  <li className="font-medium">{reportBullet1}</li>
                  <li className="font-medium">{reportBullet2}</li>
                  <li className="font-medium">{reportBullet3}</li>
                </ul>
              </div>

              {/* Section II: PN Classification Overview */}
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-[#112E51] border-b border-zinc-200 pb-1.5">
                  {locale === 'th' ? 'II. ภาพรวมสถานะพาร์ทชิ้นส่วน' : 'II. PN Classification Overview'}
                </h2>
                
                <div className="border border-zinc-200 rounded-lg p-6 bg-zinc-50 flex items-center justify-between gap-10">
                  {/* Donut Chart */}
                  <div className="flex-1 text-center space-y-4">
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      {locale === 'th' ? 'สถานะรหัสชิ้นส่วน (PN) — ' : 'PN Status — '} {reportBomRef}
                    </p>
                    <div className="inline-block relative">
                      <SvgReadinessPieChart 
                        needToCheck={needToCheckCount}
                        conflict={conflictCount}
                        goodNr={goodNrCount}
                        size={170}
                      />
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="w-[280px] space-y-3 shrink-0">
                    <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                      {locale === 'th' ? 'คำอธิบายสัญลักษณ์กลุ่มพาร์ท' : 'Classification Legend'}
                    </p>
                    <div className="space-y-2.5">
                      {/* Red Row */}
                      <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 h-4 bg-[#EF4444] rounded shrink-0"></span>
                          <span className="text-xs font-bold text-zinc-800">
                            {locale === 'th' ? 'ต้องตรวจสอบ (Need to Check)' : 'Need to Check'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-600 bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">
                          {needToCheckCount} ({stats.total > 0 ? Math.round((needToCheckCount / stats.total) * 100) : 0}%)
                        </span>
                      </div>

                      {/* Yellow Row */}
                      <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 h-4 bg-[#F59E0B] rounded shrink-0"></span>
                          <span className="text-xs font-bold text-zinc-800">
                            {locale === 'th' ? 'ขัดแย้ง/เลี่ยงผลกระทบ (2nd)' : '2nd (Conflict)'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-600 bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                          {conflictCount} ({stats.total > 0 ? Math.round((conflictCount / stats.total) * 100) : 0}%)
                        </span>
                      </div>

                      {/* Green Row */}
                      <div className="flex items-center justify-between pb-0.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 h-4 bg-[#10B981] rounded shrink-0"></span>
                          <span className="text-xs font-bold text-zinc-800">
                            {locale === 'th' ? 'ปกติ / สมบูรณ์ (Good / NR)' : 'Good / NR'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-600 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                          {goodNrCount} ({stats.total > 0 ? Math.round((goodNrCount / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-150 pt-3 text-center text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider flex justify-between items-center mt-auto">
              <span>{locale === 'th' ? 'รายงานความพร้อมชิ้นส่วน 4M' : '4M Material Readiness Report'}</span>
              <span>{locale === 'th' ? `หน้า 1 จาก ${1 + tablePages.length}` : `Page 1 of ${1 + tablePages.length}`}</span>
            </div>
          </div>

          {/* GENERATED TABLE SLIDES (PAGINATED CHUNKS) */}
          {tablePages.map((pageRows, pageIdx) => (
            <div key={pageIdx} id={`report-page-table-${pageIdx}`} className="bg-white" style={{ width: '800px', height: '1130px', padding: '48px', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Header */}
                <div className="border-b border-zinc-200 pb-2.5">
                  <h2 className="text-lg font-black uppercase tracking-tight text-[#112E51]" style={{ color: '#112E51' }}>
                    {locale === 'th' ? `ตารางสถานะพาร์ทตามใบสั่งผลิต — ${reportBomRef}` : `BOM Part Number Status — ${reportBomRef}`}
                  </h2>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                    {locale === 'th' 
                      ? `จำนวนพาร์ททั้งหมด: ${stats.total} | ต้องตรวจสอบ: ${needToCheckCount} | ขัดแย้ง: ${conflictCount} | ปกติ: ${goodNrCount}`
                      : `Total PNs: ${stats.total} | Need to Check: ${needToCheckCount} | 2nd: ${conflictCount} | Good/NR: ${goodNrCount}`}
                  </p>
                </div>

                {/* BOM Table */}
                <div className="flex-1 overflow-hidden border border-zinc-200 rounded-md bg-zinc-50">
                  <table className="w-full text-left text-[10px] font-sans border-collapse">
                    <thead>
                      <tr className="bg-[#112E51] text-white uppercase text-[8.5px] font-black tracking-wider">
                        <th className="p-2 border-b border-zinc-200">{locale === 'th' ? 'รหัสพาร์ท (PN)' : 'Part No.'}</th>
                        <th className="p-2 border-b border-zinc-200">{locale === 'th' ? 'ชื่อชิ้นส่วน / รายละเอียด' : 'Part Name / Desc'}</th>
                        <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'จำนวนขาด' : 'Short Qty'}</th>
                        <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'ในอีเมล' : 'In Email'}</th>
                        <th className="p-2 border-b border-zinc-200 text-center">{locale === 'th' ? 'ในไฟล์ Excel' : 'In Excel File'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white font-medium">
                      {pageRows.map((pnRow) => {
                        const isNeedToCheck = pnRow.status === '1st';
                        return (
                          <tr key={pnRow.id} className={`hover:bg-zinc-50 ${isNeedToCheck ? 'bg-rose-50/70 font-semibold' : ''}`}>
                            <td className="p-2 font-mono font-bold text-zinc-800 tracking-tight truncate max-w-[140px]">{pnRow.PN}</td>
                            <td className="p-2 text-zinc-600 truncate max-w-[260px]" title={pnRow.PartName}>
                              {pnRow.PartName || <span className="text-zinc-400 font-normal italic">{locale === 'th' ? '[ไม่มีข้อมูลชื่อพาร์ท]' : '[No Name Mapped]'}</span>}
                            </td>
                            <td className={`p-2 text-center font-mono font-bold ${pnRow.ShortQty > 0 ? 'text-rose-600' : 'text-zinc-500'}`}>
                              {pnRow.ShortQty}
                            </td>
                            <td className="p-2 text-center">
                              {pnRow.m ? (
                                <span className="text-[#10B981] font-bold">{locale === 'th' ? 'มี' : 'Yes'}</span>
                              ) : (
                                <span className="text-zinc-400">{locale === 'th' ? 'ไม่มี' : 'No'}</span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {!pnRow.id.startsWith('email-discrepancy-') ? (
                                <span className="text-[#10B981] font-bold">{locale === 'th' ? 'มี' : 'Yes'}</span>
                              ) : (
                                <span className="text-zinc-400">{locale === 'th' ? 'ไม่มี' : 'No'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-150 pt-3 text-center text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider flex justify-between items-center mt-auto">
                <span>{locale === 'th' ? 'รายงานความพร้อมชิ้นส่วน 4M' : '4M Material Readiness Report'}</span>
                <span>{locale === 'th' ? `หน้า ${2 + pageIdx} จาก ${1 + tablePages.length}` : `Page ${2 + pageIdx} of ${1 + tablePages.length}`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

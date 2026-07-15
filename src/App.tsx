import React, { useState, useMemo } from 'react';
import { ExcelRow, EmailData, ComparedResult, MatchStatus, UploadedExcelFile } from './types';
import { SAMPLE_EXCEL_ROWS, SAMPLE_EMAIL_DATA } from './components/SampleData';
import ExcelInput from './components/ExcelInput';
import EmailInput from './components/EmailInput';
import ResultsDisplay from './components/ResultsDisplay';
import { Layers, HelpCircle, FileSpreadsheet, Check, Sparkles, BookOpen, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export default function App() {
  const { locale, setLocale, t } = useLanguage();
  const [excelFiles, setExcelFiles] = useState<UploadedExcelFile[]>([]);
  const [emailData, setEmailData] = useState<EmailData>({
    pns: [],
    mmos: [],
    rawPns: '',
    rawMmos: '',
  });

  // Feature: Toggle Case-Sensitive exact matching
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Load sample dataset
  const handleLoadSample = () => {
    setExcelFiles([
      {
        id: 'sample-file-1',
        name: 'MMO-9092_shortage.xlsx',
        rows: SAMPLE_EXCEL_ROWS,
        pnColIndex: 0,
        qtyColIndex: 1,
        mmoColIndex: 2,
        nameColIndex: 3,
      }
    ]);
    setEmailData(SAMPLE_EMAIL_DATA);
  };

  // Live matching engine supporting multiple Excel sources
  const comparedResults = useMemo<ComparedResult[]>(() => {
    // Set of MMOs in email
    const emailMmoSet = new Set<string>(
      emailData.mmos.map((m) => (caseSensitive ? m.trim() : m.trim().toLowerCase()))
    );

    // Set of PNs in email
    const emailPnSet = new Set<string>(
      emailData.pns.map((p) => (caseSensitive ? p.trim() : p.trim().toLowerCase()))
    );

    if (excelFiles.length === 0) {
      return [];
    }

    const seenEmailPnsInExcel = new Set<string>();
    const excelResults: ComparedResult[] = [];
    const excelMmosSet = new Set<string>();

    // Process each Excel file independently
    excelFiles.forEach((file) => {
      // 1. Clean the filename to get a potential MMO candidate (strip extension)
      const fileMmoCandidate = file.name.replace(/\.[^/.]+$/, "").trim();
      
      // Check if there is an exact match in the email list
      const targetNormalized = caseSensitive ? fileMmoCandidate : fileMmoCandidate.toLowerCase();
      const hasExactMatch = emailData.mmos.some((mmo) => {
        const cleanMmo = caseSensitive ? mmo.trim() : mmo.trim().toLowerCase();
        return cleanMmo === targetNormalized;
      });

      let extractedMmo: string | null = null;
      let isExtractedMmoInEmail = false;

      if (hasExactMatch) {
        extractedMmo = fileMmoCandidate;
        isExtractedMmoInEmail = true;
      } else {
        // If no exact match, try to find if any of the email's MMOs is contained in the filename or vice versa
        const matchedMmo = emailData.mmos.find((mmo) => {
          const cleanMmo = mmo.trim().toLowerCase().replace(/\s/g, '');
          const cleanFn = file.name.toLowerCase().replace(/\s/g, '');
          const cleanFnNoExt = fileMmoCandidate.toLowerCase().replace(/\s/g, '');
          return cleanFn.includes(cleanMmo) || cleanMmo.includes(cleanFnNoExt);
        });

        if (matchedMmo) {
          extractedMmo = matchedMmo.trim();
          isExtractedMmoInEmail = true;
        } else {
          // If no match is found in the email, the MMO is still the filename itself!
          extractedMmo = fileMmoCandidate;
          isExtractedMmoInEmail = false;
        }
      }

      // Now, keep all files active! We do not discard any file even if the MMO is not in the email.
      // If the MMO is not found in the email, the MMO name is still extracted from the filename.

      file.rows.forEach((row) => {
        const cleanedPN = row.PN.trim();
        const resolvedMMO = extractedMmo ? extractedMmo : row.MMO.trim();

        // Normalize based on case sensitivity state
        const targetMmo = caseSensitive ? resolvedMMO : resolvedMMO.toLowerCase();
        const targetPn = caseSensitive ? cleanedPN : cleanedPN.toLowerCase();

        const mmoInEmail = emailMmoSet.has(targetMmo);
        const m = emailPnSet.has(targetPn);
        if (m) {
          seenEmailPnsInExcel.add(targetPn);
        }

        const isShort = row.ShortQty > 0;
        const isNeedToCheck = m && isShort; // PN in email AND in Excel AND ShortQty > 0

        // Under the new rules:
        // 🔴 Need to Check (1st) — PN อยู่ใน email + อยู่ใน Excel + Short > 0
        // 🟢 Good/NR (Good) — อื่นๆ (รวมถึง Not reported / MMO ไม่อยู่ในเมล)
        const status: MatchStatus = isNeedToCheck ? '1st' : 'Good';

        excelMmosSet.add(targetMmo);

        excelResults.push({
          id: `${file.id}-${row.id}`,
          PN: row.PN,
          MMO: resolvedMMO, // Display resolved MMO
          ShortQty: row.ShortQty,
          PartName: row.PartName, // Pass the parsed part description
          e: isShort,
          m,
          mmoInEmail,
          status,
        });
      });
    });

    // 🟡 2nd — PN อยู่ใน email แต่ไม่อยู่ใน Excel (0 PN)
    const emailDiscrepancyResults: ComparedResult[] = [];
    
    // Create mapping of normalized email PN to original email PN
    const emailPnOriginalMap = new Map<string, string>();
    emailData.pns.forEach((p) => {
      emailPnOriginalMap.set(caseSensitive ? p.trim() : p.trim().toLowerCase(), p.trim());
    });

    // Find the primary MMO from the first matched Excel file
    let firstExcelMmo = 'Unknown MMO';
    for (const file of excelFiles) {
      const fileMmoCandidate = file.name.replace(/\.[^/.]+$/, "").trim();
      const targetNormalized = caseSensitive ? fileMmoCandidate : fileMmoCandidate.toLowerCase();
      const isMatched = emailData.mmos.some((mmo) => {
        const cleanMmo = caseSensitive ? mmo.trim() : mmo.trim().toLowerCase();
        return cleanMmo === targetNormalized;
      }) || emailData.mmos.some((mmo) => {
        const cleanMmo = mmo.trim().toLowerCase().replace(/\s/g, '');
        const cleanFn = file.name.toLowerCase().replace(/\s/g, '');
        const cleanFnNoExt = fileMmoCandidate.toLowerCase().replace(/\s/g, '');
        return cleanFn.includes(cleanMmo) || cleanMmo.includes(cleanFnNoExt);
      });

      if (isMatched) {
        firstExcelMmo = fileMmoCandidate;
        break;
      }
    }

    emailPnSet.forEach((targetPn) => {
      if (!seenEmailPnsInExcel.has(targetPn)) {
        const originalPn = emailPnOriginalMap.get(targetPn) || targetPn;
        
        // Find mapped MMO for this email PN from the email data
        const mappedMmo = emailData.pnToMmoMap?.[targetPn.toLowerCase()];
        
        if (mappedMmo) {
          const normMappedMmo = caseSensitive ? mappedMmo.trim() : mappedMmo.trim().toLowerCase();
          if (!excelMmosSet.has(normMappedMmo)) {
            // This PN belongs to another MMO in the email that is not in any matched Excel file. Skip it!
            return;
          }
        } else if (emailData.mmos.length > 1) {
          // This PN is not mapped to any MMO, but there are multiple MMOs in the email.
          // To prevent false positive discrepancies from other MMO sets, skip it!
          return;
        }
        
        const resolvedMmoForDiscrepancy = mappedMmo 
          ? (caseSensitive ? mappedMmo : mappedMmo.toUpperCase()) 
          : 'Unknown MMO';
        
        emailDiscrepancyResults.push({
          id: `email-discrepancy-${targetPn}`,
          PN: originalPn,
          MMO: resolvedMmoForDiscrepancy,
          ShortQty: 0,
          PartName: locale === 'th' ? '[พบพาร์ทในอีเมลแต่ไม่อยู่ในไฟล์ Excel]' : '[PN in Email but not in Excel]',
          e: false,
          m: true,
          mmoInEmail: true,
          status: '2nd',
        });
      }
    });

    const finalResults = [...excelResults, ...emailDiscrepancyResults];

    // Sort final results by status: Need to Check (1st) > 2nd (2nd) > Good / NR (Good, Not reported)
    const statusOrder: Record<string, number> = {
      '1st': 1,
      '2nd': 2,
      'Good': 3,
      'Not reported': 3
    };

    finalResults.sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // If same status, sort alphabetically by PN for a cleaner report layout
      return a.PN.localeCompare(b.PN, undefined, { numeric: true, sensitivity: 'base' });
    });

    return finalResults;
  }, [excelFiles, emailData, caseSensitive]);

  // Compute stats
  const stats = useMemo(() => {
    const total = comparedResults.length;
    let notReported = 0;
    let first = 0;
    let second = 0;
    let good = 0;

    comparedResults.forEach((r) => {
      if (r.status === 'Not reported') notReported++;
      else if (r.status === '1st') first++;
      else if (r.status === '2nd') second++;
      else if (r.status === 'Good') good++;
    });

    return { total, notReported, first, second, good };
  }, [comparedResults]);

  return (
    <div className="min-h-screen bg-[#EDEFF2] text-[#1A1C1E] font-sans antialiased" id="app-root">
      {/* High Density Top Header */}
      <header className="bg-[#1A1C1E] border-b border-[#2D3135] sticky top-0 z-50 text-white" id="main-header">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-[#2D3135] text-[#10B981] rounded">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-wider text-white">{t('header_title')}</h1>
              <p className="text-[10px] text-[#A6ADB5] uppercase tracking-widest">{t('header_subtitle')}</p>
            </div>
          </div>

          {/* Quick Configs */}
          <div className="flex items-center gap-3 w-full sm:w-auto self-stretch sm:self-auto justify-end">
            {/* Language Switcher */}
            <div className="flex items-center bg-[#2D3135] p-0.5 rounded border border-[#3A3F44]" id="lang-switcher">
              <button
                onClick={() => setLocale('th')}
                className={`px-2 py-0.5 text-[10px] font-black rounded transition-all cursor-pointer ${
                  locale === 'th' ? 'bg-[#10B981] text-white' : 'text-[#A6ADB5] hover:text-white bg-transparent'
                }`}
                title="ภาษาไทย"
              >
                TH
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`px-2 py-0.5 text-[10px] font-black rounded transition-all cursor-pointer ${
                  locale === 'en' ? 'bg-[#10B981] text-white' : 'text-[#A6ADB5] hover:text-white bg-transparent'
                }`}
                title="English"
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-[#2D3135] rounded hover:bg-[#2D3135] transition-all cursor-pointer bg-transparent text-white"
              id="toggle-case-sensitive"
              title="Toggle case-sensitive string matching for PNs and MMOs"
            >
              {caseSensitive ? (
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              )}
              <span>{t('case_sensitive')}</span>
            </button>

            {excelFiles.length === 0 && (
              <button
                onClick={handleLoadSample}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-[#10B981] hover:bg-emerald-600 rounded transition-all cursor-pointer"
                id="header-load-sample-btn"
              >
                <Sparkles className="h-3 w-3" />
                {t('demo_data')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Logic Explanation Bar */}
        <div className="bg-white border border-[#D1D5DB] rounded p-3 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div className="md:col-span-1 flex items-center gap-2">
            <div className="p-1.5 bg-[#F1F3F5] rounded shrink-0">
              <BookOpen className="h-4 w-4 text-[#1A1C1E]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#1A1C1E] uppercase tracking-tight">{t('decision_matrix')}</h3>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">{t('comparison_rule_set')}</p>
            </div>
          </div>
          
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
            <div className="p-2 bg-[#F8F9FA] border border-[#D1D5DB] rounded">
              <span className="font-bold text-[#EF4444] uppercase text-[9px] tracking-wider block mb-0.5">🔴 {t('need_to_check')}</span>
              <p className="text-[#4B5563]">{t('need_to_check_desc')}</p>
            </div>
            <div className="p-2 bg-[#F8F9FA] border border-[#D1D5DB] rounded">
              <span className="font-bold text-[#F59E0B] uppercase text-[9px] tracking-wider block mb-0.5">🟡 {t('status_2nd')}</span>
              <p className="text-[#4B5563]">{t('status_2nd_desc')}</p>
            </div>
            <div className="p-2 bg-[#F8F9FA] border border-[#D1D5DB] rounded">
              <span className="font-bold text-[#10B981] uppercase text-[9px] tracking-wider block mb-0.5">🟢 {t('status_good')}</span>
              <p className="text-[#4B5563]">{t('status_good_desc')}</p>
            </div>
          </div>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-7 h-full">
            <ExcelInput
              files={excelFiles}
              onFilesChange={setExcelFiles}
              onLoadSample={handleLoadSample}
              emailMmos={emailData.mmos}
            />
          </div>
          <div className="lg:col-span-5 h-full">
            <EmailInput
              emailData={emailData}
              onEmailDataChange={setEmailData}
            />
          </div>
        </div>

        {/* Output Reports */}
        <div className="w-full">
          <ResultsDisplay
            results={comparedResults}
            stats={stats}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-6 border-t border-[#D1D5DB] text-center text-[10px] text-[#6B7280] uppercase tracking-wider">
        <p>{t('footer_text')}</p>
      </footer>
    </div>
  );
}

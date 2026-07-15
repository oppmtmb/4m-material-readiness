import React, { useState, useRef } from 'react';
import { EmailData } from '../types';
import { Mail, Hash, Layers, Upload, AlertCircle, Trash2, FileText, Check } from 'lucide-react';
import MsgReader from '@kenjiuno/msgreader';
import { useLanguage } from '../LanguageContext';

interface EmailInputProps {
  emailData: EmailData;
  onEmailDataChange: (newData: EmailData) => void;
}

interface UploadedEmailFile {
  id: string;
  name: string;
  pns: string[];
  mmos: string[];
  pnToMmoMap?: Record<string, string>;
}

export default function EmailInput({ emailData, onEmailDataChange }: EmailInputProps) {
  const { t, locale } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedEmailFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Utility to parse manual edits inside the textareas
  const parseRawList = (rawText: string): string[] => {
    if (!rawText) return [];
    return rawText
      .split(/[\n,;\t]+/) // split by newline, comma, semicolon, or tab
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const extractDataFromText = (text: string) => {
    // Regex for MMO/WO/MO Codes: e.g. MMO-12345, MMOA-2606000126, MMOB-2606000082, MMO-2606000009, WO-2606000092, MO-2606000092, WO2606000092
    const mmoRegex = /\b(?:MMO[A-Za-z0-9]?|WO|MO)[-_\s]?[A-Za-z0-9-]{4,15}\b/gi;

    // Enhanced general Part Number regex: Matches alphanumeric strings with optional hyphens, length 9-25
    const pnRegex = /\b[0-9A-Za-z][A-Za-z0-9-]{8,24}\b/gi;

    const lines = text.split(/\r?\n/);
    const pns: string[] = [];
    const mmos: string[] = [];
    const pnToMmoMap: Record<string, string> = {};

    let currentMmo = '';

    lines.forEach(line => {
      // Find all MMOs on this line
      const lineMmos = line.match(mmoRegex);
      if (lineMmos && lineMmos.length > 0) {
        currentMmo = lineMmos[lineMmos.length - 1].trim().toUpperCase();
        lineMmos.forEach(m => mmos.push(m.trim().toUpperCase()));
      }

      // Find all PNs on this line
      const linePns = line.match(pnRegex);
      if (linePns) {
        linePns.forEach(p => {
          const cleanPn = p.trim();
          const upperPn = cleanPn.toUpperCase();
          // Filter out if it is an MMO code or doesn't have at least one digit (to prevent regular words)
          const isMmoCode = /\b(?:MMO[A-Za-z0-9]?|WO|MO)[-_\s]?[A-Za-z0-9-]{4,15}\b/i.test(cleanPn) || upperPn.startsWith('MMO') || upperPn.startsWith('WO') || upperPn.startsWith('MO');
          const hasDigit = /\d/.test(cleanPn);
          
          if (!isMmoCode && hasDigit) {
            pns.push(cleanPn);
            if (currentMmo) {
              pnToMmoMap[cleanPn.toLowerCase()] = currentMmo.toUpperCase();
            }
          }
        });
      }
    });

    const uniquePns = Array.from(new Set(pns)) as string[];
    const uniqueMmos = Array.from(new Set(mmos)) as string[];

    return { pns: uniquePns, mmos: uniqueMmos, pnToMmoMap };
  };

  const handlePnsChange = (val: string) => {
    // If the pasted text contains MMO patterns, let's run the full extractor to build maps automatically
    const hasMmoPatterns = /\b(?:MMO[A-Za-z0-9]?|WO|MO)[-_\s]?[A-Za-z0-9-]{4,15}\b/i.test(val);
    
    if (hasMmoPatterns) {
      const { pns, mmos, pnToMmoMap } = extractDataFromText(val);
      if (pns.length > 0 || mmos.length > 0) {
        onEmailDataChange({
          pns,
          mmos,
          rawPns: pns.join('\n'),
          rawMmos: mmos.join(', '),
          pnToMmoMap,
        });
        return;
      }
    }

    const parsed = parseRawList(val);
    
    // Preserve existing maps for PNs that are still in the list
    const updatedPnToMmoMap: Record<string, string> = {};
    if (emailData.pnToMmoMap) {
      parsed.forEach(pn => {
        const normPn = pn.toLowerCase();
        if (emailData.pnToMmoMap?.[normPn]) {
          updatedPnToMmoMap[normPn] = emailData.pnToMmoMap[normPn];
        }
      });
    }

    onEmailDataChange({
      ...emailData,
      rawPns: val,
      pns: parsed,
      pnToMmoMap: updatedPnToMmoMap,
    });
  };

  const handleMmosChange = (val: string) => {
    // If pasted text contains both MMO and PN patterns, let's run the full extractor
    const hasPnPatterns = /\b[0-9A-Za-z][A-Za-z0-9-]{8,24}\b/i.test(val);
    
    if (hasPnPatterns) {
      const { pns, mmos, pnToMmoMap } = extractDataFromText(val);
      if (pns.length > 0 || mmos.length > 0) {
        onEmailDataChange({
          pns,
          mmos,
          rawPns: pns.join('\n'),
          rawMmos: mmos.join(', '),
          pnToMmoMap,
        });
        return;
      }
    }

    const parsed = parseRawList(val);
    
    // Filter out mapped entries whose MMO is no longer in the list
    const allowedMmos = new Set(parsed.map(m => m.toUpperCase()));
    const updatedPnToMmoMap: Record<string, string> = {};
    if (emailData.pnToMmoMap) {
      Object.entries(emailData.pnToMmoMap).forEach(([pn, mmo]) => {
        if (allowedMmos.has(mmo.toUpperCase())) {
          updatedPnToMmoMap[pn] = mmo;
        }
      });
    }

    onEmailDataChange({
      ...emailData,
      rawMmos: val,
      mmos: parsed,
      pnToMmoMap: updatedPnToMmoMap,
    });
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Safely instantiate MsgReader constructor across different bundler import styles
  const getMsgReaderInstance = (buffer: ArrayBuffer) => {
    let ReaderConstructor: any = MsgReader;
    if (ReaderConstructor && (ReaderConstructor as any).default) {
      ReaderConstructor = (ReaderConstructor as any).default;
    }
    return new ReaderConstructor(buffer);
  };

  const processSingleFile = (file: File): Promise<UploadedEmailFile> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'msg') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const msgReader = getMsgReaderInstance(buffer);
            const fileData = msgReader.getFileData();

            const subject = fileData.subject || '';
            let bodyText = fileData.body || '';
            if (!bodyText && fileData.html) {
              bodyText = fileData.html
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, '\n');
            }
            const combinedText = `${subject}\n${bodyText}`;

            const { pns, mmos, pnToMmoMap } = extractDataFromText(combinedText);

            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              pns,
              mmos,
              pnToMmoMap,
            });
          } catch (err: any) {
            reject(new Error(`Failed to parse Outlook MSG file "${file.name}": ${err.message}`));
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(buffer);

            let decodedText = '';
            try {
              const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
              decodedText = decoderUtf8.decode(bytes);
            } catch (e) {
              try {
                const decoderUtf16 = new TextDecoder('utf-16le', { fatal: true });
                decodedText = decoderUtf16.decode(bytes);
              } catch (err) {
                const decoderLatin1 = new TextDecoder('windows-1252');
                decodedText = decoderLatin1.decode(bytes);
              }
            }

            // Strip HTML tags for cleaner line-by-line parsing if it's an HTML/EML file
            if (decodedText.toLowerCase().includes('<html') || decodedText.toLowerCase().includes('<!doctype') || /<[a-z][\s\S]*>/i.test(decodedText)) {
              decodedText = decodedText
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, '\n');
            }

            const { pns, mmos, pnToMmoMap } = extractDataFromText(decodedText);

            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              pns,
              mmos,
              pnToMmoMap,
            });
          } catch (err: any) {
            reject(new Error(`Failed to read file "${file.name}": ${err.message}`));
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFiles = async (files: File[]) => {
    setErrorMessage(null);
    const parsedFilesList: UploadedEmailFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const parsed = await processSingleFile(file);
        parsedFilesList.push(parsed);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    if (parsedFilesList.length > 0) {
      const updatedFiles = [...uploadedFiles, ...parsedFilesList];
      setUploadedFiles(updatedFiles);

      // Union of all PNs and MMOs across all uploaded files
      const allPns = Array.from(new Set(updatedFiles.flatMap(f => f.pns))) as string[];
      const allMmos = Array.from(new Set(updatedFiles.flatMap(f => f.mmos))) as string[];

      const mergedPnToMmoMap: Record<string, string> = {};
      updatedFiles.forEach(f => {
        if (f.pnToMmoMap) {
          Object.assign(mergedPnToMmoMap, f.pnToMmoMap);
        }
      });

      onEmailDataChange({
        pns: allPns,
        mmos: allMmos,
        rawPns: allPns.join('\n'),
        rawMmos: allMmos.join(', '),
        pnToMmoMap: mergedPnToMmoMap,
      });
    }
  };

  const handleRemoveFile = (id: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== id);
    setUploadedFiles(updatedFiles);

    // Recalculate union of remaining files
    const allPns = Array.from(new Set(updatedFiles.flatMap(f => f.pns))) as string[];
    const allMmos = Array.from(new Set(updatedFiles.flatMap(f => f.mmos))) as string[];

    const mergedPnToMmoMap: Record<string, string> = {};
    updatedFiles.forEach(f => {
      if (f.pnToMmoMap) {
        Object.assign(mergedPnToMmoMap, f.pnToMmoMap);
      }
    });

    onEmailDataChange({
      pns: allPns,
      mmos: allMmos,
      rawPns: allPns.join('\n'),
      rawMmos: allMmos.join(', '),
      pnToMmoMap: mergedPnToMmoMap,
    });
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
    setErrorMessage(null);
    onEmailDataChange({
      pns: [],
      mmos: [],
      rawPns: '',
      rawMmos: '',
      pnToMmoMap: {},
    });
  };

  return (
    <div className="bg-white rounded border border-[#D1D5DB] shadow-sm overflow-hidden flex flex-col h-full" id="email-input-card">
      {/* Card Header */}
      <div className="p-3 bg-[#F1F3F5] border-b border-[#D1D5DB] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-[#1A1C1E] text-white rounded">
            <Mail className="h-4 w-4 text-[#A6ADB5]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1A1C1E] uppercase tracking-tight">{t('email_source')}</h2>
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">{t('email_sub')}</p>
          </div>
        </div>
        {uploadedFiles.length > 0 && (
          <button
            onClick={handleClearAllFiles}
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4B5563] border border-[#D1D5DB] hover:bg-zinc-50 rounded transition-colors cursor-pointer"
            id="clear-email-btn"
          >
            {t('clear_all')}
          </button>
        )}
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-auto">
        {/* Email File Drag & Drop (Multiple Files) */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
            {uploadedFiles.length > 0 
              ? (locale === 'th' ? `ไฟล์อีเมลที่ใช้งาน (${uploadedFiles.length})` : `Active Email Files (${uploadedFiles.length})`) 
              : t('email_upload')}
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`h-24 border border-dashed rounded flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors p-2 ${
              uploadedFiles.length > 0 
                ? 'border-[#10B981] bg-[#ECFDF5]'
                : dragActive
                  ? 'border-[#1A1C1E] bg-[#EDEFF2]'
                  : 'border-[#D1D5DB] hover:border-[#9CA3AF] bg-[#F8F9FA]'
            }`}
            id="email-file-dropzone"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".msg,.eml,.txt,.html"
              multiple
              className="hidden"
            />
            <Upload className={`h-4 w-4 ${uploadedFiles.length > 0 ? 'text-[#10B981]' : 'text-[#4B5563]'}`} />
            <div className="text-center max-w-full px-2 overflow-hidden text-ellipsis">
              <span className="text-[10px] font-bold text-[#1A1C1E] uppercase block">
                {uploadedFiles.length > 0 
                  ? (locale === 'th' ? 'เพิ่มไฟล์อีเมลมากขึ้น' : 'Add More Email Files') 
                  : (locale === 'th' ? 'อัปโหลดไฟล์อีเมล' : 'Upload Email Files')}
              </span>
              <span className="text-[9px] text-[#9CA3AF]">
                {t('email_drag_drop')}
              </span>
            </div>
          </div>
        </div>

        {/* List of Active Files */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-1" id="uploaded-files-list">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">
              {locale === 'th' ? 'ไฟล์ที่อัปโหลดแล้ว' : 'Uploaded Files'}
            </span>
            <div className="max-h-24 overflow-y-auto border border-[#E5E7EB] rounded bg-[#F8F9FA] divide-y divide-[#E5E7EB]">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="p-1.5 flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <FileText className="h-3 w-3 text-[#4B5563] shrink-0" />
                    <span className="font-medium text-[#1A1C1E] truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[8px] px-1 py-0.2 bg-[#E5E7EB] text-[#4B5563] font-mono rounded shrink-0">
                      {file.pns.length} PNs | {file.mmos.length} MMOs
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }}
                    className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded flex items-start gap-1.5 text-[11px] shrink-0" id="email-error-banner">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Email PNs */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <Hash className="h-3 w-3 text-zinc-400" />
              {t('extracted_pns')}
            </label>
            <span className="text-[10px] px-1.5 py-0.5 font-mono font-bold bg-[#E5E7EB] text-[#1F2937] rounded">
              {emailData.pns.length} {locale === 'th' ? 'พาร์ทที่เป็นเอกลักษณ์' : 'unique PNs'}
            </span>
          </div>
          <textarea
            value={emailData.rawPns}
            onChange={(e) => handlePnsChange(e.target.value)}
            placeholder={t('paste_email_pns')}
            className="w-full h-20 p-2 text-[11px] font-mono bg-[#F8F9FA] border border-[#D1D5DB] rounded focus:outline-none focus:ring-1 focus:ring-[#1A1C1E] focus:border-[#1A1C1E] resize-none"
            id="email-pns-textarea"
          />
          {emailData.pns.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto p-1 bg-[#F8F9FA] rounded border border-[#E5E7EB]">
              {emailData.pns.slice(0, 15).map((pn, i) => (
                <span key={i} className="text-[9px] font-mono px-1 py-0.2 bg-white border border-[#D1D5DB] rounded text-[#1F2937]">
                  {pn}
                </span>
              ))}
              {emailData.pns.length > 15 && (
                <span className="text-[9px] text-[#9CA3AF] px-1 font-bold uppercase">
                  +{emailData.pns.length - 15} {locale === 'th' ? 'รายการเพิ่มเติม' : 'MORE'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Email MMOs */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <Layers className="h-3 w-3 text-zinc-400" />
              {t('extracted_mmos')}
            </label>
            <span className="text-[10px] px-1.5 py-0.5 font-mono font-bold bg-[#E5E7EB] text-[#1F2937] rounded">
              {emailData.mmos.length} {locale === 'th' ? 'MMO ที่เป็นเอกลักษณ์' : 'unique MMOs'}
            </span>
          </div>
          <textarea
            value={emailData.rawMmos}
            onChange={(e) => handleMmosChange(e.target.value)}
            placeholder={t('paste_email_mmos')}
            className="w-full h-20 p-2 text-[11px] font-mono bg-[#F8F9FA] border border-[#D1D5DB] rounded focus:outline-none focus:ring-1 focus:ring-[#1A1C1E] focus:border-[#1A1C1E] resize-none"
            id="email-mmos-textarea"
          />
          {emailData.mmos.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto p-1 bg-[#F8F9FA] rounded border border-[#E5E7EB]">
              {emailData.mmos.slice(0, 15).map((mmo, i) => (
                <span key={i} className="text-[9px] font-mono px-1 py-0.2 bg-white border border-[#D1D5DB] rounded text-[#1F2937]">
                  {mmo}
                </span>
              ))}
              {emailData.mmos.length > 15 && (
                <span className="text-[9px] text-[#9CA3AF] px-1 font-bold uppercase">
                  +{emailData.mmos.length - 15} {locale === 'th' ? 'รายการเพิ่มเติม' : 'MORE'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Informative Help Alert */}
        <div className="p-2.5 bg-[#EDEFF2] border border-[#D1D5DB] rounded text-[11px] text-[#4B5563] space-y-1">
          <span className="font-bold text-[#1A1C1E] uppercase tracking-wider block text-[9px]">
            {locale === 'th' ? 'สูตรตรรกะประเมินสถานะความพร้อมชิ้นส่วน:' : 'Decision Formula Reference:'}
          </span>
          <ul className="space-y-0.5 text-[10px] font-mono">
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#6B7280] rounded-full"></span>
              <span>!mmo_reported &rarr; {locale === 'th' ? 'ไม่ได้ระบุใบสั่งผลิต' : 'Not reported'}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full"></span>
              <span>e & m &rarr; 1st ({locale === 'th' ? 'วิกฤต/ต้องตรวจสอบ' : 'Critical'})</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full"></span>
              <span>e XOR m &rarr; 2nd ({locale === 'th' ? 'ขัดแย้ง' : 'Conflict'})</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></span>
              <span>!e & !m &rarr; Good ({locale === 'th' ? 'ปกติ/สมดุล' : 'Balanced'})</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

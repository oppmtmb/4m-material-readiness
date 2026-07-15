import React, { useState, useRef, useEffect } from 'react';
import { ExcelRow, UploadedExcelFile } from '../types';
import { Plus, Trash2, FileSpreadsheet, Upload, AlertCircle, RefreshCw, Sparkles, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../LanguageContext';

// Robust helper to parse short quantities with commas, brackets, etc.
const parseShortQty = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  if (!str) return 0;
  
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1);
  }
  
  // Remove commas, spaces, and other non-numeric formatting
  str = str.replace(/,/g, '').replace(/\s/g, '');
  
  // Also check if there's an explicit minus sign
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  }
  
  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  return isNegative ? -Math.abs(num) : num;
};

// Robust Text Decoder with encoding detection (UTF-8 with fallback to Windows-874 for Thai Excel exports)
const decodeText = (arrayBuffer: ArrayBuffer): string => {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return utf8Decoder.decode(arrayBuffer);
  } catch (err) {
    // If UTF-8 decoding throws a fatal error, fall back to windows-874 (Thai ANSI)
    try {
      const thaiDecoder = new TextDecoder('windows-874');
      return thaiDecoder.decode(arrayBuffer);
    } catch (e) {
      // Final fallback to non-fatal UTF-8 decoding
      const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
      return fallbackDecoder.decode(arrayBuffer);
    }
  }
};

// Robust CSV & delimited text parser with auto-delimiter detection and quotes support
const parseCsvText = (text: string): any[][] => {
  if (!text) return [];

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  let delimiter = ',';
  if (lines.length > 0) {
    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    
    if (semicolons > commas && semicolons > tabs) {
      delimiter = ';';
    } else if (tabs > commas && tabs > semicolons) {
      delimiter = '\t';
    }
  }

  const result: any[][] = [];
  
  for (const line of lines) {
    const row: string[] = [];
    let insideQuote = false;
    let currentCell = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"';
          i++; // skip next char
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  
  return result;
};

interface ExcelInputProps {
  files: UploadedExcelFile[];
  onFilesChange: (newFiles: UploadedExcelFile[]) => void;
  onLoadSample: () => void;
  emailMmos?: string[];
}

export default function ExcelInput({ files, onFilesChange, onLoadSample, emailMmos }: ExcelInputProps) {
  const { t, locale } = useLanguage();
  const [pasteText, setPasteText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map of fileId to its raw sheetData and sheetHeaders for interactive mapping
  const [fileSheets, setFileSheets] = useState<Record<string, { data: any[][]; headers: string[] }>>({});

  // Automatically select the active file when the file list changes
  useEffect(() => {
    if (files.length > 0) {
      const exists = files.some((f) => f.id === activeFileId);
      if (!activeFileId || !exists) {
        setActiveFileId(files[0].id);
      }
    } else {
      setActiveFileId(null);
    }
  }, [files, activeFileId]);

  const activeFile = files.find((f) => f.id === activeFileId) || null;

  // Retrieve active mapping indexes or default them
  const pnColIndex = activeFile?.pnColIndex ?? 0;
  const qtyColIndex = activeFile?.qtyColIndex ?? 1;
  const mmoColIndex = activeFile?.mmoColIndex ?? 2;
  const nameColIndex = activeFile?.nameColIndex ?? -1;

  // Robust sheet parsing function
  const parseRowsFromSheet = (
    data: any[][],
    pnIdx: number,
    qtyIdx: number,
    mmoIdx: number,
    nameIdx: number,
    startRowIdx: number,
    filename: string
  ): ExcelRow[] => {
    const parsed: ExcelRow[] = [];
    const filenameMmo = filename ? filename.replace(/\.[^/.]+$/, "").trim() : '';

    for (let r = startRowIdx; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      const pnRaw = row[pnIdx];
      const pn = pnRaw !== undefined && pnRaw !== null ? String(pnRaw).trim() : '';
      const rawQty = row[qtyIdx];
      const shortQty = parseShortQty(rawQty);
      const mmoRaw = row[mmoIdx];
      let mmo = mmoRaw !== undefined && mmoRaw !== null ? String(mmoRaw).trim() : '';
      
      const partNameRaw = nameIdx >= 0 ? row[nameIdx] : undefined;
      const partName = partNameRaw !== undefined && partNameRaw !== null ? String(partNameRaw).trim() : '';

      // Override with filename MMO if a file was uploaded
      if (filenameMmo) {
        mmo = filenameMmo;
      }

      if (pn) {
        parsed.push({
          id: crypto.randomUUID(),
          PN: pn,
          ShortQty: shortQty,
          MMO: mmo,
          PartName: partName,
        });
      }
    }
    return parsed;
  };

  // Paste text parser
  const handleParseText = (text: string) => {
    if (!text.trim()) return;

    const lines = text.split(/\r?\n/);
    const parsedRows: ExcelRow[] = [];
    let skipFirstLine = false;

    if (lines.length > 0) {
      const firstLineLower = lines[0].toLowerCase();
      if (
        firstLineLower.includes('pn') ||
        firstLineLower.includes('part') ||
        firstLineLower.includes('qty') ||
        firstLineLower.includes('mmo') ||
        firstLineLower.includes('short') ||
        firstLineLower.includes('name') ||
        firstLineLower.includes('desc')
      ) {
        skipFirstLine = true;
      }
    }

    const virtualFileName = `Pasted_Shortages_${files.length + 1}.csv`;
    const filenameMmo = virtualFileName.replace(/\.[^/.]+$/, "").trim();

    lines.forEach((line, index) => {
      if (index === 0 && skipFirstLine) return;
      if (!line.trim()) return;

      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const cols = line.split(delimiter).map(col => col.trim());

      if (cols.length >= 2) {
        const pn = cols[0];
        let shortQty = 0;
        let mmo = '';
        let partName = '';

        if (cols.length === 2) {
          const cleanValStr = cols[1].replace(/,/g, '').trim();
          const isNum = !isNaN(Number(cleanValStr)) && cleanValStr !== '';
          if (isNum) {
            shortQty = parseShortQty(cols[1]);
          } else {
            mmo = cols[1];
          }
        } else if (cols.length === 3) {
          const isCol1Num = !isNaN(Number(cols[1].replace(/,/g, '').trim()));
          const isCol2Num = !isNaN(Number(cols[2].replace(/,/g, '').trim()));
          
          if (isCol1Num) {
            shortQty = parseShortQty(cols[1]);
            const val = cols[2] || '';
            if (val.toUpperCase().startsWith('MMO') || val.toUpperCase().startsWith('WO') || val.toUpperCase().startsWith('MO')) {
              mmo = val;
            } else {
              partName = val;
            }
          } else if (isCol2Num) {
            partName = cols[1];
            shortQty = parseShortQty(cols[2]);
          } else {
            shortQty = parseShortQty(cols[1]);
            mmo = cols[2];
          }
        } else if (cols.length >= 4) {
          let qtyColIdx = 2;
          for (let i = 1; i < cols.length; i++) {
            const isNum = !isNaN(Number(cols[i].replace(/,/g, '').trim()));
            if (isNum && cols[i].trim() !== '') {
              qtyColIdx = i;
              break;
            }
          }
          
          shortQty = parseShortQty(cols[qtyColIdx]);
          
          if (qtyColIdx === 1) {
            mmo = cols[2] || '';
            partName = cols.slice(3).join(', ');
          } else if (qtyColIdx === 2) {
            partName = cols[1];
            mmo = cols[3] || '';
          } else {
            partName = cols[1];
            mmo = cols[2] || '';
          }
        }

        if (filenameMmo) {
          mmo = filenameMmo;
        }

        if (pn) {
          parsedRows.push({
            id: crypto.randomUUID(),
            PN: pn,
            ShortQty: shortQty,
            MMO: mmo,
            PartName: partName,
          });
        }
      }
    });

    if (parsedRows.length > 0) {
      const newFileId = crypto.randomUUID();
      const newFile: UploadedExcelFile = {
        id: newFileId,
        name: virtualFileName,
        rows: parsedRows,
        pnColIndex: 0,
        qtyColIndex: 1,
        mmoColIndex: 2,
        nameColIndex: -1,
      };

      onFilesChange([...files, newFile]);
      setActiveFileId(newFileId);
      setPasteText('');
      setErrorMessage(null);
    } else {
      setErrorMessage('Could not parse any valid rows. Please check your data format.');
    }
  };

  const handleAddRow = () => {
    if (!activeFile) {
      // Create a virtual file if none exists
      const newFileId = crypto.randomUUID();
      const newFile: UploadedExcelFile = {
        id: newFileId,
        name: 'Manual_Entry.csv',
        rows: [
          {
            id: crypto.randomUUID(),
            PN: '',
            ShortQty: 0,
            MMO: 'Manual',
            PartName: '',
          },
        ],
        pnColIndex: 0,
        qtyColIndex: 1,
        mmoColIndex: 2,
        nameColIndex: -1,
      };
      onFilesChange([...files, newFile]);
      setActiveFileId(newFileId);
      return;
    }

    const newRow: ExcelRow = {
      id: crypto.randomUUID(),
      PN: '',
      ShortQty: 0,
      MMO: activeFile.name.replace(/\.[^/.]+$/, "").trim(),
      PartName: '',
    };

    const updatedFiles = files.map((f) => {
      if (f.id === activeFileId) {
        return {
          ...f,
          rows: [...f.rows, newRow],
        };
      }
      return f;
    });

    onFilesChange(updatedFiles);
  };

  const handleUpdateRow = (rowId: string, field: keyof ExcelRow, value: any) => {
    if (!activeFileId) return;

    const updatedFiles = files.map((f) => {
      if (f.id === activeFileId) {
        const updatedRows = f.rows.map((row) => {
          if (row.id === rowId) {
            if (field === 'ShortQty') {
              const num = parseShortQty(value);
              return {
                ...row,
                [field]: num,
                rawShortQty: value,
              };
            }
            return { ...row, [field]: value };
          }
          return row;
        });
        return { ...f, rows: updatedRows };
      }
      return f;
    });

    onFilesChange(updatedFiles);
  };

  const handleDeleteRow = (rowId: string) => {
    if (!activeFileId) return;

    const updatedFiles = files.map((f) => {
      if (f.id === activeFileId) {
        return {
          ...f,
          rows: f.rows.filter((row) => row.id !== rowId),
        };
      }
      return f;
    });

    onFilesChange(updatedFiles);
  };

  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesChange(files.filter((f) => f.id !== fileId));
    
    // Clean sheet record
    const updatedSheets = { ...fileSheets };
    delete updatedSheets[fileId];
    setFileSheets(updatedSheets);

    if (activeFileId === fileId) {
      setActiveFileId(null);
    }
  };

  const handleClearAll = () => {
    onFilesChange([]);
    setFileSheets({});
    setActiveFileId(null);
    setErrorMessage(null);
  };

  // File Drag & Drop handlers
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
      // Process all dropped files
      Array.from(e.dataTransfer.files).forEach((file) => {
        handleFile(file as File);
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
        handleFile(file as File);
      });
      // Clear file input so same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  const handleFile = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const newFileId = crypto.randomUUID();

    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';
    const isCsv = fileExtension === 'csv' || fileExtension === 'txt';

    if (isExcel || isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let jsonData: any[][] = [];

          if (isExcel) {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (workbook.SheetNames.length === 0) {
              setErrorMessage(`The file ${file.name} has no worksheets.`);
              return;
            }

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          } else {
            // It is CSV or TXT. Read as array buffer, decode automatically with text decoder, and parse
            const buffer = e.target?.result as ArrayBuffer;
            const text = decodeText(buffer);
            jsonData = parseCsvText(text);
          }

          if (jsonData.length === 0) {
            setErrorMessage(`The file ${file.name} is empty.`);
            return;
          }

          // Highly Robust, Score-Based Column Detection
          const maxCols = Math.max(...jsonData.map(r => r ? r.length : 0));
          let bestHeaderRowIndex = 0;
          let maxHeaderMatches = -1;

          for (let r = 0; r < Math.min(jsonData.length, 10); r++) {
            const row = jsonData[r];
            if (!row || row.length === 0) continue;
            let rowMatches = 0;
            row.forEach((cell) => {
              if (cell !== undefined && cell !== null) {
                const cellStr = String(cell).toLowerCase().trim();
                const isPn = cellStr.includes('pn') || cellStr.includes('part') || cellStr.includes('p/n') || cellStr.includes('material') || cellStr.includes('item') || cellStr.includes('รหัส') || cellStr.includes('พาร์ท');
                const isQty = cellStr.includes('qty') || cellStr.includes('short') || cellStr.includes('quantity') || cellStr.includes('shortage') || cellStr.includes('จำนวน') || cellStr.includes('ยอด') || cellStr.includes('ขาด');
                const isMmo = cellStr === 'wo' || cellStr === 'mo' || cellStr === 'w/o' || cellStr === 'm.o' || cellStr.includes('mmo') || cellStr.includes('work order') || cellStr.includes('work_order') || cellStr.includes('order no') || cellStr.includes('ใบสั่ง') || cellStr.includes('สั่งผลิต');
                if (isPn || isQty || isMmo) {
                  rowMatches++;
                }
              }
            });
            if (rowMatches > maxHeaderMatches) {
              maxHeaderMatches = rowMatches;
              bestHeaderRowIndex = r;
            }
          }

          const headerRow = jsonData[bestHeaderRowIndex] || [];
          let pnIdx = 0;
          let qtyIdx = 1;
          let mmoIdx = 2;
          let nameIdx = -1;

          let maxPnScore = -1;
          let maxQtyScore = -1;
          let maxMmoScore = -1;
          let maxNameScore = -1;

          const lowerEmailMmos = new Set((emailMmos || []).map(m => m.trim().toLowerCase()));

          for (let col = 0; col < maxCols; col++) {
            let pnScore = 0;
            let qtyScore = 0;
            let mmoScore = 0;
            let nameScore = 0;

            const headerCell = headerRow[col];
            if (headerCell !== undefined && headerCell !== null) {
              const headerStr = String(headerCell).toLowerCase().trim();

              if (headerStr.includes('pn') || headerStr.includes('part') || headerStr.includes('p/n') || headerStr.includes('material') || headerStr.includes('item') || headerStr.includes('รหัส') || headerStr.includes('พาร์ท') || headerStr.includes('ชิ้นส่วน')) {
                pnScore += 100;
              }
              if (headerStr.includes('qty') || headerStr.includes('short') || headerStr.includes('quantity') || headerStr.includes('shortage') || headerStr.includes('จำนวน') || headerStr.includes('ยอด') || headerStr.includes('ขาด')) {
                qtyScore += 100;
              }
              if (headerStr === 'wo' || headerStr === 'mo' || headerStr === 'w/o' || headerStr === 'm.o' || headerStr.includes('w.o') || headerStr.includes('m.o') || headerStr.includes('wo') || headerStr.includes('mmo') || headerStr.includes('work order') || headerStr.includes('work_order') || headerStr.includes('order no') || headerStr.includes('ใบสั่ง') || headerStr.includes('สั่งผลิต')) {
                mmoScore += 100;
              }
              if (headerStr.includes('name') || headerStr.includes('desc') || headerStr.includes('detail') || headerStr.includes('ชื่อ') || headerStr.includes('รายละเอียด') || headerStr.includes('นิยาม')) {
                nameScore += 100;
              }
              if (headerStr.includes('remark') || headerStr.includes('line') || headerStr.includes('status') || headerStr.includes('หมายเหตุ') || headerStr.includes('สถานะ') || headerStr.includes('คอมเมนต์') || headerStr.includes('comment')) {
                mmoScore -= 150;
              }
            }

            for (let r = bestHeaderRowIndex + 1; r < Math.min(jsonData.length, bestHeaderRowIndex + 30); r++) {
              const row = jsonData[r];
              if (!row) continue;
              const cellVal = row[col];
              if (cellVal === undefined || cellVal === null) continue;

              const valStr = String(cellVal).trim();
              if (!valStr) continue;

              const lowerVal = valStr.toLowerCase();
              const isPnPattern = /^[a-zA-Z0-9-]{8,25}$/.test(valStr);
              const isPureNumber = /^\d+$/.test(valStr);
              if (isPnPattern && !isPureNumber) {
                pnScore += 5;
              }

              const cleanVal = valStr.replace(/,/g, '').replace(/\s/g, '');
              const parsedNum = parseFloat(cleanVal.startsWith('(') && cleanVal.endsWith(')') ? cleanVal.slice(1, -1) : cleanVal);
              if (!isNaN(parsedNum) && cleanVal.length < 8) {
                qtyScore += 5;
              }

              if (lowerVal.startsWith('mmo')) {
                mmoScore += 15;
              }
              if (lowerEmailMmos.has(lowerVal)) {
                mmoScore += 50;
              }

              if (valStr.includes(' ') && valStr.length > 10 && isNaN(Number(valStr))) {
                nameScore += 5;
              }
            }

            if (pnScore > maxPnScore) {
              maxPnScore = pnScore;
              pnIdx = col;
            }
            if (qtyScore > maxQtyScore) {
              maxQtyScore = qtyScore;
              qtyIdx = col;
            }
            if (mmoScore > maxMmoScore) {
              maxMmoScore = mmoScore;
              mmoIdx = col;
            }
            if (nameScore > maxNameScore) {
              maxNameScore = nameScore;
              nameIdx = col;
            }
          }

          const maxColsForHeaders = Math.max(...jsonData.map(r => r ? r.length : 0));
          const fullHeaders: string[] = [];
          for (let i = 0; i < maxColsForHeaders; i++) {
            const cellVal = headerRow[i];
            const name = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
            fullHeaders.push(name ? `${name} (Col ${XLSX.utils.encode_col(i)})` : `Column ${XLSX.utils.encode_col(i)}`);
          }

          const parsed = parseRowsFromSheet(jsonData, pnIdx, qtyIdx, mmoIdx, nameIdx, bestHeaderRowIndex + 1, file.name);

          // Save spreadsheet data
          setFileSheets((prev) => ({
            ...prev,
            [newFileId]: { data: jsonData, headers: fullHeaders },
          }));

          const newFile: UploadedExcelFile = {
            id: newFileId,
            name: file.name,
            rows: parsed,
            pnColIndex: pnIdx,
            qtyColIndex: qtyIdx,
            mmoColIndex: mmoIdx,
            nameColIndex: nameIdx,
          };

          onFilesChange([...files, newFile]);
          setActiveFileId(newFileId);
          setErrorMessage(null);
        } catch (err: any) {
          setErrorMessage(`Failed to parse ${file.name}: ${err.message}`);
        }
      };
      reader.onerror = () => {
        setErrorMessage(`Failed to read the file ${file.name}.`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMessage(`Unsupported file format: ${file.name}`);
    }
  };

  const handleMappingChange = (type: 'pn' | 'qty' | 'mmo' | 'name', index: number) => {
    if (!activeFileId || !activeFile) return;
    const sheet = fileSheets[activeFileId];
    if (!sheet) return;

    let newPn = pnColIndex;
    let newQty = qtyColIndex;
    let newMmo = mmoColIndex;
    let newName = nameColIndex;

    if (type === 'pn') newPn = index;
    else if (type === 'qty') newQty = index;
    else if (type === 'mmo') newMmo = index;
    else if (type === 'name') newName = index;

    const parsed = parseRowsFromSheet(sheet.data, newPn, newQty, newMmo, newName, 1, activeFile.name);

    onFilesChange(
      files.map((f) => {
        if (f.id === activeFileId) {
          return {
            ...f,
            pnColIndex: newPn,
            qtyColIndex: newQty,
            mmoColIndex: newMmo,
            nameColIndex: newName,
            rows: parsed,
          };
        }
        return f;
      })
    );
  };

  // Check matched status of each file against email MMO list
  const getFileMmoStatus = (filename: string) => {
    if (!emailMmos || emailMmos.length === 0) return { matched: false, mmo: '' };
    const fileMmoCandidate = filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
    
    let matchedMmoName = '';
    const isMatched = emailMmos.some((mmo) => {
      const cleanMmo = mmo.trim().toLowerCase();
      const cleanFn = filename.toLowerCase();
      
      const match = cleanMmo === fileMmoCandidate || cleanFn.includes(cleanMmo) || cleanMmo.includes(fileMmoCandidate);
      if (match) {
        matchedMmoName = mmo.trim();
      }
      return match;
    });

    return { matched: isMatched, mmo: matchedMmoName || filename.replace(/\.[^/.]+$/, "").trim() };
  };

  return (
    <div className="bg-white rounded border border-[#D1D5DB] shadow-sm overflow-hidden flex flex-col h-full animate-fade-in" id="excel-input-card">
      {/* Card Header */}
      <div className="p-3 bg-[#F1F3F5] border-b border-[#D1D5DB] flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-[#1A1C1E] text-white rounded">
            <FileSpreadsheet className="h-4 w-4 text-[#A6ADB5]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#1A1C1E] uppercase tracking-tight">{t('excel_source')}</h2>
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">{t('excel_sub')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onLoadSample}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-[#1A1C1E] hover:bg-black rounded transition-colors cursor-pointer"
            id="load-sample-btn"
            title="Load standard demo dataset"
          >
            <Sparkles className="h-3 w-3" />
            {t('demo_data')}
          </button>
          <button
            onClick={handleClearAll}
            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4B5563] border border-[#D1D5DB] hover:bg-zinc-50 rounded transition-colors cursor-pointer"
            id="clear-excel-btn"
          >
            {t('clear_all')}
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col overflow-auto">
        
        {/* Upload & Paste Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          {/* Quick Paste Area */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">{t('excel_paste')}</label>
            <div className="relative">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t('paste_text_placeholder')}
                className="w-full h-20 p-2 text-[11px] font-mono bg-[#F8F9FA] border border-[#D1D5DB] rounded focus:outline-none focus:ring-1 focus:ring-[#1A1C1E] focus:border-[#1A1C1E] resize-none"
                id="excel-paste-textarea"
              />
              {pasteText.trim() && (
                <button
                  onClick={() => handleParseText(pasteText)}
                  className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-[#1A1C1E] hover:bg-black text-white font-bold text-[10px] uppercase tracking-wider rounded shadow transition-colors cursor-pointer"
                  id="parse-excel-btn"
                >
                  {t('parse_rows_btn')}
                </button>
              )}
            </div>
          </div>

          {/* Drag & Drop File Upload */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
              {t('excel_upload')}
            </label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-20 border border-dashed rounded flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors p-2 ${
                dragActive
                  ? 'border-[#1A1C1E] bg-[#EDEFF2]'
                  : 'border-[#D1D5DB] hover:border-[#9CA3AF] bg-[#F8F9FA]'
              }`}
              id="file-dropzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv,.txt"
                multiple
                className="hidden"
              />
              <Upload className="h-4 w-4 text-[#4B5563]" />
              <div className="text-center max-w-full px-2 overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-[10px] font-bold text-[#1A1C1E] uppercase block">{t('excel_upload_sub')}</span>
                <span className="text-[9px] text-[#9CA3AF]">{t('excel_drag_drop')}</span>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded flex items-start gap-1.5 text-[11px] shrink-0" id="excel-error-banner">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Uploaded Files Manager List */}
        {files.length > 0 && (
          <div className="space-y-1 shrink-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
              {t('excel_manage')} ({files.length} {t('active')})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto p-1 bg-[#F8F9FA] border border-[#D1D5DB] rounded">
              {files.map((file) => {
                const isActive = file.id === activeFileId;
                const { matched, mmo } = getFileMmoStatus(file.name);
                
                return (
                  <div
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={`p-2 rounded border transition-all cursor-pointer flex flex-col justify-between gap-1 relative ${
                      isActive
                        ? 'border-[#1A1C1E] bg-[#EDEFF2] shadow-sm'
                        : 'border-[#E5E7EB] bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <FileSpreadsheet className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-zinc-800' : 'text-zinc-400'}`} />
                        <span className="text-[11px] font-bold text-zinc-800 truncate block" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                        title="Delete source file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-zinc-100/60">
                      <span className="text-[9px] font-mono text-zinc-500 font-medium">
                        {file.rows.length} {t('rows')}
                      </span>
                      
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 shadow-sm">
                        <Check className="h-2.5 w-2.5 stroke-[3px] text-emerald-600 animate-pulse" /> {t('active')}: {mmo}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected File Active Mapping & Interactive Rows Grid */}
        {activeFile ? (
          <div className="flex-1 flex flex-col min-h-[220px] space-y-2 pt-2 border-t border-dashed border-[#D1D5DB]">
            <div className="flex items-center justify-between text-zinc-800 bg-[#F1F3F5] px-2 py-1 rounded border border-[#D1D5DB] shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-600" />
                <span>{locale === 'th' ? 'กำลังกำหนดค่าไฟล์' : 'Configuring File'}: {activeFile.name}</span>
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                {activeFile.rows.length} {t('rows')}
              </span>
            </div>

            {/* Column Mapping for Active File */}
            {fileSheets[activeFile.id] && fileSheets[activeFile.id].headers.length > 0 && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded space-y-1.5 text-xs shrink-0">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold uppercase tracking-wider text-[9px]">
                  <Sparkles className="h-3 w-3 text-amber-600" />
                  <span>{t('column_mapping')}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-0.5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-amber-800">{t('map_pn')}</label>
                    <select
                      value={pnColIndex}
                      onChange={(e) => handleMappingChange('pn', Number(e.target.value))}
                      className="w-full p-1 bg-white border border-amber-300 rounded text-[10px] text-zinc-700 focus:outline-none"
                    >
                      {fileSheets[activeFile.id].headers.map((header, idx) => (
                        <option key={idx} value={idx}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-amber-800">{t('map_desc')}</label>
                    <select
                      value={nameColIndex}
                      onChange={(e) => handleMappingChange('name', Number(e.target.value))}
                      className="w-full p-1 bg-white border border-amber-300 rounded text-[10px] text-zinc-700 focus:outline-none"
                    >
                      <option value={-1}>-- {locale === 'th' ? 'ไม่มี' : 'None'} --</option>
                      {fileSheets[activeFile.id].headers.map((header, idx) => (
                        <option key={idx} value={idx}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-amber-800">{t('map_qty')}</label>
                    <select
                      value={qtyColIndex}
                      onChange={(e) => handleMappingChange('qty', Number(e.target.value))}
                      className="w-full p-1 bg-white border border-amber-300 rounded text-[10px] text-zinc-700 focus:outline-none"
                    >
                      {fileSheets[activeFile.id].headers.map((header, idx) => (
                        <option key={idx} value={idx}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-amber-800">{t('map_mmo')}</label>
                    <select
                      value={mmoColIndex}
                      onChange={(e) => handleMappingChange('mmo', Number(e.target.value))}
                      className="w-full p-1 bg-white border border-amber-300 rounded text-[10px] text-zinc-700 focus:outline-none"
                    >
                      {fileSheets[activeFile.id].headers.map((header, idx) => (
                        <option key={idx} value={idx}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Editable spreadsheet table for active file */}
            <div className="flex-1 flex flex-col min-h-[140px]">
              <div className="flex justify-between items-center mb-1 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">{locale === 'th' ? 'เครื่องมือแก้ไขแถวข้อมูล' : 'Active Rows Editor'}</span>
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1A1C1E] border border-[#1A1C1E] rounded hover:bg-[#F1F3F5] transition-all cursor-pointer"
                  id="add-row-btn"
                >
                  <Plus className="h-2.5 w-2.5" /> {locale === 'th' ? 'เพิ่มแถว' : 'Add Row'}
                </button>
              </div>

              <div className="border border-[#D1D5DB] rounded overflow-hidden flex-1 flex flex-col bg-[#F8F9FA]">
                <div className="grid grid-cols-[1.2fr_1.5fr_0.8fr_1.2fr_30px] gap-2 px-2.5 py-1.5 bg-[#EDEFF2] border-b border-[#D1D5DB] text-left text-[10px] font-bold text-[#4B5563] uppercase tracking-wider shrink-0">
                  <div>{t('map_pn')}</div>
                  <div>{t('map_desc')}</div>
                  <div>{t('map_qty')}</div>
                  <div>{t('map_mmo')}</div>
                  <div className="text-center">{locale === 'th' ? 'ลบ' : 'Del'}</div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#D1D5DB] bg-white max-h-[180px]">
                  {activeFile.rows.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-[#9CA3AF] flex flex-col items-center justify-center gap-1">
                      <FileSpreadsheet className="h-6 w-6 text-[#9CA3AF]" />
                      <p className="font-bold text-[#4B5563] uppercase text-[10px] tracking-wider">{locale === 'th' ? 'ไม่มีแถวในไฟล์นี้' : 'No rows in this file'}</p>
                      <p className="text-[9px]">{locale === 'th' ? 'คลิก "เพิ่มแถว" ด้านบนเพื่อเพิ่มข้อมูลด้วยตนเอง' : 'Click "Add Row" above to insert data manually.'}</p>
                    </div>
                  ) : (
                    activeFile.rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.2fr_1.5fr_0.8fr_1.2fr_30px] gap-2 px-2.5 py-1 items-center hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div>
                          <input
                            type="text"
                            value={row.PN}
                            onChange={(e) => handleUpdateRow(row.id, 'PN', e.target.value)}
                            placeholder="e.g. 73DIFF..."
                            className="w-full px-1.5 py-0.5 text-[11px] bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-[#D1D5DB] rounded focus:outline-none font-mono text-[#1F2937]"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={row.PartName || ''}
                            onChange={(e) => handleUpdateRow(row.id, 'PartName', e.target.value)}
                            placeholder="e.g. NAND IC"
                            className="w-full px-1.5 py-0.5 text-[11px] bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-[#D1D5DB] rounded focus:outline-none font-sans text-zinc-600 truncate"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={row.rawShortQty !== undefined ? row.rawShortQty : row.ShortQty}
                            onChange={(e) => handleUpdateRow(row.id, 'ShortQty', e.target.value)}
                            placeholder="Qty"
                            className="w-full px-1.5 py-0.5 text-[11px] bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-[#D1D5DB] rounded focus:outline-none font-mono text-zinc-800 font-bold"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={row.MMO}
                            onChange={(e) => handleUpdateRow(row.id, 'MMO', e.target.value)}
                            placeholder="e.g. MMOB-260..."
                            className="w-full px-1.5 py-0.5 text-[11px] bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-[#D1D5DB] rounded focus:outline-none font-mono text-[#1F2937]"
                          />
                        </div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 border border-dashed border-[#D1D5DB] rounded bg-[#F8F9FA] text-center flex flex-col items-center justify-center gap-1.5">
            <FileSpreadsheet className="h-8 w-8 text-zinc-300 animate-pulse" />
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{locale === 'th' ? 'ไม่พบแหล่งข้อมูลของขาดจาก Excel' : 'No Excel Shortage Sources Loaded'}</p>
            <p className="text-[10px] text-zinc-400 max-w-[280px]">
              {locale === 'th'
                ? 'ลากและวางไฟล์ Excel, วางข้อมูลข้อความ หรือคลิก "ข้อมูลตัวอย่าง" ด้านบนเพื่อจำลองยอดของขาด!'
                : 'Drag and drop excel files, paste text data, or click "Demo Data" at the top to load simulation shortages!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

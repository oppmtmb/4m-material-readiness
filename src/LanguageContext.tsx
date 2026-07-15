import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Locale = 'th' | 'en';

export interface Translations {
  [key: string]: {
    th: string;
    en: string;
  };
}

export const translations: Translations = {
  // Header & Global
  header_title: {
    th: 'เครื่องมือกระทบยอดและวิเคราะห์ข้อมูล SHORTAGE',
    en: 'RECONCILIATION ANALYTICS TOOL'
  },
  header_subtitle: {
    th: 'ระบบจับคู่ตรวจสอบรายการของขาดระหว่าง EXCEL และ อีเมล',
    en: 'Excel shortage vs Email shortage matching engine'
  },
  case_sensitive: {
    th: 'ตัวพิมพ์เล็ก-ใหญ่ตรงกัน',
    en: 'CASE-SENSITIVE'
  },
  demo_data: {
    th: 'ชุดข้อมูลตัวอย่าง',
    en: 'DEMO DATA'
  },
  footer_text: {
    th: 'ระบบเปรียบเทียบข้อมูล Shortage • รายงานกระทบยอดความละเอียดสูงฝ่ายจัดซื้อจัดจ้าง',
    en: 'Shortage Comparator Engine • High Density Procurement reconciliation report'
  },

  // Decisions formula Matrix
  decision_matrix: {
    th: 'สูตรและตรรกะการวิเคราะห์ข้อมูล',
    en: 'Decisions formula Matrix'
  },
  comparison_rule_set: {
    th: 'ตารางวิเคราะห์ความสอดคล้องของข้อมูล',
    en: 'Comparison rule-set logic'
  },
  need_to_check: {
    th: 'ต้องตรวจสอบ (Need to Check)',
    en: 'Need to Check'
  },
  need_to_check_desc: {
    th: 'PN อยู่ใน Email + อยู่ใน Excel + ยอด Short > 0',
    en: 'PN in email + in Excel + Short > 0'
  },
  status_2nd: {
    th: 'ขาดแคลนเฉพาะใน Email (2nd)',
    en: '2nd'
  },
  status_2nd_desc: {
    th: 'PN อยู่ใน Email แต่ไม่อยู่ใน Excel (0 PN)',
    en: 'PN in email but not in Excel'
  },
  status_good: {
    th: 'ปกติ (Good/NR)',
    en: 'Good/NR'
  },
  status_good_desc: {
    th: 'อื่นๆ (เช่น ไม่อยู่ใน Email หรือยอด Short <= 0)',
    en: 'Others (e.g. not in email or ShortQty <= 0)'
  },

  // Excel Input
  excel_source: {
    th: '1. แหล่งข้อมูล: รายการของขาดจาก EXCEL',
    en: '1. SOURCE: EXCEL SHORTAGE'
  },
  excel_sub: {
    th: 'จับคู่คอลัมน์ข้อมูล PN, SHORTQTY, MMO',
    en: 'PN, SHORTQTY, MMO FIELDS'
  },
  excel_paste: {
    th: 'วางแถวข้อมูลจากคลิปบอร์ด',
    en: 'PASTE ROWS TO CREATE NEW SOURCE'
  },
  excel_upload: {
    th: 'อัปโหลดไฟล์รายการของขาด (รองรับหลายไฟล์)',
    en: 'UPLOAD SHORTAGE FILES (SUPPORTS MULTIPLE)'
  },
  excel_upload_sub: {
    th: 'อัปโหลดไฟล์ EXCEL / CSV',
    en: 'UPLOAD EXCEL / CSV FILES'
  },
  excel_drag_drop: {
    th: 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์',
    en: 'Drop multiple files or click to browse'
  },
  excel_manage: {
    th: 'จัดการแหล่งข้อมูล',
    en: 'MANAGE SOURCES'
  },
  clear_all: {
    th: 'ล้างข้อมูลทั้งหมด',
    en: 'CLEAR ALL'
  },
  rows: {
    th: 'แถว',
    en: 'rows'
  },
  active: {
    th: 'กำลังใช้งาน',
    en: 'Active'
  },
  discarded: {
    th: 'ไม่ได้ใช้งาน',
    en: 'Discarded'
  },
  paste_text_placeholder: {
    th: 'วางข้อมูลแถวจาก Excel คัดลอกแบบมีหัวตาราง (Tab-delimited)... เช่น\nPN\tShortQty\tMMO',
    en: 'Paste spreadsheet rows here (with headers)... e.g.\nPN\tShortQty\tMMO'
  },
  parse_rows_btn: {
    th: 'ประมวลผลและเพิ่มข้อมูล',
    en: 'Parse & Add Pasted Rows'
  },
  column_mapping: {
    th: 'การจับคู่คอลัมน์ข้อมูล (Column Mapping)',
    en: 'Interactive Column Mapping'
  },
  confirm_mapping: {
    th: 'ยืนยันและนำการจับคู่ไปใช้',
    en: 'CONFIRM & APPLY MAPPING'
  },
  map_pn: {
    th: 'รหัสพาร์ท (PN)',
    en: 'Part Number (PN)'
  },
  map_qty: {
    th: 'จำนวนที่ขาด (ShortQty)',
    en: 'Short Qty'
  },
  map_mmo: {
    th: 'รหัสใบสั่งงาน (MMO)',
    en: 'MMO'
  },
  map_desc: {
    th: 'รายละเอียดพาร์ท (Part Description)',
    en: 'Part Description'
  },
  source_file: {
    th: 'ไฟล์ต้นทาง:',
    en: 'Source File:'
  },
  data_rows_count: {
    th: 'จำนวนแถวทั้งหมดที่ดึงได้:',
    en: 'Total parsed rows:'
  },
  status_lbl: {
    th: 'สถานะ:',
    en: 'Status:'
  },
  invalid_file_type: {
    th: 'รูปแบบไฟล์ไม่รองรับ หรือโครงสร้างไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์ Excel (.xlsx, .xls) หรือ CSV',
    en: 'Invalid file or format. Please upload Excel (.xlsx, .xls) or text CSV'
  },

  // Email Input
  email_source: {
    th: '2. แหล่งข้อมูล: รายการของขาดจากอีเมล',
    en: '2. SOURCE: EMAIL SHORTAGE'
  },
  email_sub: {
    th: 'ดึงข้อมูลพาร์ทจากไฟล์ .MSG / .EML หรือวางข้อความโดยตรง',
    en: 'EXTRACT DIRECTLY FROM .MSG / .EML OR PASTE'
  },
  email_upload: {
    th: 'อัปโหลดไฟล์อีเมล (.MSG / .EML)',
    en: 'UPLOAD EMAIL FILES (.MSG / .EML)'
  },
  email_drag_drop: {
    th: 'ลากไฟล์ .msg / .eml มาวาง หรือคลิกเพื่อค้นหาไฟล์',
    en: 'Drop .msg / .eml files or click to browse'
  },
  email_manage: {
    th: 'จัดการรายการอีเมล',
    en: 'MANAGE EMAILS'
  },
  extracted_mmos: {
    th: 'รหัส MMO ที่พบในอีเมล',
    en: 'EXTRACTED MMO CODES'
  },
  extracted_pns: {
    th: 'รหัสพาร์ท (PN) ที่พบในอีเมล',
    en: 'EXTRACTED PART NUMBERS'
  },
  no_mmos: {
    th: 'ไม่พบรหัส MMO ในเนื้อหาอีเมลปัจจุบัน',
    en: 'No MMO codes found in current email data'
  },
  no_pns: {
    th: 'ไม่พบรหัสพาร์ท (PN) ในเนื้อหาอีเมลปัจจุบัน',
    en: 'No Part Numbers found in current email data'
  },
  paste_email_pns: {
    th: 'หรือแก้ไขรหัสพาร์ทในอีเมล (คั่นด้วยบรรทัดใหม่หรือจุลภาค)...',
    en: 'Or Paste/Edit Email PNs (newline or comma separated)...'
  },
  paste_email_mmos: {
    th: 'หรือแก้ไขรหัส MMO ในอีเมล (คั่นด้วยบรรทัดใหม่หรือจุลภาค)...',
    en: 'Or Paste/Edit Email MMOs (newline or comma separated)...'
  },
  error_reading_email: {
    th: 'ล้มเหลวในการอ่านข้อมูลไฟล์อีเมล กรุณาตรวจสอบว่าเป็นไฟล์ .msg หรือ .eml ที่ถูกต้อง',
    en: 'Failed to read email file. Make sure it is a valid .msg or .eml file.'
  },

  // Results Display
  results_title: {
    th: '3. ผลลัพธ์และรายงานการตรวจสอบกระทบยอด',
    en: '3. MATCHING ENGINE RESULTS & REPORTS'
  },
  results_sub: {
    th: 'ระบบตรวจสอบกระทบยอดความสอดคล้องความหนาแน่นสูง',
    en: 'HIGH DENSITY RECONCILIATION AUDIT'
  },
  search_placeholder: {
    th: 'ค้นหาด้วยรหัสพาร์ท (PN), MMO หรือรายละเอียดพาร์ท...',
    en: 'Search by PN / MMO / Part Description...'
  },
  filter_status: {
    th: 'กรองสถานะ:',
    en: 'Filter by Status:'
  },
  status_all: {
    th: 'ทุกสถานะ',
    en: 'All Statuses'
  },
  view_db: {
    th: 'ตารางข้อมูลดิบ (Database View)',
    en: 'Database View'
  },
  view_report: {
    th: 'สไลด์รายงานผู้บริหาร (Summary Slide)',
    en: 'Executive Summary Slide Report'
  },
  summary_overview: {
    th: 'สรุปข้อมูลภาพรวม',
    en: 'Summary Overview'
  },
  export_pdf: {
    th: 'ส่งออกรายงานสรุป (PDF)',
    en: 'EXPORT RECONCILIATION REPORT (PDF)'
  },
  generating_pdf: {
    th: 'กำลังสร้างรายงาน...',
    en: 'Generating...'
  },
  report_editor: {
    th: 'ปรับแต่งเนื้อหาของสไลด์รายงาน',
    en: 'Report Slide Configuration'
  },
  slide_title_lbl: {
    th: 'หัวข้อสไลด์:',
    en: 'Slide Title:'
  },
  bom_ref_lbl: {
    th: 'รหัสอ้างอิง BOM / MMO:',
    en: 'BOM Ref / MMO Code:'
  },
  period_lbl: {
    th: 'ระยะเวลาวิเคราะห์:',
    en: 'Period Covered:'
  },
  date_lbl: {
    th: 'วันที่ออกรายงาน:',
    en: 'Report Date:'
  },
  findings_lbl: {
    th: 'ข้อมูลสำคัญผู้บริหาร (Bullet 1-3):',
    en: 'Executive Findings (Bullet 1-3):'
  },
  status_breakdown: {
    th: 'สัดส่วนสถานะการตรวจสอบ',
    en: 'STATUS BREAKDOWN'
  },
  total_reconciled: {
    th: 'รายการตรวจสอบกระทบยอดรวม',
    en: 'TOTAL RECONCILED RECORDS'
  },
  no_records: {
    th: 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหาของคุณ',
    en: 'No matched records found matching your filters.'
  },
  showing_records: {
    th: 'แสดงข้อมูล',
    en: 'Showing'
  },
  of_records: {
    th: 'จากทั้งหมด',
    en: 'of'
  },
  items: {
    th: 'รายการ',
    en: 'items'
  },
  col_pn: {
    th: 'รหัสพาร์ท (PART NUMBER)',
    en: 'PART NUMBER'
  },
  col_description: {
    th: 'รายละเอียดชิ้นส่วน (PART DESCRIPTION)',
    en: 'PART DESCRIPTION'
  },
  col_short_qty: {
    th: 'ยอดของขาด (SHORT QTY)',
    en: 'SHORT QTY'
  },
  col_mmo: {
    th: 'รหัสใบสั่งงาน (MMO)',
    en: 'MMO CODE'
  },
  col_status: {
    th: 'สถานะการจับคู่ (STATUS)',
    en: 'STATUS'
  },
  col_actions: {
    th: 'จัดการ (ACTIONS)',
    en: 'ACTIONS'
  },
  not_reported: {
    th: 'ไม่ได้ระบุ',
    en: 'Not reported'
  },
  readiness_summary: {
    th: 'สรุปความพร้อมชิ้นส่วน',
    en: 'Material Readiness Summary'
  },
  pushed_back_alert: {
    th: 'แผนการผลิตเลื่อนออกไปเนื่องจากของขาด',
    en: 'Delivery unconfirmed, plan pushed back'
  },
  active_mmo_group: {
    th: 'กลุ่มข้อมูล MMO:',
    en: 'MMO Group:'
  },
  unknown_mmo: {
    th: 'ใบสั่งงานอื่น/ไม่ระบุ (Unknown MMO)',
    en: 'Unknown MMO'
  },
  unassociated_pns: {
    th: 'พาร์ทอื่นที่ไม่ได้จับคู่ (Unmapped PNs)',
    en: 'Unmapped PNs'
  }
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('th'); // Default to Thai as requested ("ทำหน้าเว็บนี้ให้เป็น 2 ภาษา ไทย กับ อังกฤษ")

  const t = (key: string): string => {
    const item = translations[key];
    if (!item) return key;
    return item[locale] || item['en'] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

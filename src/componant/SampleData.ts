import { ExcelRow, EmailData } from '../types';

export const SAMPLE_EXCEL_ROWS: ExcelRow[] = [
  { 
    id: '1', 
    PN: '73DIFF0001C0644', 
    ShortQty: 34, 
    MMO: 'MMOB-2606000091', 
    PartName: 'NAND IC,SDWFR-1T00B53IEC,TLC,8DIE,4CE,2CH,LONGSYS' 
  }, // MMO in email, e=true, m=true -> "1st"
  { 
    id: '2', 
    PN: '2120000023H1', 
    ShortQty: 1428, 
    MMO: 'MMOB-2606000091', 
    PartName: 'SOLDERING PASTE, SAC8903, SN-3.0AG-0.5CU' 
  }, // MMO in email, e=true, m=false -> "2nd" (normally 2nd, but in high-level report merged)
  { 
    id: '3', 
    PN: '2210000010H1', 
    ShortQty: 0, 
    MMO: 'MMOB-2606000091', 
    PartName: 'BOMDING ADHESIVE,SEALING MATERIAL,UNDERFILL' 
  }, // MMO in email, e=false, m=false -> "Good"
  { 
    id: '4', 
    PN: '2450000034M0', 
    ShortQty: 0, 
    MMO: 'MMOB-2606000091', 
    PartName: 'CARBON BELT,RIBBON B110CR(55MM*300M) BLACK' 
  }, // MMO in email, e=false, m=false -> "Good"
  { 
    id: '5', 
    PN: '6095001275AH0', 
    ShortQty: 1, 
    MMO: 'MMOB-2606000091', 
    PartName: 'LABEL,SAFETY,CSZ, [GENERAL] REV:A(HF)' 
  },
  { 
    id: '6', 
    PN: '6095002944AH0', 
    ShortQty: 17, 
    MMO: 'MMOB-2606000091', 
    PartName: 'LABEL,PCBA(FOR SMT),WHITE 40MM*8MM, MAT\'L:WHITE PET' 
  },
  { 
    id: '7', 
    PN: '6095003586AH0', 
    ShortQty: 18, 
    MMO: 'MMOB-2606000091', 
    PartName: 'LABEL,GREEN PCBA LABEL FOR SINGLE LINE FOR SMT' 
  },
  { 
    id: '8', 
    PN: '710A00040C0H1', 
    ShortQty: 17, 
    MMO: 'MMOB-2606000091', 
    PartName: 'ANALOG IC,2.7-22V,0.7-5A,CURRENT LIMIT SWITCH' 
  },
  { 
    id: '9', 
    PN: '710A0020190H1', 
    ShortQty: 51, 
    MMO: 'MMOB-2606000091', 
    PartName: 'ANALOG IC,ACTIVE,DC TO DC 5.5V/2A 2.4MHZ SOT-563' 
  },
  { 
    id: '10', 
    PN: '710A0020390H1', 
    ShortQty: 17, 
    MMO: 'MMOB-2606000091', 
    PartName: 'ANALOG IC, REGULATOR 3.3V 0.3A, DFN4 1X1MM' 
  },
  // Add some other randomized parts to make total around 53 parts to match screenshot perfectly!
  ...Array.from({ length: 43 }).map((_, idx) => {
    const pnNum = 8000000000 + idx;
    return {
      id: `rand-${idx}`,
      PN: `${pnNum}H1`,
      ShortQty: Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0,
      MMO: 'MMOB-2606000091',
      PartName: `GENERAL SMT CAPACITOR / RESISTOR ELEMENT TYPE-${idx + 1}`
    };
  })
];

export const SAMPLE_EMAIL_DATA: EmailData = {
  pns: ['73DIFF0001C0644'], // only the critical one is in the email shortage
  mmos: ['MMOB-2606000091'],
  rawPns: '73DIFF0001C0644',
  rawMmos: 'MMOB-2606000091',
};

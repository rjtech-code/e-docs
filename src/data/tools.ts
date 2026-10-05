import {
  Combine, Scissors, Minimize2, FileText, Presentation, Sheet,
  FileEdit, Image, PenTool, Stamp, RotateCw, Code2, Unlock, Lock,
  ListOrdered, ShieldCheck, Wrench, Hash, ScanLine, ScanText, GitCompareArrows,
  EyeOff, Crop, FileType2, FileSpreadsheet, FileImage, Languages,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ToolCategory = 'organize' | 'convert' | 'edit' | 'security' | 'translate'

export interface ToolDef {
  id: string
  path: string
  name: string
  short: string
  description: string
  icon: LucideIcon
  category: ToolCategory
  color: 'pink' | 'blue'
}

export const tools: ToolDef[] = [
  { id: 'merge-pdf', path: '/merge-pdf', name: 'Merge PDF', short: 'Combine PDFs', description: 'Combine PDFs in the order you want with the easiest PDF merger available.', icon: Combine, category: 'organize', color: 'pink' },
  { id: 'split-pdf', path: '/split-pdf', name: 'Split PDF', short: 'Split by pages', description: 'Separate one page or a whole set for easy conversion into independent PDF files.', icon: Scissors, category: 'organize', color: 'blue' },
  { id: 'compress-pdf', path: '/compress-pdf', name: 'Compress PDF', short: 'Reduce file size', description: 'Reduce file size while optimizing for maximal PDF quality.', icon: Minimize2, category: 'organize', color: 'pink' },
  { id: 'pdf-to-word', path: '/pdf-to-word', name: 'PDF to Word', short: 'PDF → DOCX', description: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.', icon: FileText, category: 'convert', color: 'blue' },
  { id: 'pdf-to-powerpoint', path: '/pdf-to-powerpoint', name: 'PDF to PowerPoint', short: 'PDF → PPTX', description: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.', icon: Presentation, category: 'convert', color: 'pink' },
  { id: 'pdf-to-excel', path: '/pdf-to-excel', name: 'PDF to Excel', short: 'PDF → XLSX', description: 'Pull data straight from PDFs into Excel spreadsheets in seconds.', icon: Sheet, category: 'convert', color: 'blue' },
  { id: 'word-to-pdf', path: '/word-to-pdf', name: 'Word to PDF', short: 'DOCX → PDF', description: 'Make DOC and DOCX files easy to read by converting them to PDF.', icon: FileType2, category: 'convert', color: 'pink' },
  { id: 'powerpoint-to-pdf', path: '/powerpoint-to-pdf', name: 'PowerPoint to PDF', short: 'PPTX → PDF', description: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.', icon: FileImage, category: 'convert', color: 'blue' },
  { id: 'excel-to-pdf', path: '/excel-to-pdf', name: 'Excel to PDF', short: 'XLSX → PDF', description: 'Make Excel spreadsheets easy to read by converting them to PDF.', icon: FileSpreadsheet, category: 'convert', color: 'pink' },
  { id: 'edit-pdf', path: '/edit-pdf', name: 'Edit PDF', short: 'Add text & shapes', description: 'Add text, shapes and freehand annotations to your PDF document.', icon: FileEdit, category: 'edit', color: 'blue' },
  { id: 'pdf-to-jpg', path: '/pdf-to-jpg', name: 'PDF to JPG', short: 'Pages → images', description: 'Convert each PDF page into a JPG or extract all embedded images.', icon: Image, category: 'convert', color: 'pink' },
  { id: 'jpg-to-pdf', path: '/jpg-to-pdf', name: 'JPG to PDF', short: 'Images → PDF', description: 'Convert JPG, PNG and other images to PDF in seconds.', icon: FileImage, category: 'convert', color: 'blue' },
  { id: 'sign-pdf', path: '/sign-pdf', name: 'Sign PDF', short: 'Draw signature', description: 'Sign yourself or request electronic signatures from others.', icon: PenTool, category: 'edit', color: 'pink' },
  { id: 'watermark-pdf', path: '/watermark-pdf', name: 'Watermark', short: 'Stamp text/image', description: 'Stamp an image or text over your PDF in seconds.', icon: Stamp, category: 'edit', color: 'blue' },
  { id: 'rotate-pdf', path: '/rotate-pdf', name: 'Rotate PDF', short: 'Rotate pages', description: 'Rotate one or many pages of your PDF, permanently and for free.', icon: RotateCw, category: 'organize', color: 'pink' },
  { id: 'html-to-pdf', path: '/html-to-pdf', name: 'HTML to PDF', short: 'Web/text → PDF', description: 'Convert HTML or plain text content into a PDF document.', icon: Code2, category: 'convert', color: 'blue' },
  { id: 'unlock-pdf', path: '/unlock-pdf', name: 'Unlock PDF', short: 'Remove password', description: 'Remove PDF password security so you can use it freely.', icon: Unlock, category: 'security', color: 'pink' },
  { id: 'protect-pdf', path: '/protect-pdf', name: 'Protect PDF', short: 'Add password', description: 'Protect PDF files with a password to keep them confidential.', icon: Lock, category: 'security', color: 'blue' },
  { id: 'organize-pdf', path: '/organize-pdf', name: 'Organize PDF', short: 'Reorder & delete', description: 'Sort, add, delete and rotate pages of your PDF file.', icon: ListOrdered, category: 'organize', color: 'pink' },
  { id: 'pdf-to-pdfa', path: '/pdf-to-pdfa', name: 'PDF to PDF/A', short: 'Archival format', description: 'Transform your PDF into the ISO-standardized PDF/A archival format.', icon: ShieldCheck, category: 'convert', color: 'blue' },
  { id: 'repair-pdf', path: '/repair-pdf', name: 'Repair PDF', short: 'Fix corrupt files', description: 'Repair a damaged PDF and recover data from a corrupt file.', icon: Wrench, category: 'organize', color: 'pink' },
  { id: 'page-numbers', path: '/page-numbers', name: 'Page Numbers', short: 'Add numbering', description: 'Add page numbers into your PDF with custom position and style.', icon: Hash, category: 'edit', color: 'blue' },
  { id: 'scan-to-pdf', path: '/scan-to-pdf', name: 'Scan to PDF', short: 'Camera → PDF', description: 'Capture photos with your camera and turn them into a clean PDF.', icon: ScanLine, category: 'convert', color: 'pink' },
  { id: 'ocr-pdf', path: '/ocr-pdf', name: 'OCR PDF', short: 'Extract text', description: 'Recognize text inside scanned PDFs and make it selectable & searchable.', icon: ScanText, category: 'edit', color: 'blue' },
  { id: 'compare-pdf', path: '/compare-pdf', name: 'Compare PDF', short: 'Diff two files', description: 'Spot the differences between two PDF files line by line.', icon: GitCompareArrows, category: 'edit', color: 'pink' },
  { id: 'redact-pdf', path: '/redact-pdf', name: 'Redact PDF', short: 'Black out content', description: 'Permanently black out sensitive text and graphics in a PDF.', icon: EyeOff, category: 'security', color: 'blue' },
  { id: 'crop-pdf', path: '/crop-pdf', name: 'Crop PDF', short: 'Trim margins', description: 'Crop the margins or select an area of your PDF pages.', icon: Crop, category: 'organize', color: 'pink' },
  { id: 'translate', path: '/translate', name: 'Translate', short: 'Hindi ↔ English +', description: 'Translate text, PDF, Word and TXT files between Hindi, English and 9 more Indian languages.', icon: Languages, category: 'translate', color: 'blue' },
]

export const categoryLabels: Record<ToolCategory, string> = {
  organize: 'Organize PDF',
  convert: 'Convert PDF',
  edit: 'Edit & Sign',
  security: 'PDF Security',
  translate: 'Translate',
}

export function getToolById(id: string) {
  return tools.find((t) => t.id === id)
}

import * as pdfjsLib from 'pdfjs-dist'
// Vite: import the worker as a URL and point pdf.js at it.
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjsLib }

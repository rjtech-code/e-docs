import { useCallback, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { UploadCloud, FileText, X, Lock } from 'lucide-react'
import { formatBytes } from '../lib/pdfCore'

interface FileDropProps {
  accept?: string
  multiple?: boolean
  files: File[]
  onFiles: (files: File[]) => void
  label?: string
  hint?: string
}

export default function FileDrop({ accept, multiple = false, files, onFiles, label, hint }: FileDropProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming)
      onFiles(multiple ? [...files, ...list] : list.slice(0, 1))
    },
    [files, multiple, onFiles],
  )
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label ?? 'Drop your files here'} — or press Enter to browse`}
        className={`dropzone ${dragging ? 'dragging' : ''} flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:py-12`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKey}
      >
        <span className="mb-1 grid h-16 w-16 place-items-center rounded-2xl bg-white text-primary shadow-sm">
          <UploadCloud size={32} strokeWidth={1.7} />
        </span>
        <p className="font-display text-lg font-semibold">{label ?? 'Drop your documents here'}</p>
        <p className="text-sm text-muted-foreground">Drag & drop, or</p>
        <span className="btn-primary mt-1 inline-block rounded-xl px-7 py-2.5 text-sm">Browse file{multiple ? 's' : ''}</span>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} className="text-success" /> {hint ?? 'Files stay on your device — nothing is uploaded'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Selected files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex animate-fade-in items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><FileText size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, j) => j !== i)) }} className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive" aria-label={`Remove ${f.name}`}>
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

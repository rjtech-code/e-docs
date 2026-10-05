import { useState } from 'react'
import { GitCompareArrows } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner } from '../../components/ToolShell'
import { extractPageText, loadPdfJs, readFileAsArrayBuffer } from '../../lib/pdfCore'

type Status = 'idle' | 'processing' | 'done' | 'error'
type DiffOp = { type: 'same' | 'add' | 'remove'; line: string }

async function extractAllText(file: File): Promise<string[]> {
  const bytes = await readFileAsArrayBuffer(file)
  const doc = await loadPdfJs(bytes)
  const lines: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const text = await extractPageText(doc, i)
    lines.push(...text.split('\n'))
  }
  return lines
}

// Classic LCS-based line diff.
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', line: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', line: a[i] })
      i++
    } else {
      ops.push({ type: 'add', line: b[j] })
      j++
    }
  }
  while (i < n) {
    ops.push({ type: 'remove', line: a[i] })
    i++
  }
  while (j < m) {
    ops.push({ type: 'add', line: b[j] })
    j++
  }
  return ops
}

export default function ComparePdf() {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [ops, setOps] = useState<DiffOp[] | null>(null)
  const [stats, setStats] = useState({ added: 0, removed: 0 })

  const compare = async () => {
    if (!fileA || !fileB) return
    setStatus('processing')
    setError('')
    setOps(null)
    try {
      const [linesA, linesB] = await Promise.all([extractAllText(fileA), extractAllText(fileB)])
      if (linesA.length * linesB.length > 4_000_000) {
        throw new Error('too-large')
      }
      const diff = diffLines(linesA, linesB)
      setOps(diff)
      setStats({ added: diff.filter((d) => d.type === 'add').length, removed: diff.filter((d) => d.type === 'remove').length })
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error && e.message === 'too-large' ? 'These PDFs are too large to compare in the browser.' : 'Could not compare these PDFs.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={GitCompareArrows} title="Compare PDF" description="Spot text differences between two PDF files, line by line.">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground/80 mb-2">Original</p>
          <FileDrop accept="application/pdf" files={fileA ? [fileA] : []} onFiles={(f) => setFileA(f[0] ?? null)} label="Select PDF A" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground/80 mb-2">Compare with</p>
          <FileDrop accept="application/pdf" files={fileB ? [fileB] : []} onFiles={(f) => setFileB(f[0] ?? null)} label="Select PDF B" />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={compare} disabled={!fileA || !fileB || status === 'processing'}>
          {status === 'processing' ? 'Comparing…' : 'Compare PDFs'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Comparing text content…" errorText={error} />
      </div>

      {ops && (
        <div className="mt-8">
          <p className="text-center text-sm text-muted-foreground mb-3">
            <span className="text-emerald-700 font-semibold">+{stats.added} added</span> ·{' '}
            <span className="text-red-500 font-semibold">−{stats.removed} removed</span>
          </p>
          <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-surface font-mono text-xs">
            {ops.map((op, idx) => (
              <div
                key={idx}
                className={`px-4 py-1 whitespace-pre-wrap break-words ${
                  op.type === 'add' ? 'bg-emerald-50 text-emerald-800' : op.type === 'remove' ? 'bg-red-50 text-red-800' : 'text-muted-foreground'
                }`}
              >
                {op.type === 'add' ? '+ ' : op.type === 'remove' ? '− ' : '  '}
                {op.line || ' '}
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  )
}

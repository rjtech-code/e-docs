import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { Spinner } from './components/ToolShell'
import Home from './pages/Home'
import AllTools from './pages/AllTools'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AppHome from './pages/AppHome'
import History from './pages/History'
import SettingsPage from './pages/Settings'
import AdminPanel from './pages/AdminPanel'
import { ProtectedRoute } from './components/ProtectedRoute'

const MergePdf = lazy(() => import('./pages/tools/MergePdf'))
const SplitPdf = lazy(() => import('./pages/tools/SplitPdf'))
const CompressPdf = lazy(() => import('./pages/tools/CompressPdf'))
const PdfToWord = lazy(() => import('./pages/tools/PdfToWord'))
const PdfToPowerpoint = lazy(() => import('./pages/tools/PdfToPowerpoint'))
const PdfToExcel = lazy(() => import('./pages/tools/PdfToExcel'))
const WordToPdf = lazy(() => import('./pages/tools/WordToPdf'))
const PowerpointToPdf = lazy(() => import('./pages/tools/PowerpointToPdf'))
const ExcelToPdf = lazy(() => import('./pages/tools/ExcelToPdf'))
const EditPdf = lazy(() => import('./pages/tools/EditPdf'))
const PdfToJpg = lazy(() => import('./pages/tools/PdfToJpg'))
const JpgToPdf = lazy(() => import('./pages/tools/JpgToPdf'))
const SignPdf = lazy(() => import('./pages/tools/SignPdf'))
const WatermarkPdf = lazy(() => import('./pages/tools/WatermarkPdf'))
const RotatePdf = lazy(() => import('./pages/tools/RotatePdf'))
const HtmlToPdf = lazy(() => import('./pages/tools/HtmlToPdf'))
const UnlockPdf = lazy(() => import('./pages/tools/UnlockPdf'))
const ProtectPdf = lazy(() => import('./pages/tools/ProtectPdf'))
const OrganizePdf = lazy(() => import('./pages/tools/OrganizePdf'))
const PdfToPdfA = lazy(() => import('./pages/tools/PdfToPdfA'))
const RepairPdf = lazy(() => import('./pages/tools/RepairPdf'))
const PageNumbers = lazy(() => import('./pages/tools/PageNumbers'))
const ScanToPdf = lazy(() => import('./pages/tools/ScanToPdf'))
const OcrPdf = lazy(() => import('./pages/tools/OcrPdf'))
const ComparePdf = lazy(() => import('./pages/tools/ComparePdf'))
const RedactPdf = lazy(() => import('./pages/tools/RedactPdf'))
const CropPdf = lazy(() => import('./pages/tools/CropPdf'))
const Translate = lazy(() => import('./pages/tools/Translate'))

function Loading() {
  return (
    <div className="flex items-center justify-center py-32">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <AppShell>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/all-tools" element={<AllTools />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/home" element={<AppHome />} />
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/translate" element={<Translate />} />
            <Route path="/merge-pdf" element={<MergePdf />} />
            <Route path="/split-pdf" element={<SplitPdf />} />
            <Route path="/compress-pdf" element={<CompressPdf />} />
            <Route path="/pdf-to-word" element={<PdfToWord />} />
            <Route path="/pdf-to-powerpoint" element={<PdfToPowerpoint />} />
            <Route path="/pdf-to-excel" element={<PdfToExcel />} />
            <Route path="/word-to-pdf" element={<WordToPdf />} />
            <Route path="/powerpoint-to-pdf" element={<PowerpointToPdf />} />
            <Route path="/excel-to-pdf" element={<ExcelToPdf />} />
            <Route path="/edit-pdf" element={<EditPdf />} />
            <Route path="/pdf-to-jpg" element={<PdfToJpg />} />
            <Route path="/jpg-to-pdf" element={<JpgToPdf />} />
            <Route path="/sign-pdf" element={<SignPdf />} />
            <Route path="/watermark-pdf" element={<WatermarkPdf />} />
            <Route path="/rotate-pdf" element={<RotatePdf />} />
            <Route path="/html-to-pdf" element={<HtmlToPdf />} />
            <Route path="/unlock-pdf" element={<UnlockPdf />} />
            <Route path="/protect-pdf" element={<ProtectPdf />} />
            <Route path="/organize-pdf" element={<OrganizePdf />} />
            <Route path="/pdf-to-pdfa" element={<PdfToPdfA />} />
            <Route path="/repair-pdf" element={<RepairPdf />} />
            <Route path="/page-numbers" element={<PageNumbers />} />
            <Route path="/scan-to-pdf" element={<ScanToPdf />} />
            <Route path="/ocr-pdf" element={<OcrPdf />} />
            <Route path="/compare-pdf" element={<ComparePdf />} />
            <Route path="/redact-pdf" element={<RedactPdf />} />
            <Route path="/crop-pdf" element={<CropPdf />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
    </AppShell>
  )
}

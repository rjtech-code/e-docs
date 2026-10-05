import { Link } from 'react-router-dom'
import HeroDocs from '../components/HeroDocs'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl animate-fade-in py-12 text-center">
      <HeroDocs className="mx-auto mb-2 h-48 w-60" />
      <h1 className="gradient-text font-display text-7xl font-extrabold">404</h1>
      <p className="mb-8 mt-3 text-muted-foreground">We couldn't find that page. Let's get you back on track.</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/" className="btn-primary inline-block rounded-xl px-8 py-3">Back to home</Link>
        <Link to="/all-tools" className="btn-ghost inline-block rounded-xl px-8 py-3 font-semibold">Browse all tools</Link>
      </div>
    </div>
  )
}

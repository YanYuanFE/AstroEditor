import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route } from 'react-router-dom'
import { StarknetProvider } from '@/components/StarkProvider'
import { Toaster } from 'sonner'
import EditorPage from '@/pages/Editor'
import LandingPage from '@/pages/Landing'
import { GlobalDialogs } from '@/components/GlobalDialogs'

const queryClient = new QueryClient()

export default function App() {
  return (
    <StarknetProvider>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/editor" element={
            <div className="h-dvh flex overflow-hidden">
              <EditorPage />
            </div>
          } />
        </Routes>
        <GlobalDialogs />
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </StarknetProvider>
  )
}

import { BrowserRouter, Route, Routes } from 'react-router-dom'

function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-primary">SpellKick</h1>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

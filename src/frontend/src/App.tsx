import { useEffect, useState } from 'react'
import { api } from './api/client'

function App() {
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api.get('/health').then(setHealth).catch(() => setHealth({ ok: false }))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>VisiControl</h1>
      <p>Gestión de visitas penitenciarias</p>
      <h2 style={{ marginTop: 24 }}>API Health</h2>
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </div>
  )
}
export default App



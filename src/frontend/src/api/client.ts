const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const api = {
  async get(path: string) {
    const r = await fetch(`${BASE}${path}`)
    return r.json()
  },
  async post(path: string, body: any, token?: string) {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    return r.json()
  }
}


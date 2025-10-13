import jwt from 'jsonwebtoken'

function parseAuthHeader (req:any) {
  const h = req.headers.authorization || ''
  const [, token] = h.split(' ')
  return token
}
function verifyToken (token:string) {
  try { return jwt.verify(token, process.env.JWT_SECRET || ''); } catch { return null }
}
const auth = {
  required: (req:any, res:any, next:any) => {
    const token = parseAuthHeader(req)
    const user = token ? verifyToken(token) : null
    if (!user) return res.status(401).json({ ok:false, message:'Unauthorized' })
    req.user = user
    next()
  },
  optional: (req:any, _res:any, next:any) => {
    const token = parseAuthHeader(req)
    const user = token ? verifyToken(token) : null
    if (user) req.user = user
    next()
  }
}
export default auth

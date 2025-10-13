import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import routes from './routes'

dotenv.config()
const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }))
app.use(express.json())

app.use('/api', routes)

app.use((_req, res) => res.status(404).json({ ok:false, message:'Not Found' }))
export default app

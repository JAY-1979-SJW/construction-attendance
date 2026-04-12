import Fastify from 'fastify'
import { materialsRoutes } from './routes/materials'

const app = Fastify({ logger: true })

// health
app.get('/api/health', async () => ({
  status: 'ok',
  service: 'material-api',
}))

app.register(materialsRoutes, { prefix: '/api' })

const port = parseInt(process.env.PORT ?? '3020')

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`material-api listening on port ${port}`)
})

import { serve } from '@hono/node-server'
import app from './index'
import { LocalKVNamespace } from './localKV'

// Local environment bindings
const localEnv = {
  timelimit: new LocalKVNamespace(),
}

const port = 8111

console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: (request) => app.fetch(request, localEnv),
  port,
})
import type { NextConfig } from 'next'
const config: NextConfig = {
  basePath: '/flappy-bird',
  serverExternalPackages: ['@electric-sql/pglite']
}
export default config

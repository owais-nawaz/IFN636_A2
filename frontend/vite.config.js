import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5001,
    allowedHosts: [
      'bugtracking-1405297277.ap-southeast-2.elb.amazonaws.com',
      '.elb.amazonaws.com',
    ],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    port: 5001,
    allowedHosts: [
      'bugtracking-1405297277.ap-southeast-2.elb.amazonaws.com',
      '.elb.amazonaws.com',
    ],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})


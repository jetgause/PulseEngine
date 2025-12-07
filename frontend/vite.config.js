import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
<<<<<<< HEAD
import path from 'path'

=======

// https://vitejs.dev/config/
>>>>>>> main
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
<<<<<<< HEAD
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
=======
>>>>>>> main
  }
})

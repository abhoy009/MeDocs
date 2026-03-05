import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-quill': ['quill', 'quill-cursors'],
          'vendor-yjs': ['yjs', 'y-quill', 'y-protocols'],
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
  },
})

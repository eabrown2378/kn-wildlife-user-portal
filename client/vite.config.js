import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      cert: "/home/ebrown23/kn-wildlife_crc_nd_edu.cer",
      key: "/home/ebrown23/kn-wildlife.crc.nd.edu.key"
    }
  }
});

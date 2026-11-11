import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.saldo.financas',
  appName: 'Saldo',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    Camera: { presentationStyle: 'popover' },
  },
}

export default config

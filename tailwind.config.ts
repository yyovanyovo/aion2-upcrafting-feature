import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f1115',
        surface: {
          DEFAULT: '#181b20',
          hover: '#1e2229',
          card: '#181b20',
          panel: '#181b20',
        },
        border: {
          subtle: '#262930',
          DEFAULT: '#262930',
        },
        dark: {
          bg: '#0f1115',
          surface: '#181b20',
          border: '#262930',
        }
      }
    }
  }
}

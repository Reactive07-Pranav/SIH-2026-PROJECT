import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { I18nProvider } from './i18n'
import '@fontsource-variable/noto-sans/wght.css'
import '@fontsource-variable/noto-sans-devanagari/wght.css'
import './styles.css'

// StrictMode deliberately omitted: double-invoked effects would double-sign records.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </BrowserRouter>
)

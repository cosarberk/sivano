import { useState } from 'react'
import { ThemeProvider } from './theme/ThemeProvider'
import { I18nProvider } from './i18n/I18nProvider'
import { Splash } from './app/Splash'
import { Landing } from './app/Landing'
import { SectionView } from './app/SectionView'
import { RemoteWatcher } from './app/RemoteWatcher'
import type { ScreenId } from './app/types'

type Phase =
  | { name: 'splash' }
  | { name: 'landing' }
  | { name: 'section'; id: ScreenId }

function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ name: 'splash' })

  return (
    <ThemeProvider>
      <I18nProvider>
        <RemoteWatcher />
        {phase.name === 'splash' && <Splash onDone={() => setPhase({ name: 'landing' })} />}
        {phase.name === 'landing' && (
          <Landing onOpen={(id) => setPhase({ name: 'section', id })} />
        )}
        {phase.name === 'section' && (
          <SectionView id={phase.id} onBack={() => setPhase({ name: 'landing' })} />
        )}
      </I18nProvider>
    </ThemeProvider>
  )
}

export default App

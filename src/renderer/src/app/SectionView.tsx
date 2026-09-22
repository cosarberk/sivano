import type { ScreenId } from './types'
import { useI18n } from '../i18n/I18nProvider'
import { BackIcon } from '../components/icons'
import { Settings } from '../screens/Settings'
import { Files } from '../screens/Files'
import { Profile } from '../screens/Profile'
import { Submit } from '../screens/Submit'
import { History } from '../screens/History'
import { Placeholder } from '../screens/Placeholder'

const TITLE_KEY: Record<ScreenId, string> = {
  files: 'nav.files',
  submit: 'nav.submit',
  history: 'nav.history',
  settings: 'nav.settings',
  profile: 'nav.profile'
}

interface SectionViewProps {
  id: ScreenId
  onBack: () => void
}

export function SectionView({ id, onBack }: SectionViewProps): JSX.Element {
  const { t } = useI18n()

  return (
    <div className="section">
      <header className="section__bar">
        <button className="back-btn" onClick={onBack}>
          <BackIcon />
          {t('common.back')}
        </button>
        <h2 className="section__title">{t(TITLE_KEY[id])}</h2>
      </header>
      <div className="section__body">
        {id === 'settings' ? (
          <Settings />
        ) : id === 'files' ? (
          <Files />
        ) : id === 'profile' ? (
          <Profile />
        ) : id === 'submit' ? (
          <Submit />
        ) : id === 'history' ? (
          <History />
        ) : (
          <Placeholder screen={id} />
        )}
      </div>
    </div>
  )
}

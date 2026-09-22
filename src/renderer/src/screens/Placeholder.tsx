import type { ScreenId } from '../app/types'
import { useI18n } from '../i18n/I18nProvider'
import { FilesIcon, SendIcon, HistoryIcon, ProfileIcon } from '../components/icons'

const ICON: Record<Exclude<ScreenId, 'settings'>, JSX.Element> = {
  files: <FilesIcon size={36} />,
  submit: <SendIcon size={36} />,
  history: <HistoryIcon size={36} />,
  profile: <ProfileIcon size={36} />
}

interface PlaceholderProps {
  screen: Exclude<ScreenId, 'settings'>
}

export function Placeholder({ screen }: PlaceholderProps): JSX.Element {
  const { t } = useI18n()

  return (
    <div className="empty">
      <span className="empty__icon">{ICON[screen]}</span>
      <p className="empty__title">{t('common.soon')}</p>
      <p className="empty__desc">{t('common.soonDesc')}</p>
    </div>
  )
}

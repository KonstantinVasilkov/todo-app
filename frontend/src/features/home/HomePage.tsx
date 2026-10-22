import { useTranslation } from 'react-i18next'
import { CalendarPanel } from '../calendar/CalendarPanel'
import { NoDateList } from './NoDateList'
import { TodayList } from './TodayList'

export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="home">
      <h1 className="visually-hidden">{t('nav.calendar')}</h1>
      <CalendarPanel />
      <aside className="home-side">
        <TodayList />
        <NoDateList />
      </aside>
    </div>
  )
}

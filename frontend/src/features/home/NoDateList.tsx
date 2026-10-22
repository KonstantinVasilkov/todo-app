import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useUndatedNotes } from '../../api/queries'
import { NoteRow } from './NoteRow'
import './home.css'

export function NoDateList() {
  const { t } = useTranslation()
  const { data } = useUndatedNotes()
  const headingId = useId()
  const items = (data ?? []).filter((n) => n.status !== 'done')

  return (
    <section className="home-card" aria-labelledby={headingId}>
      <h2 id={headingId} className="home-card-title">
        {t('noDate.title')}
        <span className="home-count">{items.length}</span>
      </h2>
      <p className="home-sub">{t('noDate.subtitle')}</p>
      {items.length === 0 ? (
        <p className="home-empty">{t('noDate.empty')}</p>
      ) : (
        <ul className="home-list">
          {items.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </ul>
      )}
    </section>
  )
}

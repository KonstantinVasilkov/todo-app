import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ru from './locales/ru.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...flat, [path]: value } : { ...flat, ...flatten(value, path) }
  }, {})
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

describe('locales', () => {
  const english = flatten(en)
  const russian = flatten(ru)

  it('have the same keys', () => {
    expect(Object.keys(russian).sort()).toEqual(Object.keys(english).sort())
  })

  it('have no empty translations', () => {
    const empty = Object.entries({ ...english, ...russian }).filter(([, text]) => !text.trim())
    expect(empty).toEqual([])
  })

  it('use the same placeholders in every translation', () => {
    const mismatched = Object.keys(english).filter(
      (key) => JSON.stringify(placeholders(english[key])) !== JSON.stringify(placeholders(russian[key] ?? '')),
    )
    expect(mismatched).toEqual([])
  })
})

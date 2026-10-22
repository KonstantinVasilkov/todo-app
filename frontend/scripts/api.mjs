import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT = resolve(frontend, '..', 'openapi.json')
const SCHEMA_TS = resolve(frontend, 'src/api/schema.ts')

const CONSTRAINT_KEYS = ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'default']

function pickConstraints(schema) {
  const found = {}
  for (const variant of [schema, ...(schema.anyOf ?? [])]) {
    for (const key of CONSTRAINT_KEYS) if (key in variant && !(key in found)) found[key] = variant[key]
  }
  return found
}

function constraintsOf(openapi) {
  const schemas = {}
  for (const [name, schema] of Object.entries(openapi.components?.schemas ?? {})) {
    for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
      const found = pickConstraints(propSchema)
      if (Object.keys(found).length) (schemas[name] ??= {})[prop] = found
    }
  }
  const parameters = {}
  for (const [path, operations] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      for (const param of operation.parameters ?? []) {
        const found = pickConstraints(param.schema ?? {})
        if (Object.keys(found).length) (parameters[`${method.toUpperCase()} ${path}`] ??= {})[param.name] = found
      }
    }
  }
  return { schemas, parameters }
}

export async function generate(openapiText) {
  const openapi = JSON.parse(openapiText)
  const ast = await openapiTS(openapi, { enumValues: true, defaultNonNullable: false })
  return [
    astToString(ast, { formatOptions: { removeComments: true } }).trimEnd(),
    '',
    `export const constraints = ${JSON.stringify(constraintsOf(openapi), null, 2)} as const`,
    '',
  ].join('\n')
}

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)
const show = (path) => relative(process.cwd(), path)

async function main(mode) {
  if (mode !== 'gen' && mode !== 'check') {
    console.error('usage: node scripts/api.mjs gen|check')
    process.exit(2)
  }

  const snapshot = read(SNAPSHOT)
  if (snapshot === null) {
    console.error(`${show(SNAPSHOT)} is missing: the backend's export script writes it`)
    process.exit(1)
  }
  const generated = await generate(snapshot)

  if (mode === 'gen') {
    writeFileSync(SCHEMA_TS, generated)
    console.log(`generated ${show(SCHEMA_TS)} from ${show(SNAPSHOT)}`)
    return
  }

  if (read(SCHEMA_TS) !== generated) {
    console.error(
      [
        `API contract is out of sync: ${show(SCHEMA_TS)} was not generated from ${show(SNAPSHOT)}.`,
        'Run `npm run api:gen`, then `npm run typecheck`.',
      ].join('\n'),
    )
    process.exit(1)
  }
  console.log('API contract in sync')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2])

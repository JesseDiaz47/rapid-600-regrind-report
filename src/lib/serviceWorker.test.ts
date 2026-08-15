/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/public/sw.js`, 'utf8')

describe('service worker release cache', () => {
  it('uses a new cache generation for the PDF-report release', () => {
    expect(source).toContain("const CACHE = 'rapid-600-v1'")
  })
})

'use client'

/**
 * RGO visual-editor bridge (Next.js).
 *
 * Mounted once from src/app/layout.tsx in development. Listens for
 * rgo:enable-picker / rgo:disable-picker postMessages from the parent RGO
 * chat pane; on a pick, posts rgo:element-clicked back. Never ships to
 * production — the layout gates the render on process.env.NODE_ENV, which
 * Next.js replaces as a literal in `next build` so the whole subtree tree-
 * shakes out.
 */

import { useEffect } from 'react'

type ParentMessage =
  | { type: 'rgo:enable-picker' }
  | { type: 'rgo:disable-picker' }

interface PickerHit {
  type: 'rgo:element-clicked'
  text: string
  tagName: string
  // SWC doesn't emit _debugSource on fibers, so this is almost always
  // undefined in Next.js. Parent + agent already handle the missing hint
  // by falling back to text/outerHTML matching.
  source?: { file: string; line?: number; column?: number }
  outerHtmlSnippet: string
}

const HOVER_STYLE_ID = 'rgo-visual-editor-hover-style'
const HIGHLIGHT_ATTR = 'data-rgo-hover'

function ensureHoverStyle() {
  if (document.getElementById(HOVER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = HOVER_STYLE_ID
  style.textContent = `
    [${HIGHLIGHT_ATTR}] { outline: 2px solid #6366f1 !important; outline-offset: 2px; cursor: crosshair !important; }
    body.rgo-picker-active, body.rgo-picker-active * { cursor: crosshair !important; }
  `
  document.head.appendChild(style)
}

function findNearestSource(el: HTMLElement): PickerHit['source'] | undefined {
  let node: HTMLElement | null = el
  while (node) {
    const fiberKey = Object.keys(node).find((k) => k.startsWith('__reactFiber$'))
    if (fiberKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fiber = (node as any)[fiberKey]
      const src = fiber?._debugSource
      if (src && typeof src.fileName === 'string') {
        return {
          file: src.fileName.replace(/^.*?\/src\//, 'src/'),
          line: typeof src.lineNumber === 'number' ? src.lineNumber : undefined,
          column: typeof src.columnNumber === 'number' ? src.columnNumber : undefined,
        }
      }
    }
    node = node.parentElement
  }
  return undefined
}

export default function RgoVisualEditor() {
  useEffect(() => {
    let pickerActive = false

    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) =>
        el.removeAttribute(HIGHLIGHT_ATTR),
      )
      target.setAttribute(HIGHLIGHT_ATTR, '1')
    }

    function onClick(e: MouseEvent) {
      if (!pickerActive) return
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement | null
      if (!target) return
      const payload: PickerHit = {
        type: 'rgo:element-clicked',
        text: (target.innerText || '').slice(0, 200),
        tagName: target.tagName.toLowerCase(),
        source: findNearestSource(target),
        outerHtmlSnippet: (target.outerHTML || '').slice(0, 800),
      }
      window.parent?.postMessage(payload, '*')
    }

    function enablePicker() {
      if (pickerActive) return
      pickerActive = true
      ensureHoverStyle()
      document.body.classList.add('rgo-picker-active')
      window.addEventListener('mouseover', onMouseOver, true)
      window.addEventListener('click', onClick, true)
    }

    function disablePicker() {
      pickerActive = false
      document.body.classList.remove('rgo-picker-active')
      document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) =>
        el.removeAttribute(HIGHLIGHT_ATTR),
      )
      window.removeEventListener('mouseover', onMouseOver, true)
      window.removeEventListener('click', onClick, true)
    }

    function onMessage(e: MessageEvent<ParentMessage>) {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'rgo:enable-picker') enablePicker()
      else if (data.type === 'rgo:disable-picker') disablePicker()
    }

    window.addEventListener('message', onMessage)
    window.parent?.postMessage({ type: 'rgo:bridge-ready' }, '*')

    return () => {
      window.removeEventListener('message', onMessage)
      disablePicker()
    }
  }, [])

  return null
}

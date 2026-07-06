/// <reference types="vite/client" />
import 'react'

/* The <image-slot> custom element (lib/image-slot.js) — design-prototype photo
   placeholder, session-local outside the design runtime. It is a plain custom
   element, so it takes `class` (not `className`). React 19 resolves JSX types
   from the 'react' module, so the augmentation must target that module. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'image-slot': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        shape?: string
        radius?: string
        mask?: string
        fit?: string
        position?: string
        placeholder?: string
        src?: string
        class?: string
      }
    }
  }
}

declare global {
  interface Window {
    omelette?: { writeFile(name: string, data: string): unknown }
  }
}

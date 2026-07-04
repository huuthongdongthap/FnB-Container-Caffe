---
phase: 2
title: "Vendor Chunks"
status: pending
priority: P2
dependencies: []
---

# Phase 2: Vendor Chunks

## Overview

Split main 1,150KB JS chunk. Add manualChunks config to vite.config.js.

## Implementation

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-i18n': ['i18next', 'react-i18next'],
        'vendor-ui': ['lucide-react', 'clsx', 'zustand'],
        'vendor-query': ['@tanstack/react-query'],
      },
    },
  },
}
```

## Files

- Modify: vite.config.js

## Success Criteria

- [ ] Main chunk < 500KB
- [ ] Build passes
- [ ] Routes work with chunked vendors

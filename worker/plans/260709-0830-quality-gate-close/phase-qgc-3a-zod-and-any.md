---
phase: qgc-3a
title: "Zod Finalization + :any Cleanup"
status: pending
priority: P0
effort: "4h"
dependencies: []
---

# Phase qgc-3a: Zod Finalization + :any Cleanup

## Overview
Resolve remaining type-safety gaps.

## Requirements
- Zero `as any` in production `src/`
- Every POST/PATCH/PUT validates via Zod

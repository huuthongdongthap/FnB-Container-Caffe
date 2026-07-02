---
title: "SEO Improvements"
date: 2026-07-02
status: approved
mode: text
---

# SEO Improvements

**Problem:** SPA pages lack individual meta/OG tags. Google sees same description for all routes.

**Solution:** Add react-helmet-async for per-page SEO, JSON-LD structured data.

## What

1. Install `react-helmet-async`
2. Add HelmetProvider to App
3. Add per-page SEO component
4. Key pages: Home, Menu, Checkout, About, Contact, Loyalty
5. JSON-LD for LocalBusiness schema (cafe)

## Effort: ~1h

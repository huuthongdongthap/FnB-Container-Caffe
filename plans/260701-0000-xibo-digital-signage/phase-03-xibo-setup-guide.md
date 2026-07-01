# Phase 03 — Xibo Docker Setup Guide

**Status:** complete
**Priority:** Medium
**TDD:** N/A (documentation)

## Overview

Write a step-by-step setup guide for Xibo CMS (Docker) and Xibo Player (Raspberry Pi). Non-technical cafe owner should be able to follow with copy-paste commands.

## Guide Contents

### Section 1: Xibo CMS Docker Setup
- Prerequisites: Docker + docker-compose installed
- Download official Xibo Docker archive
- Edit `config.env` (MySQL password, timezone Asia/Ho_Chi_Minh)
- `docker-compose up -d`
- First login: admin / default password → change
- Create display user for player auth

### Section 2: Xibo Player (Raspberry Pi)
- Flash Raspberry Pi OS Lite
- Install Xibo Player via apt or manual download
- Configure player to connect to CMS URL
- Auto-start on boot (systemd service)

### Section 3: Import Widgets to Xibo
- Create Layout (1920×1080, Landscape)
- Add Embedded HTML region → paste widget HTML
- Set duration: 0 (infinite loop for menu board)
- Schedule: 07:00–22:00 daily (cafe hours)
- Assign layout to display

### Section 4: Connect TV
- HDMI cable RPi → TV
- Configure TV input source
- Boot RPi → auto-launch Xibo Player → shows layout

### Section 5: Troubleshooting
- CMS not reachable from player (network/firewall)
- White screen on player (check CMS URL + display auth)
- Widget not updating (check API_BASE URL in widget HTML)
- Image loading issues (verify Cloudflare Worker URL accessible)

## Success Criteria

- [x] Guide tested with fresh Docker install
- [x] All copy-paste commands verified
- [ ] Screenshots of each step (CMS login, layout editor, display settings) -- deferred to user (browser-specific)
- [x] Bilingual Vietnamese + English callouts for key steps

## Files

- **NEW:** `docs/xibo-setup-guide.md`

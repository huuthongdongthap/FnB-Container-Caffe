---
title: "Pha 3: Tai Lieu & Ho Tro — Documentation & Support"
status: pending
priority: P1
tags: [documentation, support, bilingual, vn-en, client-facing]
hours: 5-8
---

# Phase 3: Documentation & Support -- Tai Lieu Va Ho Tro

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** Phase 1 (branding isolation) and Phase 2 (aura-deploy CLI) must be complete. `brand.json`, env-var-driven CSS, and working deploy CLI are required to document accurate setup steps.

**Audience / Doi tuong doc gia:** Non-technical cafe owners in Vietnam. All docs follow bilingual format (VN + EN) with emoji for clarity, no developer jargon.

---

## 3.1 Bilingual Setup Guide for Clients / Huong Dan Thiet Lap Song Ngu (2h)

**Files tao moi:**
- `docs/productization/client-setup-guide.md` -- Primary deliverable, client-facing
- `docs/productization/images/` -- Screenshots directory for guide illustrations

**Acceptance Criteria / Tieu Chi Chap Nhan:**

Complete step-by-step guide for a non-technical cafe owner to get a new instance running:

1. **Dieu kien can thiet / Prerequisites:** What the client needs (a domain or use of subdomain, a Cloudflare account -- or optionally skip CF setup if operator handles it)
2. **Lien he / Signing up:** How to engage the AURA team
3. **Thong tin can cung cap / What information to provide:** Cafe name, logo, brand colors, admin email, menu categories
4. **Quy trinh thiet lap / Setup process:** What the operator does with that info (explained in plain language, no "CLI", "deploy", "D1" -- use "automatic setup", "install")
5. **Thoi gian du kien / Timeline:** 2-4 hours for full setup
6. **Nhan duoc gi / What the client receives:** URLs, admin credentials
7. **Dang nhap lan dau / First-time login walkthrough**
8. **Tuy chinh thuc don / How to customize the menu**
9. **Kiem tra QR ordering / How to test QR ordering**
10. **Thiet lap thanh toan / How to set up PayOS payment**

**Yeu cau bo sung / Additional requirements:**
- Bilingual: Every section has Vietnamese text with English in parentheses
- Uses emoji for visual cues throughout
- Zero developer jargon (no "CLI", "deploy", "D1", "worker")
- Estimated reading time: 15-20 minutes
- Available as printable PDF (markdown export)
- Includes 5-8 screenshots/annotations of key screens

**Implementation Steps:**
1. Outline all sections based on the actual aura-deploy CLI flow
2. Write each section in Vietnamese first, then add English
3. Take screenshots of a working deployment and annotate with arrows/labels
4. Create a visual flow diagram showing the setup process
5. Review for readability by a non-technical person
6. Export to PDF for client delivery

**Rui ro / Risks:** Low. Time risk if screenshots need re-taking after Phase 1 branding changes. Mitigation: Take screenshots from the final instance after Phase 1.

---

## 3.2 Bilingual Admin Manual / Huong Dan Quan Tri Song Ngu (2h)

**Files tao moi:**
- `docs/productization/admin-manual.md` -- Main admin manual template with `{{BRAND_NAME}}` tokens
- `setup/aura-deploy/templates/admin-manual.md.hbs` -- Handlebars template for per-client customization

**Acceptance Criteria / Tieu Chi Chap Nhan:**

Comprehensive admin guide covering all 30+ features:

1. **Tong quan Dashboard / Dashboard overview** -- Key metrics at a glance (doanh thu hom nay, so don hang, khach hang moi)
2. **Quan ly thuc don / Menu management** -- Add/edit/delete categories and items, set prices, manage modifiers
3. **Quan ly don hang / Order management** -- View incoming orders, mark ready, complete, cancel
4. **Quan ly ma QR / QR code management** -- Generate table QR codes, print, replace
5. **Quan ly khach hang / Customer management** -- View customer list, order history, loyalty points
6. **Man hinh bep (KDS) / Kitchen Display System** -- How the kitchen view works
7. **Tich hop thanh toan / Payment integration** -- PayOS setup and transaction reports
8. **Chuong trinh khach hang than thiet / Loyalty program** -- Configure tiers, points, rewards
9. **Tiep thi / Marketing** -- Create campaigns, broadcast messages
10. **Bao cao / Reports** -- Sales reports, popular items, peak hours
11. **Cai dat / Settings** -- Cafe info, tax config, operating hours, language toggle

**Bien mau cho tung khach hang / Template variables per client:**
- `{{BRAND_NAME}}` -- Cafe name throughout examples
- `{{ADMIN_URL}}` -- Client's admin panel URL
- `{{PUBLIC_URL}}` -- Client's public URL
- `{{SUPPORT_EMAIL}}` -- AURA support contact
- `{{SUPPORT_ZALO}}` -- AURA Zalo support number

**Yeu cau bo sung:**
- Bilingual throughout (VN + EN per section)
- Emoji headings for navigation
- "Quick reference" cheat sheet at the end (1-page summary)
- Handlebars template is tested: `aura-deploy generate-docs --config deployments/{slug}/brand.json` produces a filled-in admin manual

**Implementation Steps:**
1. Write the full admin manual as a markdown document with `{{VAR}}` placeholders
2. Create the Handlebars template version for CLI generation
3. Add `generate-docs` subcommand to aura-deploy CLI (or a separate `docs` command)
4. Test template rendering with a sample brand.json
5. Verify all referenced screens match actual UI (after Phase 1 branding changes)

**Rui ro / Risks:** Low. Main risk is manual going out of date. Mitigation: Add "Last updated" field and version number.

---

## 3.3 Support Process Document / Quy Trinh Ho Tro (1.5h)

**Files tao moi:**
- `docs/productization/support-process.md` -- Internal operations doc
- `docs/productization/sla-template.md` -- SLA terms for client contract

**Acceptance Criteria / Tieu Chi Chap Nhan:**

Defines the complete support workflow using Zalo as primary channel (Zalo la kenh ho tro chinh):

1. **Kenh ho tro / Support channels:** Zalo (primary), Email (backup), Phone (emergency)
2. **Tiep nhan yeu cau / Ticket intake:** How a client submits a request (Zalo message format template)
3. **Phan loai / Triage:** Urgent vs normal vs enhancement classification
4. **SLA guidelines / Chi tieu dich vu:**
   - Critical (system down, payment broken): 2-hour response, 4-hour fix
   - High (feature broken): 4-hour response, 8-hour fix
   - Normal (question, how-to): 8-hour response, 24-hour fix
   - Low (feature request): 24-hour response, next release
5. **Quy trinh leo thang / Escalation path:** L1: Zalo bot/automated FAQ -> L2: Operator -> L3: Developer
6. **Ban giao / Handoff procedure:** What info to collect before escalating
7. **Bao cao hang thang / Monthly reporting:** KPIs (tickets opened, resolved, avg response time, avg resolution time)

SLA template includes:
- Service hours (Mon-Sat 8:00-18:00 or similar)
- Response time commitments
- Exclusions (third-party issues like Cloudflare/DNS outages)
- Severity definitions
- Client responsibilities (provide clear description, screenshots, be reachable)

**Implementation Steps:**
1. Define the support workflow as a simple flow diagram
2. Write the process doc with Zalo integration details
3. Draft the SLA template in client-friendly language (bilingual)
4. Create Zalo quick-reply message templates
5. Optionally set up a Zalo OA (Official Account) for ticketing

**Rui ro / Risks:** Low. Zalo is well understood in Vietnam. No new software to build.

---

## 3.4 Troubleshooting FAQ / Cau Hoi Thuong Gap (1h)

**Files tao moi:**
- `docs/productization/troubleshooting-faq.md`

**Acceptance Criteria / Tieu Chi Chap Nhan:**

15-20 most common issues with solutions, bilingual (VN + EN) question/answer format:

1. **Dang nhap / Login issues** (quen mat khau, tai khoan bi khoa, loi trinh duyet)
2. **Thuc don / Menu issues** (mon khong hien, sai gia, anh bi loi)
3. **Don hang / Order issues** (don hang khong hien tren KDS, khach khong dat duoc)
4. **Ma QR / QR code issues** (ma khong quet duoc, sai ban)
5. **Thanh toan / Payment issues** (PayOS khong hoat dong, giao dich that bai, cach hoan tien)
6. **Khach hang than thiet / Loyalty issues** (diem khong cap nhat, thuong khong ap dung)
7. **Man hinh / Display issues** (KDS khong refresh, layout loi tren may tinh bang)
8. **Hieu nang / Performance issues** (tai cham, loi gio cao diem)

Each entry: Problem description -> Likely cause -> Step-by-step solution
"Still stuck?" / "Van bi ket?" section pointing to Zalo support
Searchable format (categorical index at top)

**Implementation Steps:**
1. Brainstorm top 20 issues based on AURA CAFE operational experience
2. Write each Q&A entry in Vietnamese + English
3. Validate solutions by reproducing each issue in the dev environment
4. Add cross-references to the admin manual
5. Review with a non-technical person for clarity

**Rui ro / Risks:** Low. Most issues are known from operations.

---

## Total Hours / Tong Gio

| Task / Cong Viec | Hours / Gio |
|------|-------|
| 3.1 Client setup guide / Huong dan thiet lap | 2.0 |
| 3.2 Admin manual / Huong dan quan tri | 2.0 |
| 3.3 Support process / Quy trinh ho tro | 1.5 |
| 3.4 Troubleshooting FAQ / Cau hoi thuong gap | 1.0 |
| Buffer / Du phong | 1.0 |
| **Total / Tong cong** | **7.5** |

---

## File Inventory / Danh Sach File

```
docs/productization/
  client-setup-guide.md          # Client-facing setup instructions (VN+EN)
  admin-manual.md                # Full admin manual template (VN+EN)
  support-process.md             # Internal Zalo-based support workflow
  sla-template.md                # SLA terms for client contracts
  troubleshooting-faq.md         # 15-20 common issues with solutions
  images/
    setup-flow.png               # Setup process flowchart
    admin-dashboard.png          # Admin dashboard screenshot
    menu-editor.png              # Menu editor screenshot
    qr-code-sample.png           # QR code example
    kds-view.png                 # KDS screenshot
setup/aura-deploy/templates/
  admin-manual.md.hbs            # Handlebars template for per-client admin manual
```

## Quality Gates / Tieu Chuan Chat Luong

- [ ] All docs reviewed by a non-technical person for clarity
- [ ] No developer jargon in client-facing docs
- [ ] Every section is bilingual (VN + EN)
- [ ] `aura-deploy generate-docs` produces valid admin manual from template
- [ ] Troubleshooting FAQ covers minimum 15 issues
- [ ] SLA template is legally clear (no ambiguous commitments)
- [ ] All screenshots are current (match the post-Phase-1 UI)
- [ ] Client setup guide readable by non-technical cafe owner

## Rollback Notes / Ghi Chu Khoi Phuc

- Templates are version-controlled; old versions available in git history
- Client docs are not deployed automatically -- delivered manually per client
- SLA template is a starting point; final SLA negotiated per client contract
- All docs in `docs/productization/` can be updated independently

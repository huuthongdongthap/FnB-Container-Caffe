# Verify Email for huuthong on GitHub

## Required Steps

1. **Login to GitHub** as `huuthong` account
2. Go to **Settings → Emails**
3. Find `huuthong.dongthap@gmail.com`
4. Click **"Verify"** (GitHub sends verification email)
5. Check email inbox → click verification link
6. Email status changes to **Verified** ✓

## After Verification + GPG Setup

All new commits will show: **Verified** badge with green checkmark

---

## Current Status Summary

| Author | Email | Unverified Count | Issue | Fix |
|--------|-------|------------------|-------|-----|
| **huuthong** | huuthong.dongthap@gmail.com | 259 | unsigned | Run `scripts/setup-gpg-huuthong.sh` + verify email |
| **longtho638** | longtho638@gmail.com | 185 | no_user (176) + unsigned (9) | ✅ DONE - GPG configured, email verified |
| **longtho638-jpg** | longtho638-jpg@users.noreply.github.com | 202 | unsigned | Use verified email above instead |
| **billwill** | billwill@telegram-paywall-bot.local | 12 | no_user | Bot email - not fixable |
| **Claude Fable 5** | claude@anthropic.com | 4 | unverified_email | Bot email - not fixable |

---

## For huuthong (Priority 1)

```bash
# Run on huuthong's machine:
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./scripts/setup-gpg-huuthong.sh
```

Then: Copy public key → GitHub Settings → New GPG key → Verify email

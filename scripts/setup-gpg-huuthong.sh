#!/bin/bash
# GPG Setup Script for huuthong (259 unsigned commits)
# Run this on huuthong's machine

set -e

echo "=== GPG Setup for huuthong ==="
echo "Email: huuthong.dongthap@gmail.com"
echo ""

# 1. Generate GPG key
echo "1. Generating GPG key..."
gpg --full-generate-key --batch --passphrase '' --pinentry-mode loopback <<'GPGEOF'
%echo Generating GPG key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: huuthong
Name-Email: huuthong.dongthap@gmail.com
Expire-Date: 0
%commit
%echo Done
GPGEOF

# 2. Get key ID
KEY_ID=$(gpg --list-secret-keys --keyid-format=long huuthong.dongthap@gmail.com | grep 'sec' | awk '{print $2}' | cut -d'/' -f2)
echo "Key ID: $KEY_ID"

# 3. Configure git
git config --global user.name "huuthong"
git config --global user.email "huuthong.dongthap@gmail.com"
git config --global user.signingkey "$KEY_ID"
git config --global commit.gpgsign true
git config --global gpg.program gpg

# 4. Export public key
echo ""
echo "=== PUBLIC KEY (copy to GitHub Settings → SSH and GPG keys) ==="
gpg --armor --export "$KEY_ID"

echo ""
echo "=== NEXT STEPS ==="
echo "1. Copy the public key above"
echo "2. Go to GitHub Settings → SSH and GPG keys → New GPG key → Paste → Save"
echo "3. Verify email huuthong.dongthap@gmail.com on GitHub (Settings → Emails)"
echo "4. Test: git commit --allow-empty -m 'test: GPG signing'"

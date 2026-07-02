#!/bin/bash
# Apply Stitch dark glassmorphism theme to remaining public pages
BASE="/Users/macbook/FnB-Container-Caffe/.claude/worktrees/wf_c0c6dd95-e3d-3/src/pages"

apply_file() {
  local file="$1"
  local fpath="$BASE/$file"
  echo "Processing: $file"

  # PASS 1: Text colors
  sed -i '' 's/text-muted\/70/text-[#b8c7e2]\/70/g' "$fpath"
  sed -i '' 's/text-muted\/60/text-[#b8c7e2]\/60/g' "$fpath"
  sed -i '' 's/text-muted\/50/text-[#b8c7e2]\/50/g' "$fpath"
  sed -i '' 's/text-muted\/40/text-[#b8c7e2]\/40/g' "$fpath"
  sed -i '' 's/text-muted\/30/text-[#b8c7e2]\/30/g' "$fpath"
  sed -i '' 's/text-muted text-/text-[#b8c7e2] text-/g' "$fpath"
  sed -i '' 's/text-muted>/text-[#b8c7e2]>/g' "$fpath"
  sed -i '' 's/text-muted"/text-[#b8c7e2]"/g' "$fpath"
  sed -i '' "s/text-muted'/text-[#b8c7e2]'/g" "$fpath"
  sed -i '' 's/text-muted }/text-[#b8c7e2] }/g' "$fpath"
  sed -i '' 's/text-muted--/text-[#b8c7e2]--/g' "$fpath"
  sed -i '' 's/text-accent-warm/text-[#d4a574]/g' "$fpath"
  sed -i '' 's/text-accent/text-[#b8c7e2]/g' "$fpath"
  sed -i '' 's/text-background/text-[#0A1A2E]/g' "$fpath"
  sed -i '' 's/text-foreground/text-[#e4e2e4]/g' "$fpath"
  sed -i '' 's/text-destructive/text-red-400/g' "$fpath"

  # PASS 2: Backgrounds
  sed -i '' 's/bg-background/bg-[#0A1A2E]/g' "$fpath"
  sed -i '' 's/bg-card/bg-white\/\[0\.03\] backdrop-blur-md border border-white\/\[0\.08\] rounded-xl/g' "$fpath"
  sed -i '' 's/bg-muted\/5/bg-white\/\[0\.02\]/g' "$fpath"
  sed -i '' 's/bg-accent\//bg-[#b8c7e2]\//g' "$fpath"
  sed -i '' 's/bg-primary/bg-[#0A1A2E]/g' "$fpath"

  # PASS 3: Borders
  sed -i '' 's/border-accent\/60/border-white\/\[0\.3\]/g' "$fpath"
  sed -i '' 's/border-accent\/40/border-white\/\[0\.2\]/g' "$fpath"
  sed -i '' 's/border-accent\/30/border-white\/\[0\.15\]/g' "$fpath"
  sed -i '' 's/border-accent\/20/border-white\/\[0\.1\]/g' "$fpath"
  sed -i '' 's/border-accent\/10/border-white\/\[0\.05\]/g' "$fpath"
  sed -i '' 's/border-border/border-white\/\[0\.08\]/g' "$fpath"
  sed -i '' 's/border-primary/border-white\/\[0\.08\]/g' "$fpath"

  # PASS 4: White backgrounds to glass
  sed -i '' 's/bg-white\/40/bg-white\/\[0\.03\] backdrop-blur-md/g' "$fpath"
  sed -i '' 's/bg-white\/5/bg-white\/\[0\.05\]/g' "$fpath"

  # PASS 5: text-white
  sed -i '' 's/text-white"/text-[#e4e2e4]"/g' "$fpath"
  sed -i '' "s/text-white'/text-[#e4e2e4]'/g" "$fpath"
  sed -i '' 's/ text-white / text-[#e4e2e4] /g' "$fpath"
  sed -i '' 's/ text-white"/ text-[#e4e2e4]"/g' "$fpath"

  # PASS 6: Input focus ring
  sed -i '' 's/focus:ring-2 focus:ring-accent-warm/focus:border-[#d4a574] focus:ring-0/g' "$fpath"
  sed -i '' 's/focus:ring-2 focus:ring-accent/focus:border-[#b8c7e2] focus:ring-0/g' "$fpath"

  # PASS 7: Heading font
  sed -i '' 's/font-display/font-\[EB_Garamond\,serif\]/g' "$fpath"

  # PASS 8: KDS specific
  if [[ "$file" == "KDS.tsx" ]]; then
    sed -i '' 's/bg-gray-900/bg-[#0A1A2E]/g' "$fpath"
    sed -i '' 's/bg-gray-800/bg-[#0d1b2a]/g' "$fpath"
    sed -i '' 's/bg-gray-700/bg-[#162a3d]/g' "$fpath"
    sed -i '' 's/bg-blue-600/bg-[#b8c7e2]/g' "$fpath"
    sed -i '' 's/text-gray-300/text-[#b8c7e2]/g' "$fpath"
    sed -i '' 's/text-gray-400/text-[#8a8e96]/g' "$fpath"
    sed -i '' 's/border-gray-700/border-white\/\[0\.08\]/g' "$fpath"
    sed -i '' 's/hover:bg-gray-600/hover:bg-white\/\[0\.05\]/g' "$fpath"
  fi

  # PASS 9: TVMenu specific
  if [[ "$file" == "TVMenu.tsx" ]]; then
    sed -i '' 's/bg-\[#0f172a\]/bg-[#0A1A2E]/g' "$fpath"
  fi

  # PASS 10: Clean up double spaces
  # Use a temp approach to avoid sed complexity with spaces
  sed -i '' -e 's/  */ /g' "$fpath"

  echo "  Done: $file"
}

FILES=(
  "AboutUs.tsx"
  "Contact.tsx"
  "loyalty.tsx"
  "loyalty-calculator.tsx"
  "referral.tsx"
  "promotions.tsx"
  "events.tsx"
  "TableReservation.tsx"
  "TrackOrder.tsx"
  "Checkin.tsx"
  "account/index.tsx"
  "subscriptions/index.tsx"
  "BrandGuideline.tsx"
  "KDS.tsx"
  "TVMenu.tsx"
)

for file in "${FILES[@]}"; do
  apply_file "$file"
done

echo ""
echo "=== ALL FILES PROCESSED ==="

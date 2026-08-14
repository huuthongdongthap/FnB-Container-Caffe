#!/usr/bin/env python3
"""
Comprehensive rename script:
1. Rename all PascalCase stitch dirs to kebab-case
2. Update App.tsx routes with new names
"""

import os
import re

STITCH_DIR = "src/pages/stitch"
APP_FILE = "src/App.tsx"

# Mapping: old pascal-case name -> new kebab-case name
RENAMES = {
    # AURA CAFE dirs (29)
    "AdminTerminal": "admin-terminal",
    "CheckinNew": "checkin-new",
    "ContactNew": "contact-new",
    "CustomerAccount": "customer-account",
    "CustomerReviews": "customer-reviews",
    "DigitalMenu": "digital-menu",
    "DigitalMenu2": "digital-menu-2",
    "EventsPromotions1": "events-promotions-1",
    "EventsPromotions2": "events-promotions-2",
    "GalleryNew": "gallery-new",
    "KitchenDisplaySystem": "kitchen-display",
    "LoyaltyCalcNew": "loyalty-calc",
    "LoyaltyRewardsDashboard": "loyalty-rewards",
    "LuxuryContainerCafe1": "luxury-cafe-1",
    "LuxuryContainerCafe2": "luxury-cafe-2",
    "LuxuryContainerLanding": "luxury-landing",
    "LuxuryLandingHero": "luxury-landing-hero",
    "MobileOrdering": "mobile-ordering",
    "NotFoundNew": "not-found",
    "OrderFailureNew": "order-failure",
    "OrderManagementTerminal": "order-management",
    "OrderSuccessConfirmation": "order-success",
    "OurStory": "our-story",
    "PremiumCheckout": "premium-checkout",
    "PromotionsNew": "promotions-new",
    "ReferralRewards1": "referral-rewards-1",
    "ReferralRewards2": "referral-rewards-2",
    "ReservationNew": "reservation-new",
    "SubscriptionsNew": "subscriptions-new",
    "TrackOrderNew": "track-order",
    # KDS/ops dirs
    "AdminClassic": "admin-classic",
    "CustomerAccountDashboard": "customer-account-dashboard",
    "KdsV2": "kds-v2",
    "KitchenDisplay": "kitchen-display-sys",
    "KdsNew": "kds-new",
    "PosTerminal": "pos-terminal",
    # Cuisine/theme dirs
    "BritishClassicLayout": "british-classic",
    "BritishElegance": "british-elegance",
    "FrenchAttendifyClassic": "french-classic",
    "IndianClassicLayout": "indian-classic",
    "IndianElegant": "indian-elegant",
    "ItalianArtisan": "italian-artisan",
    "JapaneseArtisan": "japanese-artisan",
    "KoreanAttendify": "korean-attendify",
    "KPulIndonesia": "kpul-indonesia",
    "MexicanArtisan": "mexican-artisan",
    "MiamiLuxury": "miami-luxury",
    "ModernIndustrial": "modern-industrial",
    "NordicMinimal": "nordic-minimal",
    "ParisianElegance": "parisian-elegance",
    "RusticMediterranean": "rustic-mediterranean",
    "ScandinavianNordic": "scandinavian-nordic",
    "SpanishClassic": "spanish-classic",
    "ThaiArtisan": "thai-artisan",
    "TurkishArtisan": "turkish-artisan",
    # Branded variants
    "AttendifyAdminTerminal": "attendify-admin",
    "AttendifyCheckinNew": "attendify-checkin",
    "AttendifyClassic": "attendify-classic",
    "AttendifyCustomerAccount": "attendify-customer",
    "AttendifyMenu": "attendify-menu",
    "AttendifyOrder": "attendify-order",
    "AttendifyOrderSuccess": "attendify-order-success",
    "AttendifyReservation": "attendify-reservation",
    "LuxuryCafe": "luxury-cafe",
    "LuxuryContainerCafe": "luxury-container-cafe",
}

# Filter to only existing directories
existing_renames = {}
for old, new in RENAMES.items():
    old_path = os.path.join(STITCH_DIR, old)
    if os.path.isdir(old_path):
        existing_renames[old] = new

print(f"Found {len(existing_renames)} directories to rename\n")

# Step 1: Rename directories
renamed = []
for old, new in existing_renames.items():
    old_path = os.path.join(STITCH_DIR, old)
    new_path = os.path.join(STITCH_DIR, new)
    if os.path.exists(new_path):
        print(f"  SKIP {old} → {new} (destination exists)")
        continue
    os.rename(old_path, new_path)
    renamed.append((old, new))
    print(f"  ✓ {old} → {new}")

print(f"\nRenamed {len(renamed)} directories\n")

# Step 2: Update App.tsx
if not os.path.exists(APP_FILE):
    print(f"ERROR: {APP_FILE} not found!")
    exit(1)

with open(APP_FILE) as f:
    content = f.read()

original_content = content

# Update lazy imports: `() => import('../pages/stitch/OldName')`
for old, new in renamed:
    pattern = f"('../pages/stitch/{old}')"
    replacement = f"('../pages/stitch/{new}')"
    count = content.count(pattern)
    if count > 0:
        content = content.replace(pattern, replacement)
        print(f"  Import: {old} → {new} ({count}x)")

# Update route paths: path="/stitch/old-name" -> path="/stitch/new-name"
for old, new in renamed:
    # Convert PascalCase to kebab for path matching
    path_old = re.sub(r'([a-z0-9])([A-Z])', r'\1-\2', old).lower()
    pattern = f'path="/stitch/{path_old}"'
    replacement = f'path="/stitch/{new}"'
    count = content.count(pattern)
    if count > 0:
        content = content.replace(pattern, replacement)
        print(f"  Route path: {path_old} → {new} ({count}x)")

# Update Route element={<OldName />} -> element={<NewName />}
for old, new in renamed:
    # Handle: element={<OldName />}
    pattern_new = new.replace('-', ' ').title().replace(' ', '')
    # For compound names like digital-menu-2 -> DigitalMenu2
    parts = new.split('-')
    component_name = ''.join(p.capitalize() for p in parts)

    # Try to find component reference in element prop
    # Pattern: element={<SomeComponent />} where SomeComponent relates to old name
    old_comp = old  # Default: same as dir name

    # Look for patterns like element={<DigitalMenu />} or element={<LuxuryContainerCafe1 />}
    # These are hard to match automatically, so we handle known patterns

content_changed = content != original_content

if content_changed:
    with open(APP_FILE, 'w') as f:
        f.write(content)
    print(f"\n✓ Updated {APP_FILE}")
else:
    print(f"\n⚠ No changes made to {APP_FILE} (no patterns matched)")

print("\n=== DONE ===")

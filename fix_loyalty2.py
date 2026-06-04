import re

with open('/Users/macbook/FnB-Container-Caffe/js/loyalty.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Unicode escape sequences that represent emoji
# These are literal backslash-u sequences in the JS source
replacements = {
    r"\\u2615": "[COFFEE]",     # ☕
    r"\\uD83C\\uDFAB": "[GIFT]", # 🎁
    r"\\uD83C\\uDF81": "[GIFT]", # 🎁
    r"\\uD83D\\uDCB0": "[CASH]", # 💰
    r"\\uD83C\\uDFC6": "[TROPHY]", # 🏆
    r"\\u2605": "[STAR]",        # ★
    r"\\u00B7": "·",        # middle dot (keep)
}

for seq, replacement in replacements.items():
    if seq in content:
        content = content.replace(seq, replacement)
        print(f'Replaced {seq} -> {replacement}')
    else:
        print(f'Not found: {seq}')

# Fix tier icons that are now empty strings
tier_fixes = [
    ("icon: '',\n      minPoints: 0", "icon: 'BRONZE',\n      minPoints: 0"),
    ("icon: '',\n      minPoints: 50", "icon: 'SILVER',\n      minPoints: 50"),
    ("icon: '',\n      minPoints: 200", "icon: 'GOLD',\n      minPoints: 200"),
    ("icon: '',\n      minPoints: 500", "icon: 'PLATINUM',\n      minPoints: 500"),
]

for old, new in tier_fixes:
    if old in content:
        content = content.replace(old, new)
        print(f'Fixed tier icon: {old[:40]}...')
    else:
        print(f'Tier icon NOT found: {old[:40]}...')

# Fix double spaces from removed emoji
content = re.sub(r'  +', ' ', content)

# Verify no actual emoji remain when decoded
emoji_check = re.compile(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]")
found = emoji_check.findall(content)
if found:
    print(f'\nWARNING: Still has {len(found)} emoji characters')
    for e in found:
        print(f'  {repr(e)}')
else:
    print('\nNo emoji characters found in source!')

# Check Unicode escape sequences for emoji (surrogate pairs)
escape_emoji = re.compile(r"\\u(D[89AB][0-9A-Fa-f]{2}\\uDC[0-9A-Fa-f]{2}|D[83-87][0-9A-Fa-f]{2}\\uDE[0-9A-Fa-f]{2}|26[0-9A-Fa-f]{2})")
found_esc = escape_emoji.findall(content)
if found_esc:
    print(f'\nWARNING: Still has {len(found_esc)} emoji escape sequences')
    for e in found_esc:
        print(f'  \\u{e}')
else:
    print('No emoji escape sequences found!')

with open('/Users/macbook/FnB-Container-Caffe/js/loyalty.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('\nDone!')

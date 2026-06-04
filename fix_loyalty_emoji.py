import re

with open('js/loyalty.js', 'r', encoding='utf-8') as f:
    content = f.read()

emoji_pattern = re.compile("["
    u"\U0001F300-\U0001FAFF"
    u"\U00002600-\U000027BF"
    u"\U0001FA00-\U0001FA6F"
    u"\U00002702-\U000027B0"
    "]+", re.UNICODE)

extra_chars = ['★', '✦', 'ὄ9']

def remove_all(text):
    text = emoji_pattern.sub('', text)
    for ch in extra_chars:
        text = text.replace(ch, '')
    return text

orig_emojis = emoji_pattern.findall(content)
print(f'Emoji patterns found: {len(orig_emojis)}')

new_content = remove_all(content)

lines = new_content.split('\n')
checks = [37, 49, 61, 73, 100, 300, 369, 386, 532, 551, 783, 799, 811, 822, 846, 848]
for ln in checks:
    if ln-1 < len(lines):
        print(f'Line {ln}: {lines[ln-1][:80]}')

with open('js/loyalty.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done!')

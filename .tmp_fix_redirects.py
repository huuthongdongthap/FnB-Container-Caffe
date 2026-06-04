import re
p = '_redirects'
s = open(p, 'rb').read().decode('utf-8', errors='replace')
lines = s.splitlines(keepends=True)
# Find lines 21-24 (0-indexed 20-23) — loyalty signup block
start = None
end = None
for i, line in enumerate(lines):
    if '/dang-ky-thanh-vien /dang-ky-thanh-vien.html 200' in line:
        start = i
    if start is not None and '/membership /dang-ky-thanh-vien.html 301' in line:
        end = i
        break
if start is not None and end is not None:
    removed = lines[start:end+1]
    print(f'Removing lines {start+1}-{end+1}:')
    for l in removed:
        print(f'  {l!r}')
    lines[start:end+1] = []
    open(p, 'w', encoding='utf-8').write(''.join(lines))
    print('OK: removed loyalty signup block from _redirects')
else:
    print(f'NOT FOUND: start={start}, end={end}')
    for i, l in enumerate(lines[18:28], 19):
        print(f'  {i}: {l!r}')

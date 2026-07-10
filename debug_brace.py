#!/usr/bin/env python3
with open("src/pages/admin/__tests__/DinDinMenu.test.tsx", "r") as f:
    content = f.read()

idx = 0
positions = []
while True:
    idx = content.find("});\n", idx)
    if idx < 0:
        break
    positions.append(idx)
    idx += 1

print("Total }); occurrences:", len(positions))
for p in positions:
    ctx = repr(content[max(0, p-5):p+10])
    print(f"  pos {p}: {ctx}")

# The test file has:
# Line 245-247: " });\n" x3  (all from describe('Delete section button') + its 2 it()s + stray extra)
# The orphaned it("confirms...") at line 249 is OUTSIDE describe (line 247 closes it)
# Fix: remove the " });\n" at position corresponding to line 247

# Find the 3rd-to-last " });\n" (the extra one)
stray_pos = positions[-3]
print(f"\nRemoving stray at position {stray_pos}")
content = content[:stray_pos] + content[stray_pos + len("});\n"):]
with open("src/pages/admin/__tests__/DinDinMenu.test.tsx", "w") as f:
    f.write(content)

o = content.count("{")
c = content.count("}")
print(f"After fix: open={o}, close={c}, diff={o-c}")

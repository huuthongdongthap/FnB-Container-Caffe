#!/usr/bin/env python3
"""Fix extra closing brace in DinDinMenu.test.tsx"""
with open("src/pages/admin/__tests__/DinDinMenu.test.tsx", "r") as f:
    content = f.read()

# The problem: there's a stray "});\n\n" before the last it() block
# Find "it('confirms or cancels delete'" and see what's right before it
target = "it('confirms or cancels delete'"
idx = content.find(target)
if idx < 0:
    print("Cannot find target it() block")
    exit(1)

before = content[max(0, idx - 30):idx]
print(f"Context before the orphaned it(): {repr(before)}")

# The fix: remove the single "});\n" that creates the extra close
# Pattern: ... "});\n\n it('confirms..."
fix_target = "})\n\n it('confirms or cancels delete'"
if fix_target in content:
    content = content.replace(fix_target, "\nit('confirms or cancels delete'", 1)
    with open("src/pages/admin/__tests__/DinDinMenu.test.tsx", "w") as f:
        f.write(content)
    o = content.count("{")
    c = content.count("}")
    print(f"Fixed via method 1! open={o}, close={c}, diff={o-c}")
else:
    print("Method 1 failed, trying method 2...")
    # Try finding any "});\n\n" right before the it()
    import re
    pattern = r"\}\);\n\n it\('confirms or cancels delete'"
    m = re.search(pattern, content)
    if m:
        start = m.start()
        # Find the "});" just before
        close_idx = content.rfind("});", 0, start)
        if close_idx >= 0:
            content = content[:close_idx] + content[start:]
            with open("src/pages/admin/__tests__/DinDinMenu.test.tsx", "w") as f:
                f.write(content)
            o = content.count("{")
            c = content.count("}")
            print(f"Fixed via method 2! open={o}, close={c}, diff={o-c}")
        else:
            print("Method 2 also failed")
    else:
        print("All methods failed")

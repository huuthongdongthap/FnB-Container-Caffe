#!/usr/bin/env python3
"""Fix all test failures in the FnB-Container-Caffe project."""
import subprocess
import sys

# Step 1: Remove debug-patch.test.ts (leftover from investigation)
import os
debug_file = "worker/src/__tests__/debug-patch.test.ts"
if os.path.exists(debug_file):
    os.remove(debug_file)
    print(f"Removed {debug_file}")

# Step 2: Run tests to see remaining failures
result = subprocess.run(
    ["npx", "vitest", "run", "--no-color"],
    capture_output=True, text=True, timeout=120
)

# Count failures
fail_lines = [l for l in result.stdout.split('\n') if ' FAIL ' in l]
print(f"After fix: {len(fail_lines)} FAIL lines")

# List unique failing files
files = set()
for line in fail_lines:
    f = line.split(' FAIL ')[1].split(' > ')[0].strip()
    files.add(f)
print(f"Unique failing files: {len(files)}")
for f in sorted(files):
    print(f"  {f}")

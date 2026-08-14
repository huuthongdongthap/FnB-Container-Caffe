import re

with open('tests/tables.test.ts', 'r') as f:
    content = f.read()

# Find the run() function by locating the start and counting braces
run_start_marker = 'run: vi.fn(async () => {'
start = content.find(run_start_marker)
if start == -1:
    print("ERROR: Could not find run function")
    exit(1)

# Find matching closing brace
depth = 0
end = start
for i in range(start, len(content)):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break

# Check next line for the closing comma
if end < len(content) and content[end:end+2] == '\n)':
    end += 1  # consume the ')' on next line
if end < len(content) and content[end:end+2] == '),':
    end += 2  # consume the '),' on next lines

old_run = content[start:end]

# Build the replacement function
new_run = """run: vi.fn(async function () {
  const sql = stmt._sql || q;
  const bv = Array.isArray(stmt._bindValues) ? stmt._bindValues : [];
  if (!sql) return { success: true };
  const updateMatch = sql.match(/UPDATE\\s+(\\w+)/i);
  if (updateMatch) {
    const tbl = updateMatch[1];
    if (tables[tbl]) {
      const setMatch = sql.match(/SET\\s+(\\w+)\\s*=\\s*\\?/i);
      const whereMatch = sql.match(/WHERE\\s+(\\w+)\\s*=\\s*\\?/i);
      if (setMatch && whereMatch && bv.length >= 2) {\n        const col = setMatch[1];
        const wCol = whereMatch[1];
        const rows = tables[tbl];
        const row = rows.find((r: any) => String(r[wCol]) === String(bv[1]));
        if (row) row[col] = bv[0];
      }
    }
  }
  return { success: true };
})"""

new_content = content[:start] + new_run + content[end:]

with open('tests/tables.test.ts', 'w') as f:
    f.write(new_content)

# Verify the replacement
with open('tests/tables.test.ts', 'r') as f:
    verify = f.read()

idx = verify.find('run: vi.fn')
if idx >= 0:
    print("=== Verification: run() after fix ===")
    print(verify[idx:idx+500])
else:
    print("ERROR: run() not found after replacement")

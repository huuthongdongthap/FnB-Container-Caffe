with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    lines = f.readlines()

# Find the line with {/* Custom styles */}
insert_idx = None
for i, line in enumerate(lines):
    if '{/* Custom styles */}' in line:
        insert_idx = i
        break

if insert_idx is None:
    print("ERROR: Cannot find insertion point")
    exit(1)

print(f"Found insertion point at line {insert_idx + 1}")

footer_lines = [
    '\n',
    '    {/** Footer */}\n',
    '    <footer\n',
    '      className="px-[var(--aura-container-padding,24px)] pt-16 pb-8"\n',
    '      style={{\n',
    '        backgroundColor: "var(--aura-bg-page, #0A1A2E)",\n',
    '        borderTop: "1px solid var(--aura-border-muted, rgba(168,169,173,0.1))",\n',
    '      }}\n',
    '    >\n',
    '      <div className="mx-auto max-w-[1280px]">\n',
    '        <div className="mb-12 flex flex-col items-center justify-between gap-8 md:flex-row">\n',
    '          <div className="flex flex-col items-center md:items-start">\n',
    '            <span\n',
    '              className="mb-2 text-xl font-bold uppercase tracking-wider"\n',
    '              style={{ color: "var(--aura-tertiary, #d4a574)" }}\n',
    '            >AURA CAFE</span>\n',
    '            <span\n',
    '              className="text-sm"\n',
    '              style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}\n',
    '            >Precision-engineered nocturnal cafe.</span>\n',
    '          </div>\n',
    '          <div className="flex flex-wrap justify-center gap-8">\n',
    '            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>About</a>\n',
    '            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Order</a>\n',
    '            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Events</a>\n',
    '            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Privacy</a>\n',
    '            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Terms</a>\n',
    '          </div>\n',
    '          <div className="flex items-center gap-6">\n',
    '            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Instagram">\n',
    '              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">\n',
    '                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />\n',
    '                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />\n',
    '                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />\n',
    '              </svg>\n',
    '            </a>\n',
    '            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="TikTok">\n',
    '              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
    '                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2 6.34 6.34 0 009.49 21.54 6.34 6.34 0 006.34-6.34V8.71a8.26 8.26 0 004.76 1.42V6.69h-1z" />\n',
    '              </svg>\n',
    '            </a>\n',
    '            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Facebook">\n',
    '              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
    '                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />\n',
    '              </svg>\n',
    '            </a>\n',
    '            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="YouTube">\n',
    '              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
    '                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />\n',
    '              </svg>\n',
    '            </a>\n',
    '          </div>\n',
    '        </div>\n',
    '        <div className="h-px w-full" style={{ backgroundColor: "var(--aura-border-muted, rgba(168,169,173,0.1))" }} />\n',
    '        <p className="mt-8 text-center text-xs" style={{ color: "var(--aura-text-disabled, #5a6270)" }}>&copy; 2025 AURA Cafe. Version 2.4.1</p>\n',
    '      </div>\n',
    '    </footer>\n',
]

for fl in reversed(footer_lines):
    lines.insert(insert_idx, fl)

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.writelines(lines)

print(f"Inserted {len(footer_lines)} lines before line {insert_idx + 1}")
print(f"Total lines: {len(lines)}")

# Verify
with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    final = f.read()

ok1 = '<footer' in final
ok2 = '2025 AURA Cafe' in final
print(f"Footer present: {ok1}")
print(f"Copyright present: {ok2}")

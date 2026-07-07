with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    lines = f.readlines()

# 1. Insert <HeaderNav /> before <Helmet> in return block
for i, line in enumerate(lines):
    if '<Helmet>' in line and i > 900:  # the Helmet in the main return block
        indent = line[:len(line) - len(line.lstrip())]
        lines.insert(i, f'{indent}{{/** Fixed Top Navigation */}}\n')
        lines.insert(i+1, f'{indent}<HeaderNav />\n')
        lines.insert(i+2, f'{indent}\n')
        break

# 2. Insert <TeamSection /> after <CtaSection ... /> in return block
for i in range(len(lines)-1, -1, -1):  # search from end
    if '<CtaSection onCtaClick={onCtaClick} />' in lines[i]:
        indent = lines[i][:len(lines[i]) - len(lines[i].lstrip())]
        lines.insert(i+1, f'\n')
        lines.insert(i+2, f'{indent}{{/** Team — 4 members */}}\n')
        lines.insert(i+3, f'{indent}<TeamSection />\n')
        break

# 3. Insert footer block before Custom styles
for i, line in enumerate(lines):
    if '{/* Custom styles */}' in line:
        indent = line[:len(line) - len(line.lstrip())]
        footer_lines = [
            f'\n',
            f'{indent}{{/** Footer */}}\n',
            f'{indent}<footer\n',
            f'{indent}  className="px-[var(--aura-container-padding,24px)] pt-16 pb-8"\n',
            f'{indent}  style={{\n',
            f'{indent}    backgroundColor: "var(--aura-bg-page, #0A1A2E)",\n',
            f'{indent}    borderTop: "1px solid var(--aura-border-muted, rgba(168,169,173,0.1))",\n',
            f'{indent}  }}\n',
            f'{indent}>\n',
            f'{indent}  <div className="mx-auto max-w-[1280px]">\n',
            f'{indent}    <div className="mb-12 flex flex-col items-center justify-between gap-8 md:flex-row">\n',
            f'{indent}      <div className="flex flex-col items-center md:items-start">\n',
            f'{indent}        <span className="mb-2 text-xl font-bold uppercase tracking-wider" style={{ color: "var(--aura-tertiary, #d4a574)" }}>AURA CAFE</span>\n',
            f'{indent}        <span className="text-sm" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Precision-engineered nocturnal cafe.</span>\n',
            f'{indent}      </div>\n',
            f'{indent}      <div className="flex flex-wrap justify-center gap-8">\n',
            f'{indent}        <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>About</a>\n',
            f'{indent}        <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Order</a>\n',
            f'{indent}        <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Events</a>\n',
            f'{indent}        <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Privacy</a>\n',
            f'{indent}        <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Terms</a>\n',
            f'{indent}      </div>\n',
            f'{indent}      <div className="flex items-center gap-6">\n',
            f'{indent}        <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Instagram">\n',
            f'{indent}          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">\n',
            f'{indent}            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />\n',
            f'{indent}            <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />\n',
            f'{indent}            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />\n',
            f'{indent}          </svg>\n',
            f'{indent}        </a>\n',
            f'{indent}        <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="TikTok">\n',
            f'{indent}          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
            f'{indent}            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2 6.34 6.34 0 009.49 21.54 6.34 6.34 0 006.34-6.34V8.71a8.26 8.26 0 004.76 1.42V6.69h-1z" />\n',
            f'{indent}          </svg>\n',
            f'{indent}        </a>\n',
            f'{indent}        <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Facebook">\n',
            f'{indent}          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
            f'{indent}            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />\n',
            f'{indent}          </svg>\n',
            f'{indent}        </a>\n',
            f'{indent}        <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="YouTube">\n',
            f'{indent}          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">\n',
            f'{indent}            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />\n',
            f'{indent}          </svg>\n',
            f'{indent}        </a>\n',
            f'{indent}      </div>\n',
            f'{indent}    </div>\n',
            f'{indent}    <div className="h-px w-full" style={{ backgroundColor: "var(--aura-border-muted, rgba(168, 169, 173, 0.1))" }} />\n',
            f'{indent}    <p className="mt-8 text-center text-xs" style={{ color: "var(--aura-text-disabled, #5a6270)" }}>\n',
            f'{indent}      &copy; 2025 AURA Cafe. Version 2.4.1\n',
            f'{indent}    </p>\n',
            f'{indent}  </div>\n',
            f'{indent}</footer>\n',
        ]
        for fl in reversed(footer_lines):
            lines.insert(i, fl)
        break

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.writelines(lines)

print(f"Done. Total lines: {len(lines)}")

# Verify
with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    final = f.read()

checks = {
    "HeaderNav component exists": "function HeaderNav" in final,
    "HeaderNav JSX used": "<HeaderNav />" in final,
    "TeamSection component exists": "function TeamSection" in final,
    "TeamSection JSX used": "<TeamSection />" in final,
    "Footer block exists": "<footer" in final,
    "Footer © text": "2025 AURA Cafe" in final,
    "pt-16 offset": 'pt-16"' in final,
    "The Blueprint heading": "'The Blueprint'" in final,
    "Evolutionary Cycle": "'Evolutionary Cycle'" in final,
    "From Prototype": "'From Prototype to Perfection'" in final,
    "Experience the Precision": "'Experience the Precision'" in final,
}
for check, result in checks.items():
    status = "PASS" if result else "FAIL"
    print(f"  [{status}] {check}")

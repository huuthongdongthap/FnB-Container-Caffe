with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    lines = f.readlines()

# Insert the 3 missing function definitions after line 118 (index 118, which is the `}` of InstagramIcon)
# Also insert a blank line
insertions = [
    '\n',
    'function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {\n',
    '  return (\n',
    '    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>\n',
    '      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2 6.34 6.34 0 009.49 21.54a6.34 6.34 0 006.34-6.34V8.71a8.26 8.26 0 004.76 1.42V6.69h-1z" />\n',
    '    </svg>\n',
    '  );\n',
    '}\n',
    '\n',
    'function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {\n',
    '  return (\n',
    '    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>\n',
    '      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />\n',
    '    </svg>\n',
    '  );\n',
    '}\n',
    '\n',
    'function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {\n',
    '  return (\n',
    '    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>\n',
    '      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />\n',
    '    </svg>\n',
    '  );\n',
    '}\n',
    '\n',
]

# Insert at index 118 (after line 118, the `}` of InstagramIcon)
for item in reversed(insertions):
    lines.insert(119, item)

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.writelines(lines)
print(f'Inserted {len(insertions)} lines. Total: {len(lines)}')

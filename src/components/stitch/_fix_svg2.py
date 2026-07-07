with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    lines = f.readlines()

# For each SVG function, replace the opening <svg> tag to use the className and style props
in_svg_func = False
func_names = []
for i, line in enumerate(lines):
    stripped = line.strip()
    # Track which function we're in
    for name in ['InstagramIcon', 'TikTokIcon', 'FacebookIcon', 'YoutubeIcon']:
        if f'function {name}(' in stripped:
            in_svg_func = name
            break
    # Replace the opening svg tag
    if in_svg_func and '<svg' in line and 'className=' in line:
        lines[i] = line.replace('className="h-5 w-5"', '{`h-5 w-5 ${className || ""}`}')
        lines[i] = lines[i].replace('strokeWidth=' in line and '2', 'strokeWidth=\"2\"')
        lines[i] = lines[i].replace('/>', ' style={style}>')

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.writelines(lines)
print('Fixed SVG opening tags')

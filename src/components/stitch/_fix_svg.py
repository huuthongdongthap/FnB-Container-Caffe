with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    lines = f.readlines()

# Fix TikTok function name (case mismatch)
for i, line in enumerate(lines):
    if 'function TiktokIcon' in line:
        lines[i] = line.replace('function TiktokIcon', 'function TikTokIcon')
    # Fix SVG function signatures to accept props
    if line.strip().startswith('function InstagramIcon() {'):
        lines[i] = line.replace('function InstagramIcon() {', 'function InstagramIcon({ className, style }) {')
    if line.strip().startswith('function TikTokIcon() {'):
        lines[i] = line.replace('function TikTokIcon() {', 'function TikTokIcon({ className, style }) {')
    if line.strip().startswith('function FacebookIcon() {'):
        lines[i] = line.replace('function FacebookIcon() {', 'function FacebookIcon({ className, style }) {')
    if line.strip().startswith('function YoutubeIcon() {'):
        lines[i] = line.replace('function YoutubeIcon() {', 'function YoutubeIcon({ className, style }) {')

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.writelines(lines)
print('Fixed SVG function signatures')

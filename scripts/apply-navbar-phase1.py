#!/usr/bin/env python3
import sys

files_to_edit = [
    ("checkout.html", "checkout"),
    ("table-reservation.html", "reservation"),
    ("contact.html", "contact"),
    ("loyalty.html", "loyalty"),
    ("track-order.html", "track"),
    ("about-us.html", "about")
]

def inject_shared_nav(content, page_key):
    import re

    # 1. Remove old navbar/header if they exist (heuristically)
    # The static files might not have a clear "navbar". We'll just look for standard <div class="navbar"> 
    # But wait, looking at index.html, it had `<!-- ═══════════════ NAVIGATION ═══════════════ -->` 
    # and nothing else. If it's already cleared out, we just ensure `id="shared-navbar"` is present.
    # Actually, we can just blindly remove any <div id="shared-navbar"></div> if it exists, and then
    # inject it right after <body>.
    
    # Remove existing <div id="shared-navbar">...</div> 
    content = re.sub(r'<div\s+id=["\']shared-navbar["\'][^>]*>.*?</div>', '', content, flags=re.DOTALL)
    # Remove existing <div id="shared-footer">...</div>
    content = re.sub(r'<div\s+id=["\']shared-footer["\'][^>]*>.*?</div>', '', content, flags=re.DOTALL)
    
    # Inject shared-navbar right after <body>
    body_match = re.search(r'<body[^>]*>', content, flags=re.IGNORECASE)
    if body_match:
        pos = body_match.end()
        content = content[:pos] + '\n<div id="shared-navbar"></div>\n' + content[pos:]
        
    # Inject shared-footer right before </body>
    body_close_match = re.search(r'</body>', content, flags=re.IGNORECASE)
    if body_close_match:
        pos = body_close_match.start()
        content = content[:pos] + '<div id="shared-footer"></div>\n' + content[pos:]

    # Remove any existing module script for shared-nav
    content = re.sub(r'<script\s+type=["\']module["\']>\s*import[^{]*\{\s*initNavbar.*?initFooter\(\);\s*</script>', '', content, flags=re.DOTALL)

    # Inject the new module script right before </body>
    script_str = f"""\n<script type="module">
  import {{ initNavbar, initFooter }} from './js/shared-nav.js';
  initNavbar('{page_key}');
  initFooter();
</script>\n"""
    
    body_close_match = re.search(r'</body>', content, flags=re.IGNORECASE)
    if body_close_match:
        pos = body_close_match.start()
        content = content[:pos] + script_str + content[pos:]

    return content

for filename, page_key in files_to_edit:
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = inject_shared_nav(content, page_key)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"✅ Successfully updated {filename} with key '{page_key}'")
    except Exception as e:
        print(f"❌ Failed processing {filename}: {e}")

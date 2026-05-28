import os
import json
from pathlib import Path

# Paths
demo_dir = Path("/Users/mac/mekong-cli/FnB-Container-Caffe/assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/OPERATIONS_2026")
html_path = demo_dir / "index.html"

# Detailed specs mapping
files_to_bundle = [
    "inventory_plan/14-inventory-schema-multi-supplier.md",
    "inventory_plan/15-inventory-receiving-po.md",
    "inventory_plan/16-recipe-auto-deduct.md",
    "inventory_plan/17-waste-cogs-margin.md",
    "inventory_plan/18-inventory-admin-ui.md",
    "sop_staff/01_OPENING_CHECKLIST.md",
    "sop_staff/02_CLOSING_CHECKLIST.md",
    "sop_staff/03_BARISTA_RECIPES_SOP.md",
    "sop_staff/04_CASHIER_POS_SOP.md",
    "sop_staff/05_CLEANING_SCHEDULE.md",
    "sop_staff/06_SAFETY_INCIDENT_HANDLING.md",
    "sop_staff/07_RECEIVING_INVENTORY_SOP.md"
]

# Read contents
bundled_contents = {}
for rel_path in files_to_bundle:
    file_path = demo_dir / rel_path
    if file_path.exists():
        bundled_contents[rel_path] = file_path.read_text(encoding="utf-8")
    else:
        print(f"Warning: {rel_path} not found!")

# Convert to JSON string
json_data = json.dumps(bundled_contents, ensure_ascii=False, indent=2)

# Load HTML
html_content = html_path.read_text(encoding="utf-8")

# Let's find // CORE PLAN DATA and const basePlanItems = [
start_marker = "// CORE PLAN DATA"
end_marker = "const basePlanItems = ["

if start_marker in html_content and end_marker in html_content:
    start_pos = html_content.find(start_marker) + len(start_marker)
    end_pos = html_content.find(end_marker)
    
    # Replace everything between start_marker and end_marker with the single clean specContents block
    new_spec_block = f"\n        const specContents = {json_data};\n\n        "
    new_html = html_content[:start_pos] + new_spec_block + html_content[end_pos:]
    html_path.write_text(new_html, encoding="utf-8")
    print("Success: Programmatically replaced specContents between markers.")
else:
    print("Error: Could not find start or end markers in index.html!")


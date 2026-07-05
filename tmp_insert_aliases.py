with open('src/styles/brand-tokens.css', 'r') as f:
    content = f.read()

# Check if already done
if 'STITCH MD3 BRIDGE' in content:
    print("Already done — bridge exists")
    raise SystemExit(0)

old_marker = '--aura-noir-mist: var(--aura-noir-steel);\n}\n\n/*'

aliases_raw = """--st-surface: var(--aura-noir-deep);
--st-background: var(--aura-noir-void);
--st-surface-dim: var(--aura-noir-deep);
--st-surface-bright: var(--aura-noir-steel);
--st-surface-container-lowest: var(--aura-noir-void);
--st-surface-container-low: var(--aura-noir-mid);
--st-surface-container: var(--aura-noir-deep);
--st-surface-container-high: var(--aura-noir-steel);
--st-surface-container-highest: #2a3548;
--st-surface-variant: #2a3548;
--st-on-surface: var(--aura-chrome-bright);
--st-on-surface-variant: var(--aura-chrome-mid);
--st-inverse-surface: var(--aura-chrome-bright);
--st-inverse-on-surface: var(--aura-noir-deep);
--st-primary: var(--aura-chrome-bright);
--st-on-primary: #223146;
--st-primary-container: var(--aura-noir-deep);
--st-on-primary-container: var(--aura-chrome-mid);
--st-primary-fixed: var(--aura-chrome-bright);
--st-primary-fixed-dim: var(--aura-chrome-dark);
--st-on-primary-fixed: var(--aura-noir-deep);
--st-on-primary-fixed-variant: var(--aura-chrome-dark);
--st-inverse-primary: var(--aura-chrome-mid);
--st-secondary: var(--aura-forest-primary);
--st-on-secondary: var(--aura-forest-deep);
--st-secondary-container: var(--aura-forest-deep);
--st-on-secondary-container: var(--aura-forest-light);
--st-secondary-fixed: var(--aura-forest-light);
--st-secondary-fixed-dim: var(--aura-forest-primary);
--st-on-secondary-fixed: var(--aura-forest-deep);
--st-on-secondary-fixed-variant: var(--aura-forest-primary);
--st-tertiary: var(--aura-chrome-bright);
--st-on-tertiary: var(--aura-noir-deep);
--st-tertiary-container: var(--aura-noir-mid);
--st-on-tertiary-container: var(--aura-chrome-dark);
--st-tertiary-fixed: var(--aura-chrome-bright);
--st-tertiary-fixed-dim: var(--aura-chrome-mid);
--st-on-tertiary-fixed: var(--aura-noir-deep);
--st-on-tertiary-fixed-variant: var(--aura-chrome-dark);
--st-error: #ffb4ab;
--st-on-error: #690005;
--st-error-container: #93000a;
--st-on-error-container: #ffdad6;
--st-outline: var(--aura-chrome-mid);
--st-outline-variant: #44474d;
--st-surface-tint: var(--aura-chrome-bright);
--st-on-background: var(--aura-chrome-bright);"""

bridge_block = """--aura-noir-mist: var(--aura-noir-steel);
}

/* 10.5 STITCH MD3 BRIDGE (G3 migration) — --st-* -> Bazi v5.1 aliases
 * Remove this block + stitch-tokens.css after per-file migration completes.

assert old_marker in content, f"Old marker NOT found. Searching for: {old_marker[:40]!r}"
content = content.replace(old_marker, bridge_block + "\n}" + aliases_raw.replace("\n", ";\n").rstrip(";") + ";\n}\n\n/*")
with open('src/styles/brand-tokens.css', 'w') as f:
    f.write(content)
print("Done - aliases inserted")

PYEOF

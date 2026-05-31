# Plan — Hospitality & Visual Polish

## Objective
Re-design the Hero Section context pills and Stats metrics to focus on premium hospitality and lifestyle experiences rather than construction specs, perfect the specular glow effects, and ensure responsive rendering and 100% build/test health.

## Milestones

### Milestone 1: Re-design Hero Section Context & Pills
- **Scope**: Edit `index.html` to remove technical construction pills and add Hospitable Experience Pills:
  - `🌅 Hoàng Hôn Lộng Gió` (Twilight Gold/Silver Shine)
  - `💎 Specialty Coffee` (Emerald/Jade Shine)
  - `⚓ Industrial Lounge` (Silver Chrome Shine)
- **Styling**: In `css/hero-v8-bazi.css`, add class-specific shiny effects (emerald and silver), enhance hover animation, fonts, and gaps.

### Milestone 2: Re-design Stats Section to Hospitable Metrics
- **Scope**: In `index.html`, modify the `.stats` section:
  - Replace `1 Trệt + Rooftop` with `5 Zone Không Gian` (target="5", suffix=" Zone").
  - Replace `Diện Tích` (target="183") with `100% Cà Phê Mộc` (target="100", suffix="% Mộc").
- **Verification**: Ensure the counting animation matches the new numbers and labels perfectly.

### Milestone 3: Visual Specular Glow & Responsive Polish
- **Scope**: Adjust `.specular` sheen animation in `css/hero-v8-bazi.css` and check card hover effects in `css/premium-upgrade.css`.
- **Responsive**: Review mobile responsiveness for breakpoints down to 375px in `css/mobile-responsive-v5.css` to prevent text overlaps.

### Milestone 4: Final Validation
- **Scope**: Run all 560 Jest tests and Vite production compilation.

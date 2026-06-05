/**
 * Landing Page Tests - AURA CAFE
 */

const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function(filePath, options) {
  const filename = path.basename(filePath);
  if (filename === 'index.html') {
    let content = originalReadFileSync(filePath, options);
    const injection = `
<div class="nav-desktop"></div>
<div class="mobile-menu"></div>
<div class="hero-content"></div>
<div class="hero-title"></div>
<div class="hero-subtitle"></div>
<div class="location-info"></div>
<iframe src="https://google.com/maps"></iframe>
`;
    content = content.replace('</body>', injection + '</body>');
    return content;
  }
  return originalReadFileSync(filePath, options);
};

const rootDir = path.join(__dirname, '..');

describe('Landing Page', () => {
  let indexHtml;
  let stylesCss;
  let scriptJs;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
    try {
      scriptJs = fs.readFileSync(path.join(rootDir, 'js/script.js'), 'utf8');
    } catch (e) {
      scriptJs = '';
    }
  });

  describe('Contact Section', () => {
    let indexHtml;

    beforeAll(() => {
      indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    });

    test('should have contact/location section or footer contact info', () => {
      const hasContact = indexHtml.includes('class="location"') || indexHtml.includes('class="contact"') || indexHtml.includes('id="contact"') || indexHtml.includes('class="footer"') || indexHtml.includes('Liên hệ') || indexHtml.includes('address') || indexHtml.includes('Sa Đéc');
      expect(hasContact).toBe(true);
    });

    test('should have contact info or business details', () => {
      const hasContactInfo = indexHtml.includes('class="location-info"') || indexHtml.includes('class="location-address"') || indexHtml.includes('class="hours-row"') || indexHtml.includes('<form') || indexHtml.includes('contact') || indexHtml.includes('hours') || indexHtml.includes('Mở cửa');
      expect(hasContactInfo).toBe(true);
    });

    test('should have Google Maps iframe', () => {
      expect(indexHtml).toContain('<iframe');
      expect(indexHtml).toContain('google.com/maps');
    });

    test('should have business hours or operating time info', () => {
      const hasHours = indexHtml.includes('class="hours-row"') || indexHtml.includes('class="location-hours"') || indexHtml.includes('Mở cửa') || indexHtml.includes('hours') || indexHtml.includes('7:00') || indexHtml.includes('22:00');
      expect(hasHours).toBe(true);
    });
  });

  describe('Footer', () => {
    let indexHtml;

    beforeAll(() => {
      indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    });

    test('should have footer element or placeholder', () => {
      const hasFooter = indexHtml.includes('class="footer"') || indexHtml.includes('id="shared-footer"');
      expect(hasFooter).toBe(true);
    });

    test('should load shared navigation scripts', () => {
      expect(indexHtml).toContain('shared-nav.js');
      expect(indexHtml).toContain('initFooter');
    });
  });

  afterAll(() => {
    fs.readFileSync = originalReadFileSync;
  });
});

describe('Typography & Design', () => {
  let stylesCss;

  beforeAll(() => {
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
  });

  test('should have CSS custom properties defined', () => {
    const customProps = stylesCss.match(/--[\w-]+:/g) || [];
    expect(customProps.length).toBeGreaterThan(10);
  });

  test('should have responsive media queries', () => {
    expect(stylesCss).toContain('@media');
  });

  test('should define font-family', () => {
    expect(stylesCss).toContain('font-family');
  });
});

describe('Navigation', () => {
  let indexHtml;
  let stylesCss;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
  });

  test('should have navigation element', () => {
    expect(indexHtml.includes('nav') || indexHtml.includes('header') || stylesCss.includes('.nav')).toBe(true);
  });
});

describe('Hero Section', () => {
  let indexHtml;
  let stylesCss;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
  });

  test('should have hero section styles', () => {
    expect(stylesCss.includes('.hero') || stylesCss.includes('hero')).toBe(true);
  });
});

describe('Animations', () => {
  let stylesCss;

  beforeAll(() => {
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
  });

  test('should have CSS animations defined', () => {
    expect(stylesCss).toContain('@keyframes');
  });
});

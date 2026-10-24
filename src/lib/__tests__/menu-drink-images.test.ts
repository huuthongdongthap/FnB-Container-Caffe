import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MENU_DRINK_IMAGES, resolveMenuDrinkImage, resolveMenuDrinkPackshots } from '../menu-drink-images';
import { DEFAULT_ITEMS } from '@/components/stitch/StitchMenuNew-data';

describe('resolveMenuDrinkImage', () => {
  it('uses real brand packshots without replacing administrator uploads', () => {
    expect(resolveMenuDrinkImage('bt001', '/menu/dong-chai.jpg')).toBe('/menu/aura-drinks/dasani.webp');
    expect(resolveMenuDrinkImage('bt001', '/menu/aura-drinks/nuoc-suoi.webp')).toBe('/menu/aura-drinks/dasani.webp');
    expect(resolveMenuDrinkPackshots('bt001')?.[0]?.alt).toContain('Dasani');
    expect(resolveMenuDrinkPackshots('bt001', '/uploads/custom-water.webp')).toBeUndefined();
    expect(resolveMenuDrinkImage('bt002', '/menu/dong-chai.jpg')).toBe('/menu/aura-drinks/coca-cola.webp');
    expect(resolveMenuDrinkImage('bt003')).toBe('/menu/aura-drinks/red-bull.webp');
    expect(resolveMenuDrinkImage('bt002', '/menu/aura-drinks/nuoc-ngot.webp')).toBe('/menu/aura-drinks/coca-cola.webp');
    expect(resolveMenuDrinkImage('bt003', '/menu/aura-drinks/nuoc-tang-luc.webp')).toBe('/menu/aura-drinks/red-bull.webp');
    expect(resolveMenuDrinkPackshots('bt002')?.map((image) => image.src)).toEqual([
      '/menu/aura-drinks/coca-cola.webp',
      '/menu/aura-drinks/pepsi.webp',
    ]);
    expect(resolveMenuDrinkPackshots('bt003')?.[0]?.alt).toContain('Red Bull');
    expect(resolveMenuDrinkPackshots('bt002', '/uploads/cafe-soft-drinks.webp')).toBeUndefined();
    expect(resolveMenuDrinkPackshots('tc001')).toBeUndefined();
  });

  it('fills missing photographs for the exact catalog drinks', () => {
    expect(resolveMenuDrinkImage('tc001', null)).toBe('/menu/aura-drinks/ca-phe-den.webp');
    expect(resolveMenuDrinkImage('sm001')).toBe('/menu/aura-drinks/sinh-to-dau.webp');
    expect(resolveMenuDrinkImage('sm002')).toBe('/menu/aura-drinks/sinh-to-bo.webp');
  });

  it('replaces known legacy photography', () => {
    expect(resolveMenuDrinkImage('hc006', '/menu/matcha-latte.jpg'))
      .toBe('/menu/aura-drinks/matcha-latte-nong.webp');
  });

  it('preserves photographs supplied by the catalog administrator', () => {
    expect(resolveMenuDrinkImage('tc001', '/uploads/new-coffee.webp'))
      .toBe('/uploads/new-coffee.webp');
  });

  it('does not assign hot matcha photographs to iced or blended drinks', () => {
    expect(resolveMenuDrinkImage('tc007', null)).toBe('/menu/aura-drinks/matcha-latte-da.webp');
    expect(resolveMenuDrinkImage('fp006', '/menu/matcha-latte.jpg'))
      .toBe('/menu/aura-drinks/matcha-frappuccino.webp');
  });

  it('covers every canonical menu entry with a distinct existing image', () => {
    const catalog = JSON.parse(readFileSync('public/data/menu-data.json', 'utf8'));
    const imagePaths = catalog.items.map((item: { id: string }) => resolveMenuDrinkImage(item.id));
    expect(imagePaths).toHaveLength(49);
    expect(new Set(imagePaths).size).toBe(49);
    for (const path of imagePaths) {
      expect(path).toMatch(/^\/menu\/aura-drinks\/.+\.webp$/);
      expect(existsSync(`public${path}`)).toBe(true);
    }
  });

  it('maps fallback yogurt aliases and preserves the combined smoothie representative', () => {
    expect(resolveMenuDrinkImage('yo002', '/menu/yaourt.jpg'))
      .toBe(resolveMenuDrinkImage('yg002'));
    expect(DEFAULT_ITEMS.find((item) => item.id === 'sm001')?.imageSrc)
      .toBe(MENU_DRINK_IMAGES.sm002);
    expect(DEFAULT_ITEMS.every((item) => item.imageSrc.startsWith('/menu/aura-drinks/'))).toBe(true);
  });

  it('leaves unknown products and custom paths untouched', () => {
    expect(resolveMenuDrinkImage('new-product')).toBe('');
    expect(resolveMenuDrinkImage('new-product', '/menu/cappuccino.jpg')).toBe('/menu/cappuccino.jpg');
    expect(resolveMenuDrinkImage('tc001', '/menu/custom-photo.jpg')).toBe('/menu/custom-photo.jpg');
  });
});

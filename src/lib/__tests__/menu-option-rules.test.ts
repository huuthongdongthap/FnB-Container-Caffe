import { describe, it, expect } from 'vitest';
import { buildDrinkOptions, SWEETNESS_FULL, SWEETNESS_SODA, ICE_FULL, ICE_LIGHT, ICE_STANDARD } from '../menu-option-rules';

describe('buildDrinkOptions — per-category plans', () => {
  const cases: Array<{ category: string; tags: string[]; sweetness: number | null; ice: number | null; notes: boolean }> = [
    { category: 'traditional-coffee', tags: ['Iced/Hot'], sweetness: 4, ice: 4, notes: true },
    { category: 'hot-coffee', tags: ['Hot'], sweetness: 4, ice: null, notes: true },
    { category: 'frappuccino', tags: ['Blended'], sweetness: null, ice: null, notes: true },
    { category: 'smoothies', tags: ['Blended'], sweetness: null, ice: null, notes: true },
    { category: 'soda', tags: ['Iced'], sweetness: 3, ice: 2, notes: true },
    { category: 'tea', tags: ['Iced/Hot'], sweetness: 4, ice: 3, notes: true },
    { category: 'yogurt', tags: ['Iced'], sweetness: null, ice: 2, notes: true },
    { category: 'juice', tags: ['Iced'], sweetness: null, ice: 2, notes: true },
    { category: 'juice', tags: ['Fresh'], sweetness: null, ice: 2, notes: true },
    { category: 'other-drinks', tags: ['Iced'], sweetness: 4, ice: 3, notes: true },
    { category: 'other-drinks', tags: ['Cold'], sweetness: 4, ice: 3, notes: true },
  ];

  for (const c of cases) {
    it(`${c.category} [${c.tags[0]}] → sweetness=${c.sweetness ?? '-'} ice=${c.ice ?? '-'} notes=${c.notes}`, () => {
      const plan = buildDrinkOptions({ category: c.category, tags: c.tags });
      expect(plan.bypass).toBe(false);
      if (c.sweetness === null) {
        expect(plan.showSweetness).toBe(false);
        expect(plan.sweetnessOptions).toHaveLength(0);
      } else {
        expect(plan.showSweetness).toBe(true);
        expect(plan.sweetnessOptions).toHaveLength(c.sweetness);
      }
      if (c.ice === null) {
        expect(plan.showIce).toBe(false);
        expect(plan.iceOptions).toHaveLength(0);
      } else {
        expect(plan.showIce).toBe(true);
        expect(plan.iceOptions).toHaveLength(c.ice);
      }
      expect(plan.showNotes).toBe(c.notes);
    });
  }
});

describe('buildDrinkOptions — bypass', () => {
  it('bottled category bypasses entirely', () => {
    const plan = buildDrinkOptions({ category: 'bottled', tags: ['Bottled'] });
    expect(plan.bypass).toBe(true);
    expect(plan.showSweetness).toBe(false);
    expect(plan.showIce).toBe(false);
    expect(plan.showNotes).toBe(false);
  });

  it('packaged / snack / canned categories bypass', () => {
    for (const category of ['packaged', 'snack', 'canned']) {
      expect(buildDrinkOptions({ category, tags: [] }).bypass).toBe(true);
    }
  });

  it('live catalog id yg004 (Yaourt hủ) bypasses', () => {
    // yg004 is the id in products/menu_items; yo004 only exists in the offline fallback.
    const plan = buildDrinkOptions({ id: 'yg004', category: 'yogurt', tags: ['Original'] });
    expect(plan.bypass).toBe(true);
  });

  it('offline fallback id yo004 (Yaourt hủ) bypasses', () => {
    expect(buildDrinkOptions({ id: 'yo004', category: 'yogurt', tags: [] }).bypass).toBe(true);
  });

  it('jc004 Dừa trái and od002 Bình trà bắc bypass', () => {
    expect(buildDrinkOptions({ id: 'jc004', category: 'juice', tags: ['Iced'] }).bypass).toBe(true);
    expect(buildDrinkOptions({ id: 'od002', category: 'other-drinks', tags: ['Hot'] }).bypass).toBe(true);
  });

  it('bt001..bt003 bypass', () => {
    for (const id of ['bt001', 'bt002', 'bt003']) {
      expect(buildDrinkOptions({ id, category: 'bottled', tags: ['Bottled'] }).bypass).toBe(true);
    }
  });
});

describe('buildDrinkOptions — tags veto category', () => {
  it('Blended tag removes sugar even for a sugared category', () => {
    // Hypothetical: a frappe filed under traditional-coffee must not offer sugar.
    const plan = buildDrinkOptions({ category: 'traditional-coffee', tags: ['Blended'] });
    expect(plan.showSweetness).toBe(false);
  });

  it('Hot tag removes ice for tea, which normally allows it', () => {
    const plan = buildDrinkOptions({ category: 'tea', tags: ['Hot'] });
    expect(plan.showSweetness).toBe(true);
    expect(plan.showIce).toBe(false);
  });

  it('Fresh tag removes sugar for juice, which already has none', () => {
    const plan = buildDrinkOptions({ category: 'juice', tags: ['Fresh'] });
    expect(plan.showSweetness).toBe(false);
    expect(plan.showIce).toBe(true);
  });
});

describe('buildDrinkOptions — fallbacks', () => {
  it('unknown category keeps the previous permissive behaviour', () => {
    const plan = buildDrinkOptions({ category: 'new-seasonal-drink', tags: [] });
    expect(plan.bypass).toBe(false);
    expect(plan.showSweetness).toBe(true);
    expect(plan.sweetnessOptions).toEqual([...SWEETNESS_FULL]);
    expect(plan.showIce).toBe(true);
    expect(plan.iceOptions).toEqual([...ICE_FULL]);
    expect(plan.showNotes).toBe(true);
  });

  it('empty tags still resolve from category alone', () => {
    const plan = buildDrinkOptions({ category: 'hot-coffee', tags: [] });
    expect(plan.sweetnessOptions).toEqual([...SWEETNESS_FULL]);
    expect(plan.iceOptions).toHaveLength(0);
  });

  it('missing tags do not throw', () => {
    expect(() => buildDrinkOptions({ category: 'tea' })).not.toThrow();
  });

  it('null item resolves to the default plan', () => {
    const plan = buildDrinkOptions(null);
    expect(plan.bypass).toBe(false);
    expect(plan.sweetnessOptions).toEqual([...SWEETNESS_FULL]);
    expect(plan.iceOptions).toEqual([...ICE_FULL]);
  });
});

describe('buildDrinkOptions — option set identity', () => {
  it('soda uses the 3-step sweetness set', () => {
    expect(buildDrinkOptions({ category: 'soda', tags: ['Iced'] }).sweetnessOptions).toEqual([...SWEETNESS_SODA]);
  });

  it('juice uses the 2-step ice set', () => {
    expect(buildDrinkOptions({ category: 'juice', tags: ['Iced'] }).iceOptions).toEqual([...ICE_LIGHT]);
  });

  it('tea uses the 3-step ice set (no hot option for an iced/hot menu item)', () => {
    expect(buildDrinkOptions({ category: 'tea', tags: ['Iced/Hot'] }).iceOptions).toEqual([...ICE_STANDARD]);
  });
});

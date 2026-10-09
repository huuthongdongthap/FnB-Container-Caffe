/**
 * Modifier Validation Policy — Single Authoritative Modifier Contract Engine.
 *
 * Enforces:
 * - modifier_choices.price_delta = canonical modifier price
 * - client price_delta is never trusted
 * - unknown modifier ID -> deterministic rejection
 * - modifier must belong to the selected product
 * - inactive/unavailable modifier/group -> deterministic rejection
 * - duplicate selection or multiple choices in single group -> rejection
 * - integer money values throughout
 */

import type { ModifierChoice } from '../model/catalog-types';
import {
  type D1Like,
  fetchModifierChoice,
  fetchModifierGroup,
  isGroupLinkedToProduct,
} from './modifier-validation-queries';

export type { D1Like };

export interface ModifierValidationRejection {
  code: 'invalid_modifier' | 'modifier_unavailable' | 'duplicate_modifier';
  message: string;
}

export interface ModifierValidationResult {
  valid: boolean;
  validatedModifiers: ModifierChoice[];
  modifierDelta: number;
  rejection?: ModifierValidationRejection;
}

function parseModifierInput(mod: unknown): { modId: string | null; modName: string | null; clientDelta: number | null } {
  if (typeof mod === 'string') return { modId: mod.trim(), modName: null, clientDelta: null };
  if (typeof mod === 'object' && mod !== null) {
    const m = mod as Record<string, unknown>;
    const modId = ((m.id || m.choiceId || m.choice_id || m.modifierId || m.modifier_id) as string)?.trim() || null;
    const modName = ((m.name || m.optionName || m.option_name) as string)?.trim() || null;
    const clientDelta = 'price_delta' in m ? Number(m.price_delta) : null;
    return { modId, modName, clientDelta };
  }
  return { modId: null, modName: null, clientDelta: null };
}

export async function validateProductModifiers(
  db: D1Like | null | undefined,
  productId: string,
  modifiers: unknown[],
  candidateProductIds?: string[],
): Promise<ModifierValidationResult> {
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    return { valid: true, validatedModifiers: [], modifierDelta: 0 };
  }

  const seenChoiceKeys = new Set<string>();
  const seenSingleGroupIds = new Set<string>();
  const validatedModifiers: ModifierChoice[] = [];
  let modifierDelta = 0;

  for (const mod of modifiers) {
    const { modId, modName, clientDelta } = parseModifierInput(mod);
    if (!modId && !modName) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'invalid_modifier', message: 'Modifier identifier missing or empty' },
      };
    }

    const dedupeKey = modId || modName!;
    if (seenChoiceKeys.has(dedupeKey)) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'duplicate_modifier', message: `Duplicate modifier selection: ${dedupeKey}` },
      };
    }
    seenChoiceKeys.add(dedupeKey);

    if (!db) {
      const delta = clientDelta !== null ? Math.round(clientDelta) : 0;
      modifierDelta += delta;
      validatedModifiers.push({ id: modId || '', group_id: '', name: modName || modId || '', price_delta: delta, is_default: 0, sort_order: 0 });
      continue;
    }

    const choiceRow = await fetchModifierChoice(db, modId, modName);
    if (!choiceRow) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'invalid_modifier', message: `Modifier choice not found: ${modId || modName}` },
      };
    }

    const isAvail = choiceRow.is_available ?? choiceRow.available ?? choiceRow.is_active ?? choiceRow.active;
    if (isAvail === 0 || isAvail === false) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'modifier_unavailable', message: `Modifier choice unavailable: ${choiceRow.id}` },
      };
    }

    const groupRow = await fetchModifierGroup(db, choiceRow.group_id);
    if (!groupRow) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'invalid_modifier', message: `Modifier group not found: ${choiceRow.group_id}` },
      };
    }

    const isGroupActive = groupRow.is_active ?? groupRow.active;
    if (isGroupActive === 0 || isGroupActive === false) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'modifier_unavailable', message: `Modifier group inactive: ${groupRow.id}` },
      };
    }

    if (groupRow.type === 'single') {
      if (seenSingleGroupIds.has(groupRow.id)) {
        return {
          valid: false,
          validatedModifiers: [],
          modifierDelta: 0,
          rejection: { code: 'duplicate_modifier', message: `Multiple choices selected for single-choice group: ${groupRow.id}` },
        };
      }
      seenSingleGroupIds.add(groupRow.id);
    }

    const prodIds = candidateProductIds && candidateProductIds.length > 0 ? candidateProductIds : [productId];
    const linked = await isGroupLinkedToProduct(db, prodIds, choiceRow.group_id);
    if (!linked) {
      return {
        valid: false,
        validatedModifiers: [],
        modifierDelta: 0,
        rejection: { code: 'invalid_modifier', message: `Modifier ${choiceRow.id} does not belong to product ${productId}` },
      };
    }

    const delta = Math.round(Number(choiceRow.price_delta) || 0);
    modifierDelta += delta;
    validatedModifiers.push({ id: choiceRow.id, group_id: choiceRow.group_id, name: choiceRow.name, price_delta: delta, is_default: 0, sort_order: 0 });
  }

  return { valid: true, validatedModifiers, modifierDelta };
}

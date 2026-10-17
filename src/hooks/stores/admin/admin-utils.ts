/**
 * Shared admin store & fetch utilities.
 */

export function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('aura_auth_token') : null;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Ignore storage access restrictions
  }
  return {};
}

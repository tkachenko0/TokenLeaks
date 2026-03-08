// @ts-check

/**
 * Recursively searches an object or array for the first string value
 * that starts with the given query.
 *
 * Supports deep nested objects, arrays, and avoids infinite loops
 * caused by circular references.
 *
 * @param {any} obj - The object or array to search through.
 * @param {string} query - The string prefix to search for.
 * @param {string} [path=""] - The current path in the object (used internally for recursion).
 * @param {WeakSet<object>} [seen=new WeakSet()] - Tracks visited objects to avoid circular references.
 */
function digJs(obj, query, path = "", seen = new WeakSet()) {
  if (!obj || typeof obj !== "object") return undefined;

  if (seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = digJs(obj[i], query, `${path}[${i}]`, seen);
      if (found) return found;
    }
    return undefined;
  }

  for (const key in obj) {
    const value = obj[key];
    const newPath = path ? `${path}.${key}` : key;

    if (typeof value === "string" && value.startsWith(query)) {
      return { path: newPath, value, key };
    }

    if (value && typeof value === "object") {
      const found = digJs(value, query, newPath, seen);
      if (found) return found;
    }
  }

  return undefined;
}

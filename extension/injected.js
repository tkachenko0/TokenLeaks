/** @typedef {{ path: string, value: string, key: string }} DigResult */

/**
 * @param {Record<string, any>} obj
 * @param {string} query
 * @param {string} [path]
 * @param {WeakSet<object>} [seen]
 * @param {DigResult[]} [results]
 * @returns {DigResult[]}
 */
function digJs(obj, query, path = "", seen = new WeakSet(), results = []) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return results;
  seen.add(obj);

  /** @type {RegExp} */
  let re;
  try { re = new RegExp(query); } catch { return results; }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++)
      digJs(obj[i], query, `${path}[${i}]`, seen, results);
    return results;
  }

  for (const key in obj) {
    const value = obj[key];
    const newPath = /^\d+$/.test(key)
      ? `${path}[${key}]`
      : path
        ? `${path}.${key}`
        : key;
    if (typeof value === "string" && re.test(value))
      results.push({ path: newPath, value, key });
    else if (value && typeof value === "object")
      digJs(value, query, newPath, seen, results);
  }
  return results;
}

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "DIG_JS") return;

  const query = e.data.query;
  // digJs traverses the entire window tree, which includes this event object.
  // Without deleting, event.data.query would match the search term itself.
  delete e.data.query;
  const results = digJs(window, query);
  e.ports[0].postMessage(results.length ? results : null);
});

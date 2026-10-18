// Las categorías fijas del ecosistema, con sus etiquetas. El usuario añade las suyas en
// Ajustes (van al almacén, ver repo.js); las fijas no se borran, solo se dejan de usar.
// `kind` dice para qué tipo de movimiento sirve.

export const DEFAULT_CATEGORIES = Object.freeze([
  { key: 'food', kind: 'expense', icon: '🍽️', label: { es: 'Comida', en: 'Food' } },
  { key: 'groceries', kind: 'expense', icon: '🛒', label: { es: 'Mercado', en: 'Groceries' } },
  { key: 'transport', kind: 'expense', icon: '🚕', label: { es: 'Transporte', en: 'Transport' } },
  { key: 'home', kind: 'expense', icon: '🏠', label: { es: 'Casa y arriendo', en: 'Home and rent' } },
  { key: 'utilities', kind: 'expense', icon: '💡', label: { es: 'Servicios básicos', en: 'Utilities' } },
  { key: 'health', kind: 'expense', icon: '🩺', label: { es: 'Salud', en: 'Health' } },
  { key: 'education', kind: 'expense', icon: '📚', label: { es: 'Educación', en: 'Education' } },
  { key: 'leisure', kind: 'expense', icon: '🎉', label: { es: 'Ocio', en: 'Leisure' } },
  { key: 'shopping', kind: 'expense', icon: '🛍️', label: { es: 'Compras', en: 'Shopping' } },
  { key: 'subscriptions', kind: 'expense', icon: '🔁', label: { es: 'Suscripciones', en: 'Subscriptions' } },
  { key: 'debt', kind: 'expense', icon: '🏦', label: { es: 'Deudas y tarjetas', en: 'Debt and cards' } },
  { key: 'other-expense', kind: 'expense', icon: '📦', label: { es: 'Otros gastos', en: 'Other expenses' } },
  { key: 'salary', kind: 'income', icon: '💼', label: { es: 'Sueldo', en: 'Salary' } },
  { key: 'freelance', kind: 'income', icon: '🧑‍💻', label: { es: 'Trabajos', en: 'Freelance' } },
  { key: 'sales', kind: 'income', icon: '🏷️', label: { es: 'Ventas', en: 'Sales' } },
  { key: 'gifts', kind: 'income', icon: '🎁', label: { es: 'Regalos', en: 'Gifts' } },
  { key: 'other-income', kind: 'income', icon: '💰', label: { es: 'Otros ingresos', en: 'Other income' } },
])

export const FALLBACK = Object.freeze({ expense: 'other-expense', income: 'other-income' })

/** Fijas + propias, en ese orden; una propia con la misma clave que una fija la reemplaza. */
export function allCategories (custom = []) {
  const byKey = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, c]))
  for (const c of custom) byKey.set(c.key, c)
  return [...byKey.values()]
}

export function categoryLabel (category, lang) {
  if (!category) return ''
  const label = category.label
  if (typeof label === 'string') return label
  return label?.[lang] || label?.es || label?.en || category.key
}

export function findCategory (key, custom = []) {
  return allCategories(custom).find((c) => c.key === key) || null
}

/** Clave para una categoría propia: minúsculas, sin acentos ni espacios. */
export function slugify (name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

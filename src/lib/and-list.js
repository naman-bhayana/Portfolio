// "A", "A and B", "A, B and C": a list as a sentence says it, in British style (no serial comma).
export const andList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

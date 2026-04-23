export const normalizeForMatch = (value = '', options = {}) => {
    const trim = options.trim ?? true
    const normalized = String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    return trim ? normalized.trim() : normalized
}

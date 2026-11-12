export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const number = Number.parseInt(normalized, 16)
  if (!Number.isFinite(number)) return `rgba(116, 81, 166, ${alpha})`
  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function textColorFor(hex: string): string {
  const value = hex.replace('#', '')
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const number = Number.parseInt(normalized, 16)
  if (!Number.isFinite(number)) return '#FFFFFF'
  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? '#3A2A50' : '#FFFFFF'
}

export function find<T extends object>(array: T[], match: Partial<T>) {
  const keys = Object.keys(match) as (keyof T)[];
  for (let i = 0; i < array.length; i++) {
    const obj = array[i];
    let isMatch = true;
    for (let v of keys) {
      if (obj[v] != match[v]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      return i;
    }
  }
  return -1;
}

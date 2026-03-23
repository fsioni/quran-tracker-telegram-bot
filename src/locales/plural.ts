export interface ArabicPluralForms {
  few?: string;
  many?: string;
  one: string;
  other: string;
  two?: string;
  zero?: string;
}

export function arPlural(count: number, forms: ArabicPluralForms): string {
  if (count === 0 && forms.zero) {
    return forms.zero;
  }
  if (count === 1) {
    return forms.one;
  }
  if (count === 2 && forms.two) {
    return forms.two;
  }
  const mod100 = count % 100;
  if (mod100 >= 3 && mod100 <= 10 && forms.few) {
    return forms.few;
  }
  if (mod100 >= 11 && forms.many) {
    return forms.many;
  }
  return forms.other;
}

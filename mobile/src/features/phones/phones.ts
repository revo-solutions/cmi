import type { Phone } from '../../content';

export type PhoneCategory = { name: string; emergency: boolean; phones: Phone[] };

// Categories in the file's order, the ones with an emergency number first.
export function phoneCategories(phones: Phone[]): PhoneCategory[] {
  const categories: PhoneCategory[] = [];
  for (const phone of phones) {
    let category = categories.find((c) => c.name === phone.category);
    if (!category) {
      category = { name: phone.category, emergency: false, phones: [] };
      categories.push(category);
    }
    category.phones.push(phone);
    category.emergency ||= phone.emergency;
  }
  return [...categories.filter((c) => c.emergency), ...categories.filter((c) => !c.emergency)];
}

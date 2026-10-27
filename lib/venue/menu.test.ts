/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { dishesByCourse, extraLine, extraPriceWords, menuDetails, menuOf, platesFor, validateMenu } from './menu';

describe('catering menus', () => {
  test('dishes by course and extras are cleaned; empty rows are dropped', () => {
    const r = validateMenu({
      dishes: [{ course: ' Starters ', name: 'Paneer  tikka' }, { course: '', name: 'Dal makhani' }, { course: 'Starters', name: '' }],
      extras: [{ name: 'Live chaat counter', price: '₹1,20', perPlate: true }, { name: 'Paan counter', price: '5000', perPlate: false }, { name: '', price: '' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.dishes).toEqual([{ course: 'Starters', name: 'Paneer tikka' }, { course: 'Main course', name: 'Dal makhani' }]);
    expect(r.value.extras).toEqual([{ name: 'Live chaat counter', price: 120, perPlate: true }, { name: 'Paan counter', price: 5000, perPlate: false }]);
  });

  test('an extra needs a real price; limits hold', () => {
    const r = validateMenu({ extras: [{ name: 'Mocktails', price: 'free' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['extras.0.price']).toBeDefined();
    const many = validateMenu({ dishes: Array.from({ length: 81 }, (_, i) => ({ course: 'Main', name: `Dish ${i}` })) });
    expect(many.ok).toBe(false);
  });

  test('a stored menu is read back safely', () => {
    expect(menuOf(null)).toBeNull();
    expect(menuOf({ dishes: 'nonsense' })).toBeNull();
    expect(menuOf({ dishes: [{ course: 'Desserts', name: 'Gulab jamun' }] })?.dishes).toHaveLength(1);
  });

  test('the dish list frozen on a quotation line: one line per course, in serving order as typed, diet first', () => {
    const menu = { dishes: [{ course: 'Starters', name: 'Paneer tikka' }, { course: 'Main course', name: 'Dal makhani' }, { course: 'starters', name: 'Hara bhara kabab' }] };
    expect(dishesByCourse(menu)).toEqual([{ course: 'Starters', dishes: ['Paneer tikka', 'Hara bhara kabab'] }, { course: 'Main course', dishes: ['Dal makhani'] }]);
    expect(menuDetails(menu, 'VEG')).toBe('Veg\nStarters: Paneer tikka, Hara bhara kabab\nMain course: Dal makhani');
    expect(menuDetails(menu, null).startsWith('Starters')).toBe(true);
  });

  test('food is per guest: plates start at the enquiry\'s guest count', () => {
    expect(platesFor(350)).toBe(350);
    expect(platesFor(null)).toBe(1);
    expect(platesFor(0)).toBe(1);
    expect(extraLine('Veg Wedding Menu', { name: 'Live chaat counter', price: 120, perPlate: true }, 350)).toEqual({ description: 'Live chaat counter (with Veg Wedding Menu)', quantity: 350, unitPrice: 120 });
    expect(extraLine('Veg Wedding Menu', { name: 'Paan counter', price: 5000, perPlate: false }, 350).quantity).toBe(1);
    expect(extraPriceWords({ price: 5000, perPlate: false })).toBe('₹5,000');
  });
});

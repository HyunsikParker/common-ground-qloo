import { AppError } from './errors.js';

export function publicArea(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > 100 || /[\u0000-\u001f\u007f@]|\d{9,}/.test(value)) {
    throw new AppError('invalid_area', 'Choose a public city or neighborhood without contact details.');
  }
  return value.trim();
}

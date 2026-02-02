import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import { ko } from './ko';
import type { Language, Translations } from '../types';

export const translations: Record<Language, Translations> = {
  en,
  zh,
  ja,
  ko,
};

/**
 * @file CatalogDataset.js
 * @description Mega-Dataset de partituras y Letras con Acordes Reales, Oficiales y Completos.
 * Consolida los módulos de catálogo desacoplados por géneros musicales.
 */

import { POP_CATALOG } from './catalog/PopCatalog.js';
import { ROCK_CATALOG } from './catalog/RockCatalog.js';
import { ACOUSTIC_CATALOG } from './catalog/AcousticCatalog.js';

export const MEGA_CATALOG = [
  ...ACOUSTIC_CATALOG,
  ...ROCK_CATALOG,
  ...POP_CATALOG
];

export default MEGA_CATALOG;

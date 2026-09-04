/**
 * The file axis.
 *
 * Kept separate from boardUtils so that topology.ts can use it without the two
 * modules importing each other.
 */

import type { File } from '../types';

/**
 * Files a..x. Rectangular boards use at most the first 12; the 3-player board
 * lays three 8-file sections end to end and uses all 24.
 */
export const FILES: File[] = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
  'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
  'q', 'r', 's', 't', 'u', 'v', 'w', 'x',
];

export function fileToIndex(file: File): number {
  return FILES.indexOf(file);
}

export function indexToFile(index: number): File | null {
  if (index < 0 || index >= FILES.length) return null;
  return FILES[index];
}

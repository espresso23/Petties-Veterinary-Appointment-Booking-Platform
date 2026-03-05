/**
 * Pet Types - Frontend type definitions
 */

/**
 * Pet species enum (matches backend PetSpecies enum)
 */
export type PetSpecies = 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'HAMSTER' | 'FISH' | 'OTHER';

/**
 * Pet species labels in Vietnamese
 */
export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: 'Chó',
  CAT: 'Mèo',
  BIRD: 'Chim',
  RABBIT: 'Thỏ',
  HAMSTER: 'Chuột Hamster',
  FISH: 'Cá',
  OTHER: 'Khác',
};

/**
 * Pet interface
 */
export interface Pet {
  petId: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  age?: string;
  weight?: number;
  photoUrl?: string;
}

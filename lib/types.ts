export type Category =
  | "Spirits" | "Transformations" | "Spells"
  | "Weapons" | "Armor" | "Curios" | "Vessels"
  | "Gourds" | "Drinks" | "Soaks" | "Seeds"
  | "MeditationSpots" | "Formulas";

export type Chapter = 1|2|3|4|5|6|"Secret"|"NG+";

export interface Item {
  id: string;
  name: string;
  category: Category;
  chapter?: Chapter;
  rarity?: "Common"|"Rare"|"Legendary"|"Mythical"|"Epic";
  missable?: boolean;
  ngPlusOnly?: boolean;
  dlc?: boolean;
  description?: string;
  howToGet?: string;
  notes?: string;
  sources?: string[];
}



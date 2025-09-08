"use client";

import expectedCountsJson from "@/data/expectedCounts.json";
import spirits from "@/data/categories/Spirits.json";
import transformations from "@/data/categories/Transformations.json";
import spells from "@/data/categories/Spells.json";
import weapons from "@/data/categories/Weapons.json";
import arms from "@/data/categories/Arms.json";
import body from "@/data/categories/Body.json";
import legs from "@/data/categories/Legs.json";
import headgear from "@/data/categories/Headgear.json";
import curios from "@/data/categories/Curios.json";
import vessels from "@/data/categories/Vessels.json";
import gourds from "@/data/categories/Gourds.json";
import drinks from "@/data/categories/Drinks.json";
import soaks from "@/data/categories/Soaks.json";
import seeds from "@/data/categories/Seeds.json";
import meditation from "@/data/categories/MeditationSpots.json";
import formulas from "@/data/categories/Formulas.json";
import yaoguaiKings from "@/data/categories/YaoguaiKings.json";
import yaoguaiChiefs from "@/data/categories/YaoguaiChiefs.json";
import characters from "@/data/categories/Characters.json";
import { Item, Category } from "./types";
import { useState } from "react";

type ExpectedCounts = Record<Category, number>;

interface DataBundle {
  expectedCounts: ExpectedCounts;
  items: Item[];
}

const expectedCounts = expectedCountsJson as ExpectedCounts;
const allItems: Item[] = [
  ...((spirits as Item[]) ?? []),
  ...((transformations as Item[]) ?? []),
  ...((spells as Item[]) ?? []),
  ...((weapons as Item[]) ?? []),
  ...((arms as Item[]) ?? []),
  ...((body as Item[]) ?? []),
  ...((legs as Item[]) ?? []),
  ...((headgear as Item[]) ?? []),
  ...((curios as Item[]) ?? []),
  ...((vessels as Item[]) ?? []),
  ...((gourds as Item[]) ?? []),
  ...((drinks as Item[]) ?? []),
  ...((soaks as Item[]) ?? []),
  ...((seeds as Item[]) ?? []),
  ...((meditation as Item[]) ?? []),
  ...((formulas as Item[]) ?? []),
  ...((yaoguaiKings as Item[]) ?? []),
  ...((yaoguaiChiefs as Item[]) ?? []),
  ...((characters as Item[]) ?? []),
].map((it) => ({
  ...it,
  id: it.id || `${it.category}-${it.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
}));

const memory: DataBundle = { expectedCounts, items: allItems };

export function useData() {
  const [bundle, setBundle] = useState(memory);

  const addBulkItems = (category: Category, names: string[]) => {
    const additions = names.map((name) => ({
      id: `${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name,
      category,
    }));
    setBundle((b) => ({ ...b, items: [...b.items, ...additions] }));
  };

  return { ...bundle, addBulkItems };
}



// Seed catalog for The Right Choice, parsed from FEATURE_LIST.md.
// IDs are stable strings so entry IDs (`${sessionId}:${itemId}`) stay
// deterministic across devices. Swap this file when the real Excel arrives.

export type SeedCategory = { id: string; name: string; sortOrder: number };
export type SeedItem = { id: string; name: string; categoryId: string; sortOrder: number };

export const CATEGORIES: SeedCategory[] = [
  { id: "cat-drinks", name: "Drinks & Water", sortOrder: 1 },
  { id: "cat-icecream", name: "Ice Cream, Yoghurt & Parfait", sortOrder: 2 },
  { id: "cat-provisions", name: "Provisions, Biscuits & Sweets", sortOrder: 3 },
  { id: "cat-breads", name: "Breads & Snacks", sortOrder: 4 },
  { id: "cat-other", name: "Other", sortOrder: 5 },
];

// Item names grouped by category, in display order.
const ITEM_NAMES: Record<string, string[]> = {
  "cat-drinks": [
    "Drinks", "Water", "Cway", "Energy Drink", "Viju Choco", "Viju Wheat",
    "Maltina Pet", "Lucozade Boost", "Flying Fish", "Exotic Big", "Exotic Midi",
    "Exotic Can", "Can Drinks", "Can Schweppes", "Can Farouz", "Can Malt",
    "Smirnoff Ice", "Monster", "Smooth/Origin", "Bullet", "Pocari Sweat",
    "Dudu Juice", "Sosa",
  ],
  "cat-icecream": [
    "Fan Ice Cream 1Ltr", "Fan Ice Cream 450ml", "Fan Ice Cream 250ml",
    "Fan Ice Cream 120ml", "Fan Ice Cream Vanilla Sachet", "Fan Ice Cream Chips",
    "Supreme 1Ltr", "Supreme 450ml", "Supreme 120ml", "Supreme Sachet",
    "Frosty Bites 1Ltr", "Frosty Bites 500ml", "Frosty Bites 250ml", "Frosty Bites Popsicles",
    "Hollandia Big", "Hollandia Midi",
    "Habib 1Ltr", "Habib 500ml", "Habib Big Cup", "Habib Bottle",
    "Rufaidah 1Ltr", "Rufaidah Big Cup", "Rufaidah Small Cup", "Rufaidah Bottle",
    "Viju Yoghurt", "RC Yoghurt", "Yoghurt Parfait", "Cake Parfait",
    "Farmfresh 1Ltr", "Farmfresh 500ml", "Farmfresh Greek",
    "Refresh 1Ltr", "Refresh 500ml", "Vita Milk", "Fura",
  ],
  "cat-provisions": [
    "Milo Refill", "Milo Sachet", "Peak Sachet", "3 Crown Sachet", "Evap Liquid",
    "Cashew Nut", "Shortbread Big", "Munchkins",
    "Mentos Chupa Belt", "Mentos Chupa", "Mentos Long", "Mentos Short",
    "Mentos Sachet 350", "Mentos Sweet 350", "Mentos Gum 200",
    "Centre Fresh", "Alpenliebe Big 350", "Alpenliebe Small 100", "3sis Lmilo",
  ],
  "cat-breads": [
    "Chopmore", "Coconut Bread", "Super Roll", "Gala", "Plantain Chips",
    "Chin Chin", "Local Snacks", "Bounty", "So Soft Family",
  ],
  "cat-other": ["S. Cup"],
};

function buildItems(): SeedItem[] {
  const items: SeedItem[] = [];
  let n = 0;
  for (const cat of CATEGORIES) {
    const names = ITEM_NAMES[cat.id] ?? [];
    names.forEach((name, i) => {
      n += 1;
      items.push({
        id: `itm-${String(n).padStart(3, "0")}`,
        name,
        categoryId: cat.id,
        sortOrder: i + 1,
      });
    });
  }
  return items;
}

export const ITEMS: SeedItem[] = buildItems();

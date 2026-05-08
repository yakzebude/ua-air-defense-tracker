import Papa from "papaparse";

export type WeaponCategory =
  | "UAV"
  | "ballistic missile"
  | "cruise missile"
  | "guided bomb"
  | "surface-to-air missile"
  | "surface-to-air and ballistic";

export interface Weapon {
  model: string;
  category: string;
  national_origin: string;
  type: string;
  launch_platform: string;
  name: string;
  name_NATO: string;
  in_sevice: string;
  designer: string;
  manufacturer: string;
  guidance_system: string;
  unit_cost: string;
}

export async function loadWeaponsCatalog(url = "/data/weapons_catalog.csv"): Promise<Weapon[]> {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse<Weapon>(text, { header: true, skipEmptyLines: true });
  return parsed.data
    .filter((r) => r && r.model && !r.model.includes(" and "))
    .map((r) => ({
      model: (r.model || "").trim(),
      category: (r.category || "").trim(),
      national_origin: (r.national_origin || "").trim(),
      type: (r.type || "").trim(),
      launch_platform: (r.launch_platform || "").trim(),
      name: (r.name || "").trim(),
      name_NATO: (r.name_NATO || "").trim(),
      in_sevice: (r.in_sevice || "").trim(),
      designer: (r.designer || "").trim(),
      manufacturer: (r.manufacturer || "").trim(),
      guidance_system: (r.guidance_system || "").trim(),
      unit_cost: (r.unit_cost || "").trim(),
    }));
}

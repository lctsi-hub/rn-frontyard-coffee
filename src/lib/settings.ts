import { localStoreSettings } from "@/data/store-settings";
import type { StoreSettings } from "@/types/order";

/** Single entry point for store settings; switches to the database later. */
export async function getStoreSettings(): Promise<StoreSettings> {
  return localStoreSettings;
}

// Static store identity. Moves to the `store_settings` table once the database
// is connected, so the admin can edit it without a redeploy.
export const STORE = {
  name: "RN Frontyard Coffee",
  shortName: "Frontyard",
  orderNumberPrefix: "RN",
  location: {
    barangay: "Lourdes",
    municipality: "Candaba",
    province: "Pampanga",
    country: "Philippines",
  },
} as const;

export const STORE_LOCATION_LABEL = `${STORE.location.barangay}, ${STORE.location.municipality}, ${STORE.location.province}`;

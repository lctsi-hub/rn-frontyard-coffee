import "server-only";

// Server side of "+ Add Item" on an existing order. Checks the staff session,
// rebuilds the item and its price from the menu (sold-out switches applied),
// then lets the database append it to the same order in one transaction
// (add_order_item: same RN number, same table, totals updated, audit row).
import { getAdminSession } from "@/lib/auth/admin";
import { getMenu } from "@/lib/menu";
import { createSupabaseServiceClient, isSecretKeyConfigured } from "@/lib/supabase/service";
import { addItemError, addItemErrorFromDatabase, buildStaffAddition, type AddItemError } from "./staff-items";

export type AddItemResult =
  | {
      ok: true;
      orderNumber: string;
      tableNumber: number | null;
      description: string;
      addedAmount: number;
      previousTotal: number;
      newTotal: number;
      isNew: boolean;
    }
  | AddItemError;

/** `input` comes straight from the browser and is treated as untrusted. */
export async function addOrderItem(input: unknown): Promise<AddItemResult> {
  const session = await getAdminSession();
  if (!session || session === "not_admin") return addItemError("not_authorized");
  if (!isSecretKeyConfigured()) return addItemError("not_connected");

  const built = buildStaffAddition(input, await getMenu());
  if (!built.ok) return built;
  const { orderId, requestId, item } = built.value;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("add_order_item", {
    p_order_id: orderId,
    p_request_id: requestId,
    p_admin_id: session.userId, // verified above; re-checked against admin_users in the database
    p_item: item,
  });
  if (error) {
    const mapped = addItemErrorFromDatabase(error.message, error.code);
    if (mapped.code === "server_error") console.error("[addOrderItem] add_order_item failed", { code: error.code });
    return mapped;
  }

  const row = data?.[0];
  if (!row) return addItemError("server_error");
  return {
    ok: true,
    orderNumber: row.order_number,
    tableNumber: row.table_number,
    description: row.description,
    addedAmount: Number(row.added_amount),
    previousTotal: Number(row.previous_total),
    newTotal: Number(row.new_total),
    isNew: row.is_new,
  };
}

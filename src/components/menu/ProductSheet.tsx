"use client";

import { Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { formatPeso } from "@/lib/format";
import { startingPrice } from "@/lib/menu-display";
import {
  findMissingChoices,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  priceItem,
  type ItemSelection,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { cartActions, type CartLine } from "@/stores/cart";
import type { Product } from "@/types/menu";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useMenuIndex } from "./MenuProvider";
import { ProductArt } from "./ProductArt";
import { ProductBadges } from "./ProductBadges";

type SheetTarget = { productId: string; line?: CartLine; openedAt: number };

type SheetActions = {
  openProduct: (productId: string) => void;
  editLine: (line: CartLine) => void;
};

const SheetContext = createContext<SheetActions | null>(null);

export function useProductSheet() {
  const actions = useContext(SheetContext);
  if (!actions) throw new Error("useProductSheet must be used inside <ProductSheetProvider>");
  return actions;
}

/** Hosts the single product bottom sheet used by the menu and the cart. */
export function ProductSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<SheetTarget | null>(null);

  const actions = useMemo<SheetActions>(
    () => ({
      openProduct: (productId) => setTarget({ productId, openedAt: Date.now() }),
      editLine: (line) => setTarget({ productId: line.productId, line, openedAt: Date.now() }),
    }),
    [],
  );
  const handleClosed = useCallback(() => setTarget(null), []);

  return (
    <SheetContext value={actions}>
      {children}
      {target && <ProductSheet key={target.openedAt} target={target} onClosed={handleClosed} />}
    </SheetContext>
  );
}

const CLOSE_ANIMATION_MS = 240;

function ProductSheet({ target, onClosed }: { target: SheetTarget; onClosed: () => void }) {
  const index = useMenuIndex();
  const product = index.products.get(target.productId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      dialogRef.current?.close();
      onClosed();
    }, CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [closing, onClosed]);

  if (!product) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="product-sheet-title"
      data-closing={closing || undefined}
      className="sheet"
      onCancel={(event) => {
        // Esc / Android back: animate out instead of vanishing.
        event.preventDefault();
        setClosing(true);
      }}
      onClose={onClosed}
      onClick={(event) => {
        if (event.target === event.currentTarget) setClosing(true);
      }}
    >
      <SheetBody
        product={product}
        categorySlug={index.categorySlugs.get(product.categoryId) ?? ""}
        line={target.line}
        onDone={() => setClosing(true)}
      />
    </dialog>
  );
}

function initialSelection(product: Product): ItemSelection {
  return {
    productId: product.id,
    sizeId: product.sizes.length === 1 ? product.sizes[0].id : null,
    optionIds: product.variantGroups.flatMap((g) => (g.defaultOptionId ? [g.defaultOptionId] : [])),
    addonIds: [],
    quantity: 1,
    notes: "",
  };
}

function SheetBody({
  product,
  categorySlug,
  line,
  onDone,
}: {
  product: Product;
  categorySlug: string;
  line?: CartLine;
  onDone: () => void;
}) {
  const index = useMenuIndex();
  const initial = line ?? initialSelection(product);
  const [sizeId, setSizeId] = useState(initial.sizeId);
  const [optionIds, setOptionIds] = useState(initial.optionIds);
  const [addonIds, setAddonIds] = useState(initial.addonIds);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [notes, setNotes] = useState(initial.notes);
  const [showErrors, setShowErrors] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const selection: ItemSelection = { productId: product.id, sizeId, optionIds, addonIds, quantity, notes };
  const missing = findMissingChoices(product, selection);
  const errorFor = (key: string) => (showErrors ? missing.find((p) => p.key === key)?.message : undefined);
  const priced = priceItem(index, selection);
  const productAddons = product.addonIds.flatMap((id) => index.addons.get(id) ?? []);
  const isEditing = Boolean(line);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!product.isAvailable) return;
    if (missing.length > 0) {
      setShowErrors(true);
      setShakeKey((k) => k + 1);
      document.getElementById(`choice-${missing[0].key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (line) cartActions.update(line.lineId, selection);
    else cartActions.add(selection);
    onDone();
  }

  return (
    <form onSubmit={submit} className="sheet-panel flex flex-col overflow-hidden rounded-t-[2rem] bg-cream">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative">
          <button
            type="button"
            onClick={onDone}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-full bg-foam/90 text-espresso shadow-card backdrop-blur transition-transform active:scale-90"
          >
            <X className="size-5" strokeWidth={2.5} />
          </button>
          <span aria-hidden="true" className="pointer-events-none absolute top-2 left-1/2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-espresso/25" />
          <ProductArt
            imageUrl={product.imageUrl}
            name={product.name}
            categorySlug={categorySlug}
            sizes="(max-width: 448px) 100vw, 448px"
            className={cn("w-full", product.imageUrl ? "aspect-[4/3]" : "aspect-[16/9]")}
          />
        </div>

        <div className="px-5 pt-5 pb-6">
          <ProductBadges product={product} className="mb-2" />
          {isEditing && <p className="eyebrow mb-1 text-caramel">Editing item</p>}
          <h2 id="product-sheet-title" className="font-display text-[1.75rem] leading-tight font-semibold break-words">
            {product.name}
          </h2>
          <p className="mt-2 leading-relaxed text-mocha">{product.description}</p>
          <p className="mt-2 font-semibold tabular-nums">
            {product.sizes.length > 1 && <span className="mr-1 text-sm font-medium text-mocha">from</span>}
            {formatPeso(startingPrice(product))}
          </p>

          {product.sizes.length > 1 && (
            <ChoiceGroup
              id="size"
              title="Size"
              required
              done={Boolean(sizeId)}
              error={errorFor("size")}
              shakeKey={shakeKey}
            >
              <div className="grid grid-cols-2 gap-2">
                {product.sizes.map((size) => (
                  <label key={size.id} className={optionCard}>
                    <input
                      type="radio"
                      name="size"
                      value={size.id}
                      checked={sizeId === size.id}
                      onChange={() => setSizeId(size.id)}
                      className="sr-only"
                    />
                    <span className="font-semibold">{size.name}</span>
                    <span className="text-sm tabular-nums opacity-80">{formatPeso(size.price)}</span>
                  </label>
                ))}
              </div>
            </ChoiceGroup>
          )}

          {product.variantGroups.map((group) => {
            const chosen = group.options.find((o) => optionIds.includes(o.id));
            return (
              <ChoiceGroup
                key={group.id}
                id={group.id}
                title={group.name}
                required={group.required}
                done={Boolean(chosen)}
                error={errorFor(group.id)}
                shakeKey={shakeKey}
              >
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => (
                    <label key={option.id} className={optionChip}>
                      <input
                        type="radio"
                        name={group.id}
                        value={option.id}
                        checked={chosen?.id === option.id}
                        onChange={() =>
                          setOptionIds((ids) => [...ids.filter((id) => !group.options.some((o) => o.id === id)), option.id])
                        }
                        className="sr-only"
                      />
                      {option.name}
                      {option.priceDelta > 0 && (
                        <span className="text-sm tabular-nums opacity-75">+{formatPeso(option.priceDelta)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </ChoiceGroup>
            );
          })}

          {productAddons.length > 0 && (
            <ChoiceGroup id="addons" title="Add-ons" hint="Optional">
              <div className="flex flex-col gap-2">
                {productAddons.map((addon) => (
                  <label
                    key={addon.id}
                    className={cn(
                      "group flex min-h-14 items-center gap-3 rounded-2xl bg-foam px-4 py-2 ring-1 ring-espresso/10 transition-colors has-checked:ring-2 has-checked:ring-espresso has-focus-visible:outline-3 has-focus-visible:outline-caramel",
                      addon.isAvailable ? "cursor-pointer active:bg-oat/60" : "opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={addonIds.includes(addon.id)}
                      disabled={!addon.isAvailable}
                      onChange={(e) =>
                        setAddonIds((ids) => (e.target.checked ? [...ids, addon.id] : ids.filter((id) => id !== addon.id)))
                      }
                      className="sr-only"
                    />
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg ring-2 ring-espresso/25 transition-colors group-has-checked:bg-espresso group-has-checked:ring-espresso">
                      <Check className="size-4 text-foam opacity-0 group-has-checked:opacity-100" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{addon.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-mocha">
                      {addon.isAvailable ? `+${formatPeso(addon.price)}` : "Unavailable"}
                    </span>
                  </label>
                ))}
              </div>
            </ChoiceGroup>
          )}

          <div className="mt-7">
            <label htmlFor="item-notes" className="flex items-baseline justify-between">
              <span className="font-semibold">Special instructions</span>
              <span className="text-xs text-mocha">Optional</span>
            </label>
            <textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_NOTES_LENGTH}
              rows={2}
              placeholder="e.g. less ice, no straw, extra hot"
              className="mt-2 w-full resize-none rounded-2xl bg-foam px-4 py-3 text-base ring-1 ring-espresso/10 placeholder:text-mocha/70 focus:ring-2 focus:ring-espresso focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-mocha tabular-nums">
              {notes.length}/{MAX_NOTES_LENGTH}
            </p>
          </div>
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-espresso/10 bg-foam px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <QuantityStepper value={quantity} max={MAX_QUANTITY} onChange={setQuantity} label="Quantity" />
        <button
          type="submit"
          disabled={!product.isAvailable}
          className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-espresso px-4 font-semibold text-foam shadow-lift transition-transform duration-150 active:scale-[0.97] disabled:bg-espresso/40 disabled:shadow-none"
        >
          {!product.isAvailable ? (
            "Sold out"
          ) : (
            <>
              <span className="truncate">{isEditing ? "Update item" : "Add to cart"}</span>
              {missing.length === 0 && priced && (
                <span key={priced.lineTotal} className="animate-pop shrink-0 tabular-nums">
                  · {formatPeso(priced.lineTotal)}
                </span>
              )}
            </>
          )}
        </button>
      </footer>
    </form>
  );
}

const optionCard =
  "flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl bg-foam px-4 py-2 ring-1 ring-espresso/10 transition-[background-color,color,transform] duration-150 active:scale-[0.97] has-checked:bg-espresso has-checked:text-foam has-checked:ring-espresso has-focus-visible:outline-3 has-focus-visible:outline-caramel";

const optionChip =
  "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-foam px-4 font-medium ring-1 ring-espresso/10 transition-[background-color,color,transform] duration-150 active:scale-95 has-checked:bg-espresso has-checked:text-foam has-checked:ring-espresso has-focus-visible:outline-3 has-focus-visible:outline-caramel";

function ChoiceGroup({
  id,
  title,
  required,
  hint,
  done,
  error,
  shakeKey,
  children,
}: {
  id: string;
  title: string;
  required?: boolean;
  hint?: string;
  done?: boolean;
  error?: string;
  shakeKey?: number;
  children: ReactNode;
}) {
  const headingId = `choice-${id}-title`;
  return (
    <div
      id={`choice-${id}`}
      role={id === "addons" ? "group" : "radiogroup"}
      aria-labelledby={headingId}
      aria-describedby={error ? `choice-${id}-error` : undefined}
      className="mt-7 scroll-mt-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={headingId} className="font-semibold">
          {title}
        </h3>
        {required ? (
          done ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-coffee">
              <Check className="size-3.5" strokeWidth={3} /> Selected
            </span>
          ) : (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide uppercase",
                error ? "bg-berry text-foam" : "bg-oat text-coffee",
              )}
            >
              Required
            </span>
          )
        ) : (
          hint && <span className="text-xs text-mocha">{hint}</span>
        )}
      </div>
      <div key={error ? shakeKey : undefined} className={cn(error && "animate-shake")}>
        {children}
      </div>
      {error && (
        <p id={`choice-${id}-error`} role="alert" className="mt-2 text-sm font-medium text-berry">
          {error}
        </p>
      )}
    </div>
  );
}

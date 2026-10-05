const pesoWhole = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pesoCentavos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₱120, or ₱120.50 when there are centavos. */
export function formatPeso(amount: number) {
  return (Number.isInteger(amount) ? pesoWhole : pesoCentavos).format(amount);
}

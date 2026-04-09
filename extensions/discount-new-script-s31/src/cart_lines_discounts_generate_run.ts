import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  Input,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

const DISCOUNT_MESSAGE = 'FREE Gift with Purchase';

export function cartLinesDiscountsGenerateRun(
  input: Input,
): CartLinesDiscountsGenerateRunResult {
  const { cart, discount } = input;

  if (!cart.lines.length) {
    return { operations: [] };
  }

  // Get config from metafield JSON
  const config = discount.metafield?.jsonValue as
    | { gwpThreshold?: number; gwpVariantId?: string }
    | undefined;

  if (!config || !config.gwpThreshold || !config.gwpVariantId) {
    // No configuration → no discount
    return { operations: [] };
  }

  const FREEBIE_VARIANT_ID = config.gwpVariantId;
  const CART_TOTAL_FOR_DISCOUNT_APPLIED = config.gwpThreshold;

  // Only run for USD, as in the original Script
  const cartCurrency = cart.cost.subtotalAmount.currencyCode;
  if (cartCurrency !== 'USD') {
    return { operations: [] };
  }

  // Ensure this function has a product discount class
  const hasProductDiscountClass = discount.discountClasses.includes(
    DiscountClass.Product,
  );
  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  // 1. Find ONE freebie line (if present) – first matching line only
  const freebieLine = cart.lines.find((line) => {
    const merch = line.merchandise;
    return merch.__typename === 'ProductVariant' && merch.id === FREEBIE_VARIANT_ID;
  });

  if (!freebieLine) {
    // Freebie is not in the cart
    return { operations: [] };
  }

  // 2. Compute cart subtotal minus the entire freebie line cost
  const cartSubtotal = cart.cost.subtotalAmount.amount;
  const freebieLineSubtotal = freebieLine.cost.subtotalAmount.amount;
  const subtotalMinusFreebie = cartSubtotal - freebieLineSubtotal;

  if (subtotalMinusFreebie < CART_TOTAL_FOR_DISCOUNT_APPLIED) {
    // Threshold not met
    return { operations: [] };
  }

  // 3. Threshold met & freebie in cart → apply a fixed discount = 1 unit price

  const quantity = freebieLine.quantity;
  if (quantity <= 0) {
    return { operations: [] };
  }

  // unit price in cart currency
  const unitPrice = freebieLineSubtotal / quantity;

  const operations: CartLinesDiscountsGenerateRunResult['operations'] = [];

  operations.push({
    productDiscountsAdd: {
      candidates: [
        {
          message: DISCOUNT_MESSAGE,
          targets: [
            {
              cartLine: {
                id: freebieLine.id,
                quantity:1
              },
            },
          ],
          value: {
            fixedAmount: {
              amount: unitPrice,
              // Depending on your generated types, there may be an
              // `appliesToEachItem` flag. If present, set it to false
              // so the fixed amount applies to the whole line, not per unit.
              // appliesToEachItem: false,
            },
          },
        },
      ],
      selectionStrategy: ProductDiscountSelectionStrategy.First,
    },
  });

  return { operations };
}
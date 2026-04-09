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

  const config = discount.metafield?.jsonValue as
    | { gwpThreshold?: number; gwpVariantId?: string }
    | undefined;

  if (!config || !config.gwpThreshold || !config.gwpVariantId) {
    return { operations: [] };
  }

  const FREEBIE_VARIANT_ID = config.gwpVariantId;
  const CART_TOTAL_FOR_DISCOUNT_APPLIED = config.gwpThreshold;

  const cartCurrency = cart.cost.subtotalAmount.currencyCode;
  if (cartCurrency !== 'USD') {
    return { operations: [] };
  }

  const hasProductDiscountClass = discount.discountClasses.includes(
    DiscountClass.Product,
  );
  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  const freebieLine = cart.lines.find((line) => {
    const merch = line.merchandise;
    return merch.__typename === 'ProductVariant' && merch.id === FREEBIE_VARIANT_ID;
  });

  if (!freebieLine) {
    return { operations: [] };
  }

  const cartSubtotal = cart.cost.subtotalAmount.amount;

  if (cartSubtotal < CART_TOTAL_FOR_DISCOUNT_APPLIED) {
    return { operations: [] };
  }


  const quantity = freebieLine.quantity;
  if (quantity <= 0) {
    return { operations: [] };
  }

  const freebieLineSubtotal = freebieLine.cost.subtotalAmount.amount;
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
              
            },
          },
        },
      ],
      selectionStrategy: ProductDiscountSelectionStrategy.First,
    },
  });

  return { operations };
}
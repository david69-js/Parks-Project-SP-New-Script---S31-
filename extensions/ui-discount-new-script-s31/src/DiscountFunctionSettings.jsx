
import "@shopify/ui-extensions/preact";
import {render} from "preact";
import {useState, useEffect, useMemo} from "preact/hooks";

export default async () => {
  render(<App />, document.body);
};

// ─── GWP Variant Display ─────────────────────────────────────────────────────

function GwpVariantSection({variant, onSelect, onRemove}) {
  return (
    <s-stack gap="base">
      {variant ? (
        <s-stack direction="inline" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" alignItems="center" gap="tight">

             {variant.image ?(
            <s-grid gridTemplateColumns="80px 1fr" gap="base" alignItems="center">
              <s-image
                src={variant.image.url}
                alt="Indoor plant"
                aspectRatio="1/1"
                objectFit="cover"
                borderRadius="base"
                inlineSize="fill"
              />
            </s-grid>
            ) : null}
            <s-stack gap="none">
              <s-text fontWeight="bold">{variant.product?.title ?? variant.title}</s-text>
            </s-stack>
          </s-stack>
            <s-stack gap="none">
              <s-text tone="subdued" size="small">{variant.title}</s-text>
            </s-stack>
          <s-button variant="tertiary" onClick={onRemove}>
            <s-icon type="x-circle" />
          </s-button>
        </s-stack>
      ) : (
        <s-text tone="subdued" size="small">No variant selected</s-text>
      )}
      <s-button onClick={onSelect}>
        {variant ? "Change Gift Variant" : "Select Gift Variant"}
      </s-button>
    </s-stack>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const {
    applyExtensionMetafieldChange,
    i18n,
    resetForm,
    loading,
    gwpThreshold,
    onGwpThresholdChange,
    gwpVariant,
    onSelectGwpVariant,
    onRemoveGwpVariant,
  } = useExtensionData();

  if (loading) {
    return <s-text>{i18n.translate("loading")}</s-text>;
  }

  return (
    <s-function-settings
      onSubmit={event => {
        event.waitUntil?.(applyExtensionMetafieldChange());
      }}
      onReset={resetForm}
    >
      <s-heading>Gift With Purchase (GWP)</s-heading>

      <s-section>
        <s-stack gap="base">
          {/* Hidden field so the function can read the variant id from form data */}
          <s-box display="none">
            <s-text-field
              label=""
              name="gwpVariantId"
              value={gwpVariant?.id ?? ""}
              defaultValue=""
            />
          </s-box>

          <s-number-field
            label="Cart Threshold (minimum subtotal)"
            name="gwpThreshold"
            value={String(gwpThreshold)}
            defaultValue="0"
            min={0}
            onChange={event => onGwpThresholdChange(event.currentTarget.value)}
            prefix="$"
            helpText="Customer must reach this cart subtotal to receive the free gift."
          />

          <s-text fontWeight="semibold">Gift Product Variant</s-text>
          <GwpVariantSection
            variant={gwpVariant}
            onSelect={onSelectGwpVariant}
            onRemove={onRemoveGwpVariant}
          />
        </s-stack>
      </s-section>
    </s-function-settings>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useExtensionData() {
  const {applyMetafieldChange, i18n, data, resourcePicker, query} = shopify;

  const metafieldConfig = useMemo(
    () =>
      parseMetafield(
        data?.metafields?.find(metafield => metafield.key === "gwp-s31")?.value,
      ),
    [data?.metafields],
  );

  const [loading, setLoading] = useState(false);
  const [gwpThreshold, setGwpThreshold] = useState(metafieldConfig.gwpThreshold);
  const [gwpVariant, setGwpVariant] = useState(null);

  // Fetch existing GWP variant on mount
  useEffect(() => {
    const fetchVariant = async () => {
      if (!metafieldConfig.gwpVariantId) return;
      setLoading(true);
      const result = await getVariant(metafieldConfig.gwpVariantId, query);
      if (result) setGwpVariant(result);
      setLoading(false);
    };
    fetchVariant();
  }, [metafieldConfig.gwpVariantId, query]);

  const onGwpThresholdChange = (value) => {
    setGwpThreshold(Number(value));
  };

  const onSelectGwpVariant = async () => {
    const selection = await resourcePicker({
      type: "variant",
      action: "select",
      multiple: false,
      selectionIds: gwpVariant?.id ? [{ id: gwpVariant.id }] : [],
  });

  if (selection && selection.length > 0) {
    const variant = selection[0];

    setGwpVariant({
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? null,
      image: variant.image ?? variant.product?.images?.[0] ?? null,
      product: {
        id: variant.product?.id,
        title: variant.product?.title,
      },
    });
  }
};

  const onRemoveGwpVariant = () => setGwpVariant(null);

  async function applyExtensionMetafieldChange() {
    await applyMetafieldChange({
      type: "updateMetafield",
      namespace: "$app",
      key: "gwp-s31",
      value: JSON.stringify({
        gwpThreshold,
        gwpVariantId: gwpVariant?.id ?? null,
      }),
      valueType: "json",
    });
  }

  const resetForm = () => {
    setGwpThreshold(metafieldConfig.gwpThreshold);
    setGwpVariant(null);
  };

  return {
    applyExtensionMetafieldChange,
    i18n,
    resetForm,
    loading,
    gwpThreshold,
    onGwpThresholdChange,
    gwpVariant,
    onSelectGwpVariant,
    onRemoveGwpVariant,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMetafield(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return {
      gwpThreshold: Number(parsed.gwpThreshold ?? 0),
      gwpVariantId: parsed.gwpVariantId ?? null,
    };
  } catch {
    return {
      gwpThreshold: 0,
      gwpVariantId: null,
    };
  }
}

async function getVariant(variantGid, adminApiQuery) {
  if (!variantGid) return null;
  const gql = `#graphql
    query GetVariant($id: ID!) {
      productVariant(id: $id) {
        id
        title
        sku
        image { url }
        product { id title }
      }
    }
  `;
  const result = await adminApiQuery(gql, {variables: {id: variantGid}});
  return result?.data?.productVariant ?? null;
}

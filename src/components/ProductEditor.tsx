import { ProductImage } from './ProductImage';
import { useState } from 'react';
import { type CartLine, type Product } from '../../shared/model';
import { money, priceLine } from '../../shared/domain';
import { Modal, ErrorNotice } from './Modal';
export default function ProductEditor({
  product,
  initial,
  onSave,
  onClose,
}: {
  product: Product;
  initial?: CartLine;
  onSave: (l: CartLine) => void;
  onClose: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>(
      initial?.selections ??
        Object.fromEntries(
          product.modifiers.map((g) => [g.id, g.required ? [g.options[0].id] : []]),
        ),
    ),
    [quantity, setQuantity] = useState(initial?.quantity ?? 1),
    [instructions, setInstructions] = useState(initial?.instructions ?? ''),
    [error, setError] = useState('');
  const line = { productId: product.id, selections, quantity, instructions };
  let total = 0;
  try {
    total = priceLine(line, product).lineTotal;
  } catch {
    /* validation shown at submit */
  }
  return (
    <Modal title={product.name} onClose={onClose}>
      <ProductImage product={product} detail eager className="detail-image" />
      <p className="muted">{product.description}</p>
      <p className="allergen">
        Allergens: {product.allergens.join(', ') || 'None listed'}. Alternative milk and extras may
        add allergens. Please speak to our team about allergies.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            priceLine(line, product);
            onSave(line);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Check your selections');
          }
        }}
      >
        {product.modifiers.map((g) => (
          <fieldset key={g.id}>
            <legend>
              {g.name}{' '}
              <small>
                {g.required ? 'Choose ' + (g.multiple ? 'at least one' : 'one') : 'Optional'}
              </small>
            </legend>
            <div className="choices">
              {g.options.map((o) => (
                <label
                  key={o.id}
                  className={selections[g.id]?.includes(o.id) ? 'choice selected' : 'choice'}
                >
                  <input
                    type={g.multiple ? 'checkbox' : 'radio'}
                    name={g.id}
                    checked={selections[g.id]?.includes(o.id) ?? false}
                    onChange={() =>
                      setSelections({
                        ...selections,
                        [g.id]: g.multiple
                          ? selections[g.id]?.includes(o.id)
                            ? selections[g.id].filter((x) => x !== o.id)
                            : [...(selections[g.id] ?? []), o.id]
                          : [o.id],
                      })
                    }
                  />
                  {o.name}
                  {o.price > 0 && <small>+{money(o.price)}</small>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label>
          Special instructions
          <textarea
            maxLength={300}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Anything we should know?"
          />
        </label>
        <label>
          Quantity
          <input
            type="number"
            min="1"
            max="20"
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <ErrorNotice message={error} />
        <button className="primary full" type="submit">
          {initial ? 'Update item' : 'Add to order'} <span>{money(total)}</span>
        </button>
      </form>
    </Modal>
  );
}

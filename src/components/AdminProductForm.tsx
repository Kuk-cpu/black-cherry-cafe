import { approvedProductImages, productImage, imageFields } from '../../shared/images';
import { ProductImage } from './ProductImage';
import { useState } from 'react';
import type { Category, Product } from '../../shared/model';
import { productSchema, availabilityFields } from '../../shared/model';
import { api, errorMessage } from '../lib';
import { Modal, ErrorNotice } from './Modal';
export default function AdminProductForm({
  initial,
  categories,
  onClose,
}: {
  initial: Product;
  categories: Category[];
  onClose: () => void;
}) {
  const { createdAt: _created, updatedAt: _updated, ...clean } = initial;
  const [p, setP] = useState({ ...clean, ...imageFields(productImage(initial)) }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const update = (value: Partial<Product>) => setP({ ...p, ...value });
  return (
    <Modal title={initial.createdAt ? 'Edit product' : 'New product'} wide onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const data = productSchema.parse(p);
            await api('manage', { entity: 'products', action: 'save', id: p.id, data });
            onClose();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Name
            <input required value={p.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label>
            Category
            <select value={p.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base price (AUD)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1000"
              required
              value={p.basePrice / 100}
              onChange={(e) => update({ basePrice: Math.round(Number(e.target.value) * 100) })}
            />
          </label>
          <label>
            Availability
            <select
              value={p.status}
              onChange={(e) => update(availabilityFields(e.target.value as Product['status']))}
            >
              {['Available', 'Sold Out', 'Hidden'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Display order
            <input
              type="number"
              min="0"
              max="9999"
              required
              value={p.displayOrder}
              onChange={(e) => update({ displayOrder: Number(e.target.value) })}
            />
          </label>
          <label>
            Product illustration
            <select
              value={p.imageUrl}
              onChange={(e) => {
                const a = approvedProductImages(p.id).find((a) => a.card.path === e.target.value);
                if (a) update(imageFields(a));
              }}
            >
              {approvedProductImages(p.id).map((a) => (
                <option key={a.id} value={a.card.path}>
                  {a.id.replace(/^sticker-/, '')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-image-preview">
          <ProductImage product={p} />
        </div>
        <fieldset>
          <legend>Availability window</legend>
          <div className="form-grid">
            {(['availableFrom', 'availableUntil'] as const).map((key) => (
              <label key={key}>
                {key === 'availableFrom' ? 'Available from' : 'Available until'}
                <input
                  type="datetime-local"
                  value={localDateInput(p[key])}
                  onChange={(e) =>
                    update({ [key]: e.target.value ? new Date(e.target.value).getTime() : null })
                  }
                />
              </label>
            ))}
          </div>
          <p className="small muted">
            Times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            Empty fields mean no time limit. End time is exclusive; expired items cannot be ordered.
          </p>
        </fieldset>
        <fieldset>
          <legend>Dietary labels</legend>
          <div className="choices">
            {(['Vegetarian', 'Contains Nuts'] as const).map((tag) => (
              <label className="choice" key={tag}>
                <input
                  type="checkbox"
                  checked={p.dietaryTags?.includes(tag) ?? false}
                  onChange={(e) =>
                    update({
                      dietaryTags: e.target.checked
                        ? [...(p.dietaryTags ?? []), tag]
                        : (p.dietaryTags ?? []).filter((t) => t !== tag),
                    })
                  }
                />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Description
          <textarea
            value={p.description}
            onChange={(e) => update({ description: e.target.value })}
            maxLength={600}
          />
        </label>
        <label>
          Allergens (comma separated)
          <input
            value={p.allergens.join(',')}
            onChange={(e) => update({ allergens: e.target.value.split(',') })}
          />
        </label>
        <fieldset>
          <legend>Labels</legend>
          <div className="choices">
            {(
              ['New', 'Limited', 'Popular', 'Recommended', 'Student deal', 'Seasonal'] as const
            ).map((t) => (
              <label className="choice" key={t}>
                <input
                  type="checkbox"
                  checked={p.tags.includes(t)}
                  onChange={(e) =>
                    update({
                      tags: e.target.checked ? [...p.tags, t] : p.tags.filter((x) => x !== t),
                    })
                  }
                />
                {t}
              </label>
            ))}
          </div>
          <p className="small muted">
            Student deal is a label; set the actual product price above. No automatic discount is
            applied.
          </p>
        </fieldset>
        <h3>Product-specific options</h3>
        {p.modifiers.map((g, i) => (
          <fieldset className="modifier-editor" key={i}>
            <legend>Option group {i + 1}</legend>
            <div className="form-grid">
              <label>
                Group ID
                <input
                  required
                  value={g.id}
                  onChange={(e) =>
                    update({
                      modifiers: p.modifiers.map((v, n) =>
                        n === i ? { ...v, id: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Display name
                <input
                  required
                  value={g.name}
                  onChange={(e) =>
                    update({
                      modifiers: p.modifiers.map((v, n) =>
                        n === i ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <div className="choices">
              {(['required', 'multiple'] as const).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={g[k]}
                    onChange={(e) =>
                      update({
                        modifiers: p.modifiers.map((v, n) =>
                          n === i ? { ...v, [k]: e.target.checked } : v,
                        ),
                      })
                    }
                  />
                  {k === 'required' ? 'Required' : 'Allow multiple'}
                </label>
              ))}
            </div>
            {g.options.map((o, j) => (
              <div className="option-row" key={j}>
                <label>
                  Option ID
                  <input
                    value={o.id}
                    required
                    onChange={(e) =>
                      update({
                        modifiers: p.modifiers.map((v, n) =>
                          n === i
                            ? {
                                ...v,
                                options: v.options.map((a, b) =>
                                  b === j ? { ...a, id: e.target.value } : a,
                                ),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Name
                  <input
                    value={o.name}
                    required
                    onChange={(e) =>
                      update({
                        modifiers: p.modifiers.map((v, n) =>
                          n === i
                            ? {
                                ...v,
                                options: v.options.map((a, b) =>
                                  b === j ? { ...a, name: e.target.value } : a,
                                ),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Extra AUD
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={o.price / 100}
                    onChange={(e) =>
                      update({
                        modifiers: p.modifiers.map((v, n) =>
                          n === i
                            ? {
                                ...v,
                                options: v.options.map((a, b) =>
                                  b === j
                                    ? { ...a, price: Math.round(Number(e.target.value) * 100) }
                                    : a,
                                ),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() =>
                    update({
                      modifiers: p.modifiers.map((v, n) =>
                        n === i ? { ...v, options: v.options.filter((_, b) => b !== j) } : v,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <div className="toolbar">
              <button
                type="button"
                onClick={() =>
                  update({
                    modifiers: p.modifiers.map((v, n) =>
                      n === i
                        ? {
                            ...v,
                            options: [
                              ...v.options,
                              {
                                id: `option-${crypto.randomUUID().slice(0, 6)}`,
                                name: 'New option',
                                price: 0,
                              },
                            ],
                          }
                        : v,
                    ),
                  })
                }
              >
                + Option
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => update({ modifiers: p.modifiers.filter((_, n) => n !== i) })}
              >
                Remove group
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            update({
              modifiers: [
                ...p.modifiers,
                {
                  id: `group-${crypto.randomUUID().slice(0, 6)}`,
                  name: 'New group',
                  required: false,
                  multiple: false,
                  options: [{ id: 'default', name: 'Default', price: 0 }],
                },
              ],
            })
          }
        >
          + Add option group
        </button>
        <ErrorNotice message={error} />
        <button className="primary full" disabled={busy}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </form>
    </Modal>
  );
}

function localDateInput(value: number | null | undefined) {
  if (value == null) return '';
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

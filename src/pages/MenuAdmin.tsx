import { ProductImage } from '../components/ProductImage';
import { placeholder, imageFields } from '../../shared/images';
import { useState } from 'react';
import type { Category, Product } from '../../shared/model';
import { money } from '../../shared/domain';
import { useCollection } from '../hooks';
import { useProfile } from './Staff';
import { api, errorMessage } from '../lib';
import { ErrorNotice, Modal } from '../components/Modal';
import AdminProductForm from '../components/AdminProductForm';
export default function MenuAdmin() {
  const profile = useProfile();
  const { data: products, error: pError } = useCollection<Product>('products');
  const { data: categories, error: cError } = useCollection<Category>('categories');
  const [edit, setEdit] = useState<Product | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const admin = profile.role === 'admin';
  async function manage(entity: string, action: string, id: string, data?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api('manage', { entity, action, id, ...(data ? { data } : {}) });
      setCategory(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">WHAT’S BREWING</p>
          <h1>The menu.</h1>
          <p className="muted">Availability updates appear on the customer menu immediately.</p>
        </div>
        {admin && (
          <button
            className="primary"
            disabled={!categories.length}
            onClick={() =>
              setEdit({
                id: crypto.randomUUID(),
                name: '',
                categoryId: categories[0]?.id ?? '',
                description: '',
                ...imageFields(placeholder),
                basePrice: 500,
                modifiers: [],
                allergens: [],
                tags: [],
                status: 'Hidden',
                active: false,
                available: false,
                dietaryTags: [],
                availableFrom: null,
                availableUntil: null,
                displayOrder: products.length,
              })
            }
          >
            + New product
          </button>
        )}
      </div>
      <ErrorNotice message={error || pError || cError} />
      {admin && (
        <section className="panel">
          <div className="section-head">
            <h2>Categories</h2>
            <button
              onClick={() =>
                setCategory({
                  id: crypto.randomUUID(),
                  name: '',
                  active: true,
                  kind: 'drink',
                  displayOrder: categories.length,
                })
              }
            >
              + Category
            </button>
          </div>
          <div className="choices">
            {[...categories]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((c) => (
                <button key={c.id} onClick={() => setCategory(c)}>
                  {c.name}
                  {!c.active ? ' · Hidden' : ''}
                </button>
              ))}
          </div>
        </section>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...products]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-table-name">
                      <ProductImage product={p} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.tags.join(' · ')}</small>
                        {p.availableUntil != null && (
                          <small>Ends {new Date(p.availableUntil).toLocaleString()}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{categories.find((c) => c.id === p.categoryId)?.name}</td>
                  <td>{money(p.basePrice)}</td>
                  <td>
                    <span className="status-badge">{p.status}</span>
                  </td>
                  <td>
                    <div className="toolbar">
                      {p.status !== 'Hidden' && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void manage('products', 'availability', p.id, {
                              status: p.status === 'Available' ? 'Sold Out' : 'Available',
                            })
                          }
                        >
                          {p.status === 'Available' ? 'Sell out' : 'Make available'}
                        </button>
                      )}
                      {admin && (
                        <>
                          <button onClick={() => setEdit(p)}>Edit</button>
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete ${p.name}? Existing orders retain their product snapshot.`,
                                )
                              )
                                void manage('products', 'delete', p.id);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <AdminProductForm initial={edit} categories={categories} onClose={() => setEdit(null)} />
      )}{' '}
      {category && (
        <Modal title="Edit category" onClose={() => setCategory(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void manage('categories', 'save', category.id, category);
            }}
          >
            <label>
              Name
              <input
                required
                value={category.name}
                onChange={(e) => setCategory({ ...category, name: e.target.value })}
              />
            </label>
            <label>
              Type (for drink revenue analytics)
              <select
                value={category.kind}
                onChange={(e) =>
                  setCategory({ ...category, kind: e.target.value as Category['kind'] })
                }
              >
                <option value="drink">Drink</option>
                <option value="food">Food</option>
              </select>
            </label>
            <label>
              Display order
              <input
                type="number"
                min="0"
                max="9999"
                required
                value={category.displayOrder}
                onChange={(e) => setCategory({ ...category, displayOrder: Number(e.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={category.active}
                onChange={(e) => setCategory({ ...category, active: e.target.checked })}
              />{' '}
              Visible
            </label>
            <label>
              <input
                type="checkbox"
                checked={category.seasonal ?? false}
                onChange={(e) => setCategory({ ...category, seasonal: e.target.checked })}
              />{' '}
              Seasonal collection — hide when no items are in their availability window
            </label>
            <ErrorNotice message={error} />
            <div className="toolbar">
              <button className="primary" disabled={busy}>
                Save category
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (confirm('Delete this category? It must contain no products.'))
                    void manage('categories', 'delete', category.id);
                }}
              >
                Delete
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

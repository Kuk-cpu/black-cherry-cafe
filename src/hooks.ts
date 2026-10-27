import { normalizeOrder } from '../shared/order-status';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { auth, db, errorMessage } from './lib';
import type { Category, Product, Settings, StaffUser } from '../shared/model';
export function useCollection<T>(name: string, constraints: QueryConstraint[] = [], key = '') {
  const [data, setData] = useState<T[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [fromCache, setFromCache] = useState(true);
  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      query(collection(db, name), ...constraints),
      { includeMetadataChanges: true },
      (s) => {
        setData(
          s.docs.map(
            (d) =>
              (name === 'orders'
                ? normalizeOrder(
                    d.data() as { orderStatus: string; timeline: { status: string; at: number }[] },
                  )
                : d.data()) as T,
          ),
        );
        setFromCache(s.metadata.fromCache);
        setError('');
        setLoading(false);
      },
      (e) => {
        setError(errorMessage(e));
        setLoading(false);
      },
    ); /* constraints are keyed explicitly to avoid resubscribing every render */
  }, [name, key]);
  return { data, error, loading, fromCache };
}
export function useMenu() {
  const p = useCollection<Product>('products', [where('status', 'in', ['Available', 'Sold Out'])]);
  const c = useCollection<Category>('categories', [where('active', '==', true)]);
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState('');
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'store'),
        (s) => {
          setSettings(s.exists() ? (s.data() as Settings) : null);
          setError(
            s.exists()
              ? ''
              : 'Our menu is being updated. Please try again shortly or order at the counter.',
          );
        },
        (e) => setError(errorMessage(e)),
      ),
    [],
  );
  return {
    products: [...p.data].sort((a, b) => a.displayOrder - b.displayOrder),
    categories: [...c.data].sort((a, b) => a.displayOrder - b.displayOrder),
    settings,
    error: error || p.error || c.error,
    loading: p.loading || c.loading,
  };
}
export function useStaff() {
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<StaffUser | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let stop = () => {};
    const off = onAuthStateChanged(auth, (u) => {
      stop();
      setUser(u);
      setProfile(null);
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      stop = onSnapshot(
        doc(db, 'users', u.uid),
        (s) => {
          const p = s.data() as StaffUser | undefined;
          setProfile(p?.active ? p : null);
          setLoading(false);
        },
        () => {
          setProfile(null);
          setLoading(false);
        },
      );
    });
    return () => {
      off();
      stop();
    };
  }, []);
  return { user, profile, loading };
}
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}
export { orderBy, where };

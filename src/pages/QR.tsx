import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { download, errorMessage } from '../lib';
import { useProfile } from './Staff';
import { ErrorNotice } from '../components/Modal';
export default function QR() {
  const profile = useProfile();
  const [base, setBase] = useState(location.origin),
    [table, setTable] = useState('3'),
    [png, setPng] = useState(''),
    [svg, setSvg] = useState(''),
    [error, setError] = useState(''),
    [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const u = new URL('/order', base);
        if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname))
          throw new Error('Use your deployed HTTPS origin');
        if (table && !/^\d{1,3}$/.test(table))
          throw new Error('Table must be 1–3 digits, or leave blank for general menu');
        u.searchParams.set('source', 'qr');
        if (table) u.searchParams.set('table', table);
        const options = {
          width: 800,
          margin: 4,
          errorCorrectionLevel: 'M' as const,
          color: { dark: '#301820', light: '#ffffff' },
        };
        const [p, s] = await Promise.all([
          QRCode.toDataURL(u.href, options),
          QRCode.toString(u.href, { ...options, type: 'svg' }),
        ]);
        if (!cancelled) {
          setUrl(u.href);
          setPng(p);
          setSvg(s);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(errorMessage(e));
          setPng('');
          setSvg('');
        }
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [base, table]);
  if (profile.role !== 'admin') return <p>Administrator access required.</p>;
  return (
    <>
      <div className="page-title no-print">
        <div>
          <p className="eyebrow">A LITTLE INVITATION</p>
          <h1>Scan. Sip. Repeat.</h1>
          <p className="muted">Give every table its own easy way to order.</p>
        </div>
      </div>
      <div className="qr-layout">
        <section className="panel no-print">
          <h2>Make a table code</h2>
          <label>
            Website origin
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="https://your-cafe.vercel.app"
            />
          </label>
          <label>
            Table number
            <input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="Leave blank for a general menu code"
            />
          </label>
          <p className="small muted">
            Use the deployed public website address for printed codes. Localhost only works on this
            computer.
          </p>
          <ErrorNotice message={error} />
          <p className="qr-url">{url}</p>
          <div className="toolbar">
            <button
              disabled={!png}
              onClick={() => {
                const a = document.createElement('a');
                a.href = png;
                a.download = `black-cherry-${table || 'menu'}.png`;
                a.click();
              }}
            >
              Download PNG
            </button>
            <button
              disabled={!svg}
              onClick={() => download(`black-cherry-${table || 'menu'}.svg`, svg, 'image/svg+xml')}
            >
              Download SVG
            </button>
            <button className="primary" disabled={!png} onClick={() => window.print()}>
              Print A6 table card
            </button>
          </div>
        </section>
        <div className="table-card">
          <p className="table-card-brand">
            black cherry<small>CAFÉ · SYDNEY</small>
          </p>
          <span className="card-flower">✳</span>
          <h2>
            A good coffee
            <br />
            starts here.
          </h2>
          {png && <img src={png} alt={`Scan to order${table ? ' at table ' + table : ''}`} />}
          <h3>Scan to Order</h3>
          <p>{table ? `TABLE ${table}` : 'YOUR NEIGHBOURHOOD CAFÉ'}</p>
          <div className="side-line" />
          <small>
            Choose your favourites.
            <br />
            Pay at the counter. We’ll do the rest.
          </small>
        </div>
      </div>
    </>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import PriceChart from '../components/PriceChart';
import HeroOddsChart from '../components/HeroOddsChart';

const FILTERS = ['All', 'NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const SORTS   = ['Volume', 'Score', 'Closing Soon'];

const SPORT_COLORS = {
  NBA:    '#f97316',
  NFL:    '#22c55e',
  MLB:    '#3b82f6',
  Soccer: '#6366f1',
  F1:     '#e74c3c',
  Tennis: '#f5c518',
};

function sportColor(tag) {
  return SPORT_COLORS[tag] || 'var(--border-hover)';
}

function cleanTitle(title, event_ticker) {
  if (!title) return event_ticker || 'Unnamed market';
  if (/^(yes|no)\s+\S+,(yes|no)/i.test(title.trim())) {
    const legs = title.split(',').length;
    const base = event_ticker?.replace(/^[A-Z0-9]+-/, '').replace(/-/g, ' ').trim();
    return base ? `${base} — ${legs} legs` : `${legs}-leg market`;
  }
  return title;
}

function fmtVolume(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function timeLeft(ts) {
  if (!ts) return { label: '—', urgent: false };
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return { label: 'CLOSED', urgent: false };
  const days = Math.floor(diff / 86400000);
  if (days > 30) return { label: `${Math.floor(days / 30)}MO`, urgent: false };
  if (days > 0)  return { label: `${days}D`, urgent: false };
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return { label: `${hours}H`, urgent: hours < 3 };
  return { label: `${Math.floor(diff / 60000)}M`, urgent: true };
}

// ── PriceFlash hook ───────────────────────────────────────────────────────────
function usePriceFlash(yes) {
  const prevRef = useRef(yes);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (prevRef.current !== yes) {
      setFlash(yes > prevRef.current ? 'price-flash-up' : 'price-flash-down');
      prevRef.current = yes;
      const id = setTimeout(() => setFlash(''), 600);
      return () => clearTimeout(id);
    }
  }, [yes]);
  return flash;
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function OddsTab() {
  const { data, loading, error } = useApi('/api/kalshi/sports-markets');
  const [filter, setFilter]    = useState('All');
  const [sort, setSort]        = useState('Volume');
  const [showAll, setShowAll]  = useState(false);
  const prefersReduced = useReducedMotion();

  const { data: rawData } = useApi(showAll ? '/api/kalshi/sports-markets?showAll=1' : null);
  const sourceData = showAll ? rawData : data;

  const markets = useMemo(() => {
    let list = sourceData?.markets || [];
    if (filter !== 'All') list = list.filter(m => m.sport_tag === filter);
    if (sort === 'Volume') {
      list = [...list].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sort === 'Closing Soon') {
      list = [...list].sort((a, b) => {
        const ta = a.close_time ? new Date(a.close_time).getTime() : Infinity;
        const tb = b.close_time ? new Date(b.close_time).getTime() : Infinity;
        return ta - tb;
      });
    }
    return list;
  }, [sourceData, filter, sort]);

  const hero      = markets[0] ?? null;
  const secondary = markets.slice(1, 3);
  const listItems = markets.slice(3);
  const totalVol  = markets.reduce((s, m) => s + (m.volume || 0), 0);

  return (
    <div>
      {/* ── Filter row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f;
            const sc = SPORT_COLORS[f];
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 11px', borderRadius: 2, cursor: 'pointer',
                background: active ? (sc ? `${sc}22` : 'rgba(56,189,248,0.12)') : 'transparent',
                border: `1px solid ${active ? (sc || 'var(--accent)') : 'var(--border)'}`,
                color: active ? (sc || 'var(--accent)') : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', transition: 'all 0.1s',
              }}>
                {f.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SORT</span>
          {SORTS.map(s => (
            <button key={s} onClick={() => setSort(s)} style={{
              padding: '3px 9px', borderRadius: 2, cursor: 'pointer',
              background: sort === s ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: `1px solid ${sort === s ? 'rgba(56,189,248,0.4)' : 'var(--border)'}`,
              color: sort === s ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 10, transition: 'all 0.1s',
            }}>
              {s}
            </button>
          ))}
          <button onClick={() => setShowAll(v => !v)} style={{
            padding: '3px 9px', borderRadius: 2, cursor: 'pointer',
            border: `1px solid ${showAll ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
            background: showAll ? 'rgba(249,115,22,0.1)' : 'transparent',
            color: showAll ? 'var(--orange)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
          }}>
            {showAll ? 'FILTERED' : 'ALL'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14,
        padding: '6px 12px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 2,
        fontFamily: 'var(--font-mono)', fontSize: 10,
      }}>
        <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          MARKETS <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{markets.length}</span>
        </span>
        <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          VOL <span style={{ color: 'var(--positive)', fontWeight: 700 }}>{fmtVolume(totalVol)}</span>
        </span>
        {filter !== 'All' && (
          <span style={{ color: sportColor(filter), fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
            {filter}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 2, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--negative)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          NO MARKETS FOR <span style={{ color: 'var(--text-secondary)' }}>{filter.toUpperCase()}</span>
        </div>
      ) : (
        <div>
          {/* ── 12-col grid: hero + secondaries ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 10,
            marginBottom: 10,
          }}>
            {/* Hero card — 8 cols */}
            {hero && (
              <div style={{ gridColumn: 'span 8' }}>
                <motion.div
                  key={`hero-${hero.id}`}
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <HeroCard market={hero} />
                </motion.div>
              </div>
            )}

            {/* Secondary stack — 4 cols */}
            {secondary.length > 0 && (
              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {secondary.map((m, i) => (
                  <motion.div
                    key={`sec-${m.id}`}
                    initial={prefersReduced ? false : { opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: prefersReduced ? 0 : 0.06 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
                    style={{ flex: 1 }}
                  >
                    <SecondaryCard market={m} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* ── Dense list ── */}
          {listItems.length > 0 && (
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              {/* List header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '8px 1fr 160px 52px 68px 46px',
                gap: 0,
                padding: '6px 12px',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border)',
              }}>
                {['', 'MARKET', 'PROBABILITY', 'YES', 'VOLUME', 'CLOSES'].map((h, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: 'var(--text-muted)', letterSpacing: '0.1em',
                    textAlign: i > 1 ? 'right' : 'left',
                  }}>
                    {h}
                  </span>
                ))}
              </div>
              {listItems.map((m, i) => (
                <motion.div
                  key={`row-${m.id}`}
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, delay: prefersReduced ? 0 : Math.min(i * 0.02, 0.4), ease: 'easeOut' }}
                >
                  <MarketRow market={m} index={i} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hero Card (8-col) ─────────────────────────────────────────────────────────
function HeroCard({ market }) {
  const yes   = market.yes_price ?? 50;
  const no    = 100 - yes;
  const title = cleanTitle(market.title, market.event_ticker);
  const sc    = sportColor(market.sport_tag);
  const flash = usePriceFlash(yes);
  const { label: tl, urgent } = timeLeft(market.close_time);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${sc}`,
      borderRadius: 2,
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px' }}>
        {/* Top row: sport + chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
            color: sc, letterSpacing: '0.1em',
          }}>
            {market.sport_tag}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
            color: 'var(--text-muted)', background: 'var(--border)',
            borderRadius: 2, padding: '1px 6px', letterSpacing: '0.1em',
          }}>
            #1 BY VOLUME
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: urgent ? 'var(--negative)' : 'var(--text-muted)' }}>
            {tl}
          </span>
        </div>

        {/* Event title */}
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
          color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: 14,
          letterSpacing: '-0.01em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </p>

        {/* Anton YES price + NO */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 10 }}>
          <div className={flash} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontFamily: 'var(--font-hero)', fontSize: 64,
              color: 'var(--positive)', lineHeight: 1,
            }}>
              {yes}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>¢ YES</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6, marginLeft: 8 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600,
              color: 'var(--negative)', lineHeight: 1,
            }}>
              {no}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>¢ NO</span>
          </div>
          <div style={{ marginLeft: 'auto', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              VOL <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{fmtVolume(market.volume)}</span>
            </span>
          </div>
        </div>

        {/* Probability bar */}
        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 14 }}>
          <div style={{
            height: '100%', width: '100%',
            background: sc,
            transformOrigin: 'left',
            transform: `scaleX(${yes / 100})`,
            transition: 'transform 0.4s ease-out',
          }} />
        </div>
      </div>

      {/* Hero chart — Phase 8.1 */}
      <div
        id="hero-chart-slot"
        data-ticker={market.id}
        style={{ flex: 1, minHeight: 140, borderTop: '1px solid var(--border)' }}
      >
        <HeroOddsChart ticker={market.id} sportColor={sc} />
      </div>
    </div>
  );
}

// ── Secondary Card (4-col) ────────────────────────────────────────────────────
function SecondaryCard({ market }) {
  const yes   = market.yes_price ?? 50;
  const no    = 100 - yes;
  const title = cleanTitle(market.title, market.event_ticker);
  const sc    = sportColor(market.sport_tag);
  const flash = usePriceFlash(yes);
  const [expanded, setExpanded] = useState(false);
  const { label: tl, urgent } = timeLeft(market.close_time);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${sc}`,
        borderRadius: 2,
        cursor: 'pointer',
        overflow: 'hidden',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={() => setExpanded(v => !v)}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ padding: '11px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: sc, letterSpacing: '0.1em' }}>
            {market.sport_tag}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: urgent ? 'var(--negative)' : 'var(--text-muted)' }}>
            {tl}
          </span>
        </div>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          color: 'var(--text-secondary)', lineHeight: '1.3', marginBottom: 10,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </p>

        <div className={flash} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800,
            color: 'var(--positive)', lineHeight: 1, letterSpacing: '-0.01em',
          }}>
            {yes}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>¢ YES</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--negative)' }}>{no}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>¢</span>
        </div>

        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            height: '100%', width: '100%', background: sc,
            transformOrigin: 'left', transform: `scaleX(${yes / 100})`,
            transition: 'transform 0.4s ease-out',
          }} />
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          VOL <span style={{ color: 'var(--text-secondary)' }}>{fmtVolume(market.volume)}</span>
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 90, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
              <PriceChart marketId={market.id} height={74} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Market Row (dense list) ───────────────────────────────────────────────────
function MarketRow({ market, index }) {
  const yes  = market.yes_price ?? 50;
  const title = cleanTitle(market.title, market.event_ticker);
  const sc   = sportColor(market.sport_tag);
  const flash = usePriceFlash(yes);
  const { label: tl, urgent } = timeLeft(market.close_time);
  const even = index % 2 === 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '8px 1fr 160px 52px 68px 46px',
      gap: 0,
      alignItems: 'center',
      padding: '7px 12px',
      background: even ? 'var(--bg-card)' : 'transparent',
      borderBottom: '1px solid rgba(40,40,40,0.6)',
      transition: 'background 0.08s',
      cursor: 'default',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
    onMouseLeave={e => e.currentTarget.style.background = even ? 'var(--bg-card)' : 'transparent'}
    >
      {/* Sport dot */}
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: sc, flexShrink: 0, display: 'inline-block' }} />

      {/* Title */}
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        paddingRight: 12,
      }}>
        {title}
      </span>

      {/* Probability bar */}
      <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', borderRadius: 0 }}>
        <div style={{
          height: '100%', width: '100%', background: sc,
          transformOrigin: 'left', transform: `scaleX(${yes / 100})`,
          transition: 'transform 0.4s ease-out',
        }} />
      </div>

      {/* YES % */}
      <div className={flash} style={{ textAlign: 'right', paddingRight: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          color: yes > 65 ? 'var(--positive)' : yes < 35 ? 'var(--negative)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {yes}¢
        </span>
      </div>

      {/* Volume */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        textAlign: 'right', paddingRight: 10,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtVolume(market.volume)}
      </span>

      {/* Close time */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: urgent ? 'var(--negative)' : 'var(--text-muted)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {tl}
      </span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10, marginBottom: 10 }}>
        <div style={{ gridColumn: 'span 8' }}>
          <div className="skeleton" style={{ height: 260, borderRadius: 2 }} />
        </div>
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ flex: 1, borderRadius: 2 }} />
          <div className="skeleton" style={{ flex: 1, borderRadius: 2 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 200, borderRadius: 2 }} />
    </div>
  );
}

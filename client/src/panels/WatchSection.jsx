
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { rankVideos } from '../utils/videoRanking';

const SPORTS = ['NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];

function age(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function WatchSection({ activeSport }) {
  const url = `/api/videos${activeSport && activeSport !== 'All' ? `?sport=${encodeURIComponent(activeSport)}` : ''}`;
  const { data } = useApi(url, [activeSport]);
  const [open, setOpen] = useState(null);

  const ranked = useMemo(() => rankVideos(data, activeSport, 12), [data, activeSport]);
  const highlights = useMemo(() => {
    const map = data?.highlights || {};
    if (activeSport && activeSport !== 'All') return map[activeSport] || [];
    return SPORTS.flatMap(s => (map[s] || []).slice(0, 1));
  }, [data, activeSport]);

  const debate = (data?.debate || []).slice(0, 4);
  const news = (data?.news || []).slice(0, 4);
  if (!ranked.length && !debate.length && !highlights.length && !news.length) return null;

  return (
    <section style={{ marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
          WATCH
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          RANKED BY SPORT · RECENCY · SIGNAL
        </span>
      </div>
      <VideoRow title="RECOMMENDED" videos={ranked.slice(0, 8)} large onOpen={setOpen} />
      <VideoRow title="HIGHLIGHTS" videos={highlights.slice(0, 8)} onOpen={setOpen} />
      <VideoRow title="NEWS / DEBATE" videos={[...news, ...debate].slice(0, 8)} compact onOpen={setOpen} />

      <AnimatePresence>
        {open && <VideoModal video={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </section>
  );
}

function VideoRow({ title, videos, large = false, compact = false, onOpen }) {
  if (!videos?.length) return null;
  return (
    <div style={{ marginBottom: compact ? 6 : 10 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 5 }}>
        {title}
      </div>
      <div className="scrollbar-hide" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {videos.map(v => <VideoCard key={v.videoId} video={v} large={large} compact={compact} onClick={() => onOpen(v)} />)}
      </div>
    </div>
  );
}

function VideoCard({ video, large, compact, onClick }) {
  const w = compact ? 190 : large ? 238 : 210;
  return (
    <button onClick={onClick} style={{
      width: w, minWidth: w, textAlign: 'left', cursor: 'pointer',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 2,
      color: 'var(--text-primary)', padding: 0, overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#111' }}>
        {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        <span style={{ position: 'absolute', right: 5, bottom: 5, fontFamily: 'var(--mono)', fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.72)', padding: '2px 5px', borderRadius: 1 }}>
          ▶
        </span>
      </div>
      <div style={{ padding: compact ? '7px 8px' : '8px 9px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--accent)' }}>{video.sport}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>{age(video.publishedAt)}</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: large ? 12 : 11, fontWeight: 700,
          color: 'var(--text-secondary)', lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {video.title}
        </p>
        <div style={{ marginTop: 5, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>{video.channel}</div>
      </div>
    </button>
  );
}

function VideoModal({ video, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(920px, 100%)', background: 'var(--bg-panel)', border: '1px solid var(--border-hover)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{video.channel}</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 7px' }}>CLOSE</button>
        </div>
        <div style={{ aspectRatio: '16 / 9', width: '100%' }}>
          <iframe
            title={video.title}
            src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: 0, width: '100%', height: '100%' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

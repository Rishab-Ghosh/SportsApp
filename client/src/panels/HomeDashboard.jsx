
import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { rankVideos } from '../utils/videoRanking';

const SPORT_COLORS = {
  NBA: '#f97316', NFL: '#22c55e', MLB: '#3b82f6', Soccer: '#6366f1', F1: '#e74c3c', Tennis: '#f5c518', General: '#74706d',
};

const SCORE_MAP = { NBA: 'nba', NFL: 'nfl', MLB: 'mlb', Soccer: 'soccer', F1: 'f1', Tennis: 'tennis' };

function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function getCards(data) {
  if (Array.isArray(data)) return data;
  return data?.cards || data?.stories || [];
}

function cleanTitle(title) {
  return (title || '').replace(/\s+-\s+YouTube$/i, '').trim();
}

export default function HomeDashboard({ activeSport = 'All', onOpenTab }) {
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];

  const storiesPath = activeSport === 'All' ? '/api/news/all?limit=12' : `/api/news/feed?sport=${encodeURIComponent(activeSport)}&limit=12`;
  const videosPath = activeSport === 'All' ? '/api/videos' : `/api/videos?sport=${encodeURIComponent(activeSport)}`;
  const scoreSport = SCORE_MAP[activeSport] || 'mlb';

  const { data: storyData } = useApi(storiesPath, [storiesPath]);
  const { data: videoData } = useApi(videosPath, [videosPath]);
  const { data: scoresData } = useApi(`/api/scores/${scoreSport}`, [scoreSport]);
  const { data: heatHttp } = useApi('/api/heat-scores');

  const heatScores = wsData?.heatScores || heatHttp || {};
  const stories = getCards(storyData).slice(0, 8);
  const videos = rankVideos(videoData, activeSport, 7);

  const filteredMarkets = useMemo(() => {
    const list = activeSport === 'All' ? markets : markets.filter(m => m.sport_tag === activeSport);
    return [...list].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  }, [markets, activeSport]);

  const movers = useMemo(() => {
    return [...filteredMarkets]
      .map(m => ({ ...m, move: Math.abs((m.yes_price ?? 50) - (m.yes_prev ?? m.yes_price ?? 50)) }))
      .sort((a, b) => (b.move - a.move) || ((b.volume || 0) - (a.volume || 0)))
      .slice(0, 5);
  }, [filteredMarkets]);

  const totalVol = filteredMarkets.reduce((sum, m) => sum + (m.volume || 0), 0);
  const hotSport = Object.entries(heatScores).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
  const live = scoresData?.live || [];
  const upcoming = scoresData?.upcoming || [];
  const leadVideo = videos[0];

  return (
    <div style={{ padding: '14px 16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>
            COMMAND CENTER · {activeSport === 'All' ? 'ALL SPORTS' : activeSport.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 720, lineHeight: 1.15, color: 'var(--text-primary)', letterSpacing: 0 }}>
            Market-moving sports intelligence
          </h1>
        </div>
        <button onClick={() => onOpenTab?.('Odds')} style={actionButtonStyle}>OPEN ODDS</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Metric label="HOTTEST" value={hotSport ? hotSport[0] : '—'} sub={hotSport ? `${hotSport[1]} heat` : 'warming'} tone={hotSport ? heatColor(hotSport[1]) : 'var(--text-muted)'} />
        <Metric label="MARKETS" value={filteredMarkets.length} sub={`${fmtVol(totalVol)} volume`} tone="var(--accent)" />
        <Metric label="LIVE" value={live.length} sub={`${upcoming.length} upcoming`} tone={live.length ? 'var(--negative)' : 'var(--text-secondary)'} />
        <Metric label="STORIES" value={stories.length} sub="ranked feed" tone="var(--text-secondary)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.85fr)', gap: 12 }} className="home-grid">
        <Panel title="Priority Briefing" meta="ranked stories">
          {stories.length ? stories.slice(0, 6).map((story, i) => <StoryRow key={story.id || i} story={story} rank={i + 1} />) : <EmptyLine text="Stories are warming up" />}
        </Panel>

        <Panel title="Recommended Watch" meta="relevance ranked">
          {leadVideo ? <LeadVideo video={leadVideo} /> : <EmptyLine text="Video feed warming up" />}
          {videos.slice(1, 5).map(v => <VideoLine key={v.videoId} video={v} />)}
        </Panel>

        <Panel title="Market Movers" meta="volume + movement">
          {movers.length ? movers.map(m => <MarketLine key={m.id} market={m} />) : <EmptyLine text="No active market signals" />}
        </Panel>

        <Panel title="Schedule Pulse" meta={activeSport === 'All' ? 'MLB sample' : activeSport}>
          {live.slice(0, 3).map(g => <GameLine key={g.id} game={g} live />)}
          {!live.length && upcoming.slice(0, 4).map(g => <GameLine key={g.id} game={g} />)}
          {!live.length && !upcoming.length && <EmptyLine text="No games scheduled" />}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, meta, children }) {
  return (
    <section style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 720, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{title}</h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)' }}>{meta}</span>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Metric({ label, value, sub, tone }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '9px 10px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 760, color: tone, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-secondary)', marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function StoryRow({ story, rank }) {
  const sportColor = SPORT_COLORS[story.sport_tag] || SPORT_COLORS.General;
  return (
    <a href={story.sources?.[0]?.url} target="_blank" rel="noreferrer" style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'start', padding: '10px', borderBottom: '1px solid rgba(40,40,40,0.7)', textDecoration: 'none' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>{String(rank).padStart(2, '0')}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{story.headline}</span>
        {story.summary && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: 3 }}>{story.summary}</span>}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: sportColor }}>{story.sport_tag || 'SPORT'}</span>
    </a>
  );
}

function LeadVideo({ video }) {
  return (
    <button onClick={() => window.open(video.url, '_blank')} style={{ display: 'grid', gridTemplateColumns: '126px 1fr', gap: 10, width: '100%', padding: 10, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(40,40,40,0.75)', cursor: 'pointer', textAlign: 'left' }}>
      <img src={video.thumbnail} alt="" style={{ width: 126, aspectRatio: '16/9', objectFit: 'cover', background: '#111' }} />
      <span>
        <span style={{ display: 'flex', gap: 7, marginBottom: 5, fontFamily: 'var(--mono)', fontSize: 9 }}>
          <span style={{ color: SPORT_COLORS[video.sport] || 'var(--accent)' }}>{video.sport}</span>
          <span style={{ color: 'var(--text-muted)' }}>{video.channel}</span>
          <span style={{ color: 'var(--text-muted)' }}>{timeAgo(video.publishedAt)}</span>
        </span>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 740, color: 'var(--text-primary)', lineHeight: 1.25 }}>{cleanTitle(video.title)}</span>
        <span style={{ display: 'inline-block', marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)' }}>RELEVANCE {video.relevanceScore}</span>
      </span>
    </button>
  );
}

function VideoLine({ video }) {
  return (
    <button onClick={() => window.open(video.url, '_blank')} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '8px 10px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(40,40,40,0.7)', textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', lineHeight: 1.25 }}>{cleanTitle(video.title)}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: SPORT_COLORS[video.sport] || 'var(--text-muted)' }}>{video.sport}</span>
    </button>
  );
}

function MarketLine({ market }) {
  const yes = market.yes_price ?? 50;
  const delta = yes - (market.yes_prev ?? yes);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 68px', gap: 10, alignItems: 'center', padding: '9px 10px', borderBottom: '1px solid rgba(40,40,40,0.7)' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{market.title}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)' }}>{market.sport_tag} · {fmtVol(market.volume)}</span>
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 760, color: yes >= 50 ? 'var(--positive)' : 'var(--negative)', textAlign: 'right' }}>{yes}¢</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: delta > 0 ? 'var(--positive)' : delta < 0 ? 'var(--negative)' : 'var(--text-muted)', textAlign: 'right' }}>{delta > 0 ? '+' : ''}{delta}¢</span>
    </div>
  );
}

function GameLine({ game, live = false }) {
  const home = game.home || game.home_team || '—';
  const away = game.away || game.away_team || '—';
  const time = game.startTime ? new Date(game.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : game.clock;
  return (
    <div style={{ padding: '9px 10px', borderBottom: '1px solid rgba(40,40,40,0.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: live ? 'var(--negative)' : 'var(--text-muted)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: live ? 'var(--negative)' : 'var(--text-muted)' }}>{live ? 'LIVE' : time}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)' }}><span>{away}</span><span>{game.awayScore ?? game.away_score ?? ''}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-primary)' }}><span>{home}</span><span>{game.homeScore ?? game.home_score ?? ''}</span></div>
    </div>
  );
}

function EmptyLine({ text }) {
  return <div style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>{text}</div>;
}

function heatColor(score) {
  if (score >= 86) return 'var(--negative)';
  if (score >= 66) return 'var(--orange)';
  if (score >= 41) return 'var(--yellow)';
  return 'var(--text-muted)';
}

const actionButtonStyle = {
  marginLeft: 'auto', padding: '6px 10px', minHeight: 32,
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
};

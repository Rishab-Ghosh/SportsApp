import React from 'react';
import { useApi } from '../hooks/useApi';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import TimeAgo from '../components/TimeAgo';
import { SkeletonCard } from '../components/Skeleton';

export default function HomeTab() {
  const { data: marketsData, loading: ml } = useApi('/api/kalshi/sports-markets');
  const { data: scoresData, loading: sl } = useApi('/api/scores/nba');
  const { data: newsData, loading: nl } = useApi('/api/news');

  const markets = (marketsData?.markets || []).sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);
  const news = (newsData?.articles || []).slice(0, 6);

  // Combine NBA + other scores for live games widget
  const games = (scoresData?.games || []).slice(0, 4);

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Left: Top Kalshi Markets */}
      <section>
        <SectionHeader label="TOP MARKETS" sub="by volume · Kalshi" />
        <div className="space-y-2">
          {ml ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={3} />)
          ) : markets.length === 0 ? (
            <EmptyState msg="No markets available" />
          ) : (
            markets.map(m => <MarketMiniCard key={m.id} market={m} />)
          )}
        </div>
      </section>

      {/* Center: Live Scores */}
      <section>
        <SectionHeader label="LIVE SCORES" sub="active games" />
        <div className="space-y-2">
          {sl ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={4} />)
          ) : games.length === 0 ? (
            <EmptyState msg="No active games right now" />
          ) : (
            games.map(g => <ScoreMiniCard key={g.id} game={g} />)
          )}
        </div>
        <MultiSportScores />
      </section>

      {/* Right: Top Headlines */}
      <section>
        <SectionHeader label="BREAKING NEWS" sub="latest headlines" />
        <div className="space-y-1.5">
          {nl ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={2} />)
          ) : news.length === 0 ? (
            <EmptyState msg="No news available" />
          ) : (
            news.map((a, i) => <NewsHeadlineCard key={i} article={a} />)
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label, sub }) {
  return (
    <div className="mb-3 pb-1.5 border-b border-border">
      <div className="text-xs font-mono font-semibold text-accent tracking-widest">{label}</div>
      <div className="text-[10px] text-muted font-mono">{sub}</div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="bg-card border border-border rounded p-4 text-center text-muted text-xs font-mono">
      {msg}
    </div>
  );
}

function MarketMiniCard({ market }) {
  const yes = market.yes_price ?? 50;
  const vol = market.volume ? `$${(market.volume / 1000).toFixed(0)}K` : '—';

  return (
    <div className="bg-card border border-border rounded p-3 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs text-gray-200 leading-snug flex-1 line-clamp-2">{market.title}</p>
        <SportBadge sport={market.sport_tag} size="xs" />
      </div>
      <OddsBar yesPrice={yes} noPrice={market.no_price} compact />
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-muted">
        <span>VOL <span className="text-label">{vol}</span></span>
        <CloseTime ts={market.close_time} />
      </div>
    </div>
  );
}

function CloseTime({ ts }) {
  if (!ts) return null;
  const d = new Date(ts);
  const diff = d - Date.now();
  if (diff < 0) return <span className="text-negative">Closed</span>;
  const days = Math.floor(diff / 86400000);
  if (days > 0) return <span>{days}d left</span>;
  const hours = Math.floor(diff / 3600000);
  return <span className={hours < 2 ? 'text-negative' : ''}>{hours}h left</span>;
}

function ScoreMiniCard({ game }) {
  return (
    <div className={`bg-card border rounded p-3 ${game.is_live ? 'border-accent/50 live-indicator' : 'border-border'}`}>
      {game.is_live && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
          <span className="text-[9px] font-mono text-positive font-semibold tracking-widest">LIVE</span>
        </div>
      )}
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-200 truncate flex-1">{game.away_team}</span>
        <span className="font-mono font-semibold text-sm text-gray-100 ml-2">{game.away_score}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-200 truncate flex-1">{game.home_team}</span>
        <span className="font-mono font-semibold text-sm text-gray-100 ml-2">{game.home_score}</span>
      </div>
      <div className="mt-1.5 text-[10px] font-mono text-muted">{game.status}</div>
    </div>
  );
}

function MultiSportScores() {
  const { data: nflData } = useApi('/api/scores/nfl');
  const { data: mlbData } = useApi('/api/scores/mlb');

  const extraGames = [
    ...(nflData?.games || []).slice(0, 1),
    ...(mlbData?.games || []).slice(0, 1),
  ];

  if (extraGames.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {extraGames.map(g => <ScoreMiniCard key={g.id} game={g} />)}
    </div>
  );
}

function NewsHeadlineCard({ article }) {
  return (
    <a
      href={article.url !== '#' ? article.url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-card border border-border rounded p-2.5 hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <SportBadge sport={article.sport_tag} size="xs" />
        <TimeAgo date={article.publishedAt} />
      </div>
      <p className="text-xs text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
        {article.title}
      </p>
      <p className="text-[10px] text-muted mt-1 font-mono">{article.source}</p>
    </a>
  );
}

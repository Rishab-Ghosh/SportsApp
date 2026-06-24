import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import TimeAgo from '../components/TimeAgo';
import { SkeletonCard } from '../components/Skeleton';

const RECAP_KEYWORDS = ['game', 'score', 'result', 'win', 'loss', 'beat', 'defeated', 'victory', 'final', 'recap', 'match', 'homers', 'goal', 'shootout', 'overtime'];

function isRecap(title) {
  const t = title.toLowerCase();
  return RECAP_KEYWORDS.some(kw => t.includes(kw));
}

export default function NewsTab() {
  // Use enriched feed — includes market_match on articles that overlap with Kalshi
  const { data: newsData, loading: nl } = useApi('/api/news/enriched');
  const { data: marketsData } = useApi('/api/kalshi/sports-markets');

  const articles = newsData?.articles || [];
  const markets = marketsData?.markets || [];

  const breaking = articles;
  const recaps = useMemo(() => articles.filter(a => isRecap(a.title)), [articles]);
  const marketMoves = useMemo(() =>
    [...markets]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 10),
    [markets]
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Breaking */}
      <section>
        <SectionHeader label="BREAKING" sub="all headlines · live feed" count={breaking.length} />
        <div className="space-y-2">
          {nl
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)
            : breaking.map((a, i) => <NewsCard key={i} article={a} />)
          }
        </div>
      </section>

      {/* Scores & Recaps */}
      <section>
        <SectionHeader label="SCORES & RECAPS" sub="game results · highlights" count={recaps.length} />
        <div className="space-y-2">
          {nl ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)
          ) : recaps.length === 0 ? (
            <EmptyState msg="No recaps available" />
          ) : (
            recaps.map((a, i) => <NewsCard key={i} article={a} />)
          )}
        </div>
      </section>

      {/* Market Moves */}
      <section>
        <SectionHeader label="MARKET MOVES" sub="Kalshi · by volume" count={marketMoves.length} />
        <div className="space-y-2">
          {marketsData === null ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={4} />)
          ) : marketMoves.length === 0 ? (
            <EmptyState msg="No market data" />
          ) : (
            marketMoves.map(m => <MarketMoveCard key={m.id} market={m} />)
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label, sub, count }) {
  return (
    <div className="mb-3 pb-1.5 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono font-semibold text-accent tracking-widest">{label}</div>
        {count != null && (
          <span className="text-[10px] font-mono text-muted bg-border rounded px-1.5 py-0.5">{count}</span>
        )}
      </div>
      {sub && <div className="text-[10px] text-muted font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="bg-card border border-border rounded p-4 text-center text-muted text-xs font-mono">{msg}</div>
  );
}

function NewsCard({ article }) {
  const match = article.market_match;

  return (
    <div className={`bg-card border rounded p-3 transition-colors ${match ? 'border-positive/30' : 'border-border'}`}>
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <SportBadge sport={article.sport_tag} size="xs" />
        <span className="text-[10px] font-mono text-muted truncate">{article.source}</span>
        <div className="ml-auto">
          <TimeAgo date={article.publishedAt} />
        </div>
      </div>

      <a
        href={article.url !== '#' ? article.url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <p className="text-xs text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
          {article.title}
        </p>
      </a>

      {/* Market match badge — only if enriched data has a match */}
      {match && (
        <div className="mt-2 pt-2 border-t border-positive/20">
          <a
            href={match.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-positive border border-positive/40 bg-positive/10 rounded px-2 py-1 hover:bg-positive/20 transition-colors"
          >
            <span>📈</span>
            <span>Live Market — YES {match.yes_price}¢</span>
          </a>
        </div>
      )}
    </div>
  );
}

function MarketMoveCard({ market }) {
  const yes = market.yes_price ?? 50;
  const vol = market.volume;
  const isSignificant = yes >= 70 || yes <= 30;

  return (
    <div className={`bg-card border rounded p-3 ${isSignificant ? 'border-accent/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-gray-200 leading-snug flex-1 line-clamp-2">{market.title}</p>
        <SportBadge sport={market.sport_tag} size="xs" />
      </div>
      <OddsBar yesPrice={yes} noPrice={market.no_price} compact />
      <div className="flex justify-between mt-2 text-[10px] font-mono text-muted">
        <span>
          VOL{' '}
          <span className="text-positive font-semibold">
            {vol >= 1000000 ? `$${(vol / 1000000).toFixed(1)}M` : vol >= 1000 ? `$${(vol / 1000).toFixed(0)}K` : `$${vol || 0}`}
          </span>
        </span>
        {isSignificant && (
          <span className={yes >= 70 ? 'text-positive font-semibold' : 'text-negative font-semibold'}>
            {yes >= 70 ? '▲ LIKELY' : '▼ UNLIKELY'}
          </span>
        )}
      </div>
    </div>
  );
}

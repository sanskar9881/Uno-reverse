import type { CSSProperties } from 'react';
import type { Card } from '@shared';
import { cn } from '../../utils/cn';
import { ReverseIcon, SkipIcon } from './Glyphs';

function CenterGlyph({ card }: { card: Card }) {
  switch (card.value) {
    case 'skip':
      return (
        <div className="uno-card__glyph">
          <SkipIcon />
        </div>
      );
    case 'reverse':
      return (
        <div className="uno-card__glyph">
          <ReverseIcon />
        </div>
      );
    case 'draw2':
      return <div className="uno-card__glyph uno-card__glyph--text">+2</div>;
    case 'wild4':
      return <div className="uno-card__glyph uno-card__glyph--text">+4</div>;
    case 'wild':
      return null;
    default:
      return (
        <div className={cn('uno-card__glyph uno-card__glyph--number', (card.value === '6' || card.value === '9') && 'underline-glyph')}>
          {card.value}
        </div>
      );
  }
}

function CornerGlyph({ card }: { card: Card }) {
  switch (card.value) {
    case 'skip':
      return <SkipIcon />;
    case 'reverse':
      return <ReverseIcon />;
    case 'draw2':
      return <>+2</>;
    case 'wild4':
      return <>+4</>;
    case 'wild':
      return <span className="uno-card__mini-diamond" />;
    default:
      return <span className={card.value === '6' || card.value === '9' ? 'underline-glyph' : undefined}>{card.value}</span>;
  }
}

interface CardFaceProps {
  card: Card;
  className?: string;
  style?: CSSProperties;
}

/** A card face. Purely visual; wrap it in a button to make it interactive. */
export function CardFace({ card, className, style }: CardFaceProps) {
  return (
    <div className={cn('uno-card', `uno-card--${card.color}`, className)} style={style} aria-hidden>
      <div className="uno-card__frame" />
      <div className="uno-card__diamond" />
      <CenterGlyph card={card} />
      <div className="uno-card__corner uno-card__corner--tl">
        <CornerGlyph card={card} />
      </div>
      <div className="uno-card__corner uno-card__corner--br">
        <CornerGlyph card={card} />
      </div>
    </div>
  );
}

export function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('uno-card uno-card--back', className)} style={style} aria-hidden>
      <div className="uno-card__frame" />
      <div className="uno-card__emblem">
        <span className="bg-card-red" />
        <span className="bg-card-yellow" />
        <span className="bg-card-blue" />
        <span className="bg-card-green" />
      </div>
    </div>
  );
}

// Aarka Tech brand mark: the supplied Aarka "A" (milk) on a brand-orange circle.
// Derived from "Aarka Plain Logo.png" by the brand script;
// the artwork is extracted from the original, never redrawn. Kept under the old
// component name so every existing placement picks up the new identity.
export function CoMark({ size = 28 }: { size?: number }) {
  const src = size > 48 ? "/brand/arka-icon-192.png" : "/brand/arka-icon-64.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  );
}

// Wordmark: the mark plus the product name set in the UI typeface.
export function ArkaWordmark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CoMark size={size} />
      <span className="font-sans text-[1.15rem] font-extrabold leading-none tracking-[-0.03em] text-foreground">
        Aarka <span className="text-brand-text">Tech</span>
      </span>
    </span>
  );
}

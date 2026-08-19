export function WaveLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/wave-logo.png"
      alt=""
      className={`wave-logo ${className}`.trim()}
      width={96}
      height={96}
      decoding="async"
    />
  );
}

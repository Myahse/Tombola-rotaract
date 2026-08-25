import { useEffect, useRef } from "react";

type VideoTileProps = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  label?: string;
  className?: string;
};

export function VideoTile({ stream, muted = false, mirror = false, label, className = "" }: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  return (
    <div className={`call-tile ${className}`.trim()}>
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? "is-mirror" : ""} />
      {label ? <span className="call-label">{label}</span> : null}
    </div>
  );
}

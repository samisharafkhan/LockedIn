import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  src: string;
  open: boolean;
  onClose: () => void;
};

export function PhotoLightbox({ src, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Profile photo">
      <button type="button" className="photo-lightbox__backdrop" onClick={onClose} aria-label="Close" />
      <div className="photo-lightbox__stage">
        <button type="button" className="photo-lightbox__x" onClick={onClose} aria-label="Close">
          <X size={26} strokeWidth={2} />
        </button>
        <img src={src} alt="" className="photo-lightbox__img" draggable={false} />
      </div>
    </div>
  );
}

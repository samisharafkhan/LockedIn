import { useEffect, useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ANIMAL_AVATARS, type AnimalAvatarId } from "../data/avatarAnimals";
import type { AvatarFields } from "../types";
import { compressImageToDataUrl } from "../lib/avatarImage";
import { AvatarDisplay } from "./AvatarDisplay";
import { PhotoLightbox } from "./PhotoLightbox";

const MARKS = ["◆", "◇", "◎", "✶", "⌁", "☽", "○"];

type Props = {
  value: AvatarFields;
  onChange: (next: AvatarFields) => void;
  /** Larger preview + spacing for profile settings */
  layout?: "compact" | "comfortable";
};

export function AvatarPicker({ value, onChange, layout = "compact" }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!value.avatarImageDataUrl) setZoomOpen(false);
  }, [value.avatarImageDataUrl]);

  const pickImage = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange({
        avatarImageDataUrl: dataUrl,
        avatarAnimalId: null,
        avatarEmoji: value.avatarEmoji,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not use that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearImage = () => {
    setErr(null);
    setZoomOpen(false);
    onChange({
      avatarImageDataUrl: null,
      avatarAnimalId: value.avatarAnimalId,
      avatarEmoji: value.avatarEmoji,
    });
  };

  const pickAnimal = (id: AnimalAvatarId) => {
    setErr(null);
    onChange({
      avatarImageDataUrl: null,
      avatarAnimalId: id,
      avatarEmoji: value.avatarEmoji,
    });
  };

  const pickMark = (m: string) => {
    setErr(null);
    onChange({
      avatarImageDataUrl: null,
      avatarAnimalId: null,
      avatarEmoji: m,
    });
  };

  const wrap = layout === "comfortable" ? "avatar-picker avatar-picker--comfortable" : "avatar-picker";
  const hasPhoto = Boolean(value.avatarImageDataUrl);

  return (
    <div className={wrap}>
      <div className="avatar-picker__preview">
        <div className="avatar-picker__preview-wrap">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="avatar-picker__file"
            onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
          />

          {hasPhoto ? (
            <button
              type="button"
              className="avatar-picker__photo-hit"
              onClick={() => setZoomOpen(true)}
              aria-label="View profile photo full size"
            >
              <AvatarDisplay source={value} size="lg" />
            </button>
          ) : (
            <div className="avatar-picker__photo-hit avatar-picker__photo-hit--static" aria-hidden>
              <AvatarDisplay source={value} size="lg" />
            </div>
          )}

          <label
            htmlFor={inputId}
            className={`avatar-picker__plus-fab ${busy ? "avatar-picker__plus-fab--busy" : ""}`}
            title={hasPhoto ? "Change photo" : "Add photo"}
            aria-label={hasPhoto ? "Change profile photo" : "Add profile photo"}
          >
            <Plus size={22} strokeWidth={2.5} aria-hidden />
          </label>
        </div>
      </div>

      {hasPhoto && value.avatarImageDataUrl ? (
        <PhotoLightbox src={value.avatarImageDataUrl} open={zoomOpen} onClose={() => setZoomOpen(false)} />
      ) : null}

      <div className="avatar-picker__actions">
        {hasPhoto ? (
          <button type="button" className="btn btn--ghost avatar-picker__remove" onClick={clearImage}>
            <Trash2 size={18} strokeWidth={2} aria-hidden />
            Remove photo
          </button>
        ) : null}
        {busy ? <span className="avatar-picker__busy">Updating…</span> : null}
      </div>

      <p className="avatar-picker__hint">Tap + to add a photo. Tap your picture to view it full screen.</p>
      {err ? <p className="avatar-picker__err">{err}</p> : null}

      <p className="avatar-picker__label">Animals</p>
      <div className="avatar-picker__animals" role="listbox" aria-label="Animal avatar">
        {ANIMAL_AVATARS.map(({ id, label, Icon }) => {
          const on = value.avatarAnimalId === id && !value.avatarImageDataUrl;
          return (
            <button
              key={id}
              type="button"
              className={`animal-chip ${on ? "animal-chip--on" : ""}`}
              onClick={() => pickAnimal(id)}
              aria-pressed={on}
              title={label}
            >
              <Icon size={22} strokeWidth={2} aria-hidden />
            </button>
          );
        })}
      </div>

      <p className="avatar-picker__label">Symbols</p>
      <div className="emoji-row" role="listbox" aria-label="Symbol avatar">
        {MARKS.map((m) => {
          const on =
            !value.avatarImageDataUrl && !value.avatarAnimalId && value.avatarEmoji === m;
          return (
            <button
              key={m}
              type="button"
              className={`emoji-chip ${on ? "emoji-chip--on" : ""}`}
              onClick={() => pickMark(m)}
              aria-pressed={on}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

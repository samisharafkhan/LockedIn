import { useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { ANIMAL_AVATARS, type AnimalAvatarId } from "../data/avatarAnimals";
import type { AvatarFields } from "../types";
import { compressImageToDataUrl } from "../lib/avatarImage";
import { AvatarDisplay } from "./AvatarDisplay";

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

  return (
    <div className={wrap}>
      <div className="avatar-picker__preview">
        <AvatarDisplay source={value} size="lg" />
      </div>

      <div className="avatar-picker__row">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="avatar-picker__file"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        <label htmlFor={inputId} className="btn btn--outline avatar-picker__upload">
          <ImagePlus size={18} strokeWidth={2} aria-hidden />
          {busy ? "Working…" : "Upload photo"}
        </label>
        {value.avatarImageDataUrl ? (
          <button type="button" className="btn btn--ghost avatar-picker__remove" onClick={clearImage}>
            <Trash2 size={18} strokeWidth={2} aria-hidden />
            Remove
          </button>
        ) : null}
      </div>
      <p className="avatar-picker__hint">Photos are cropped and saved on this device only.</p>
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

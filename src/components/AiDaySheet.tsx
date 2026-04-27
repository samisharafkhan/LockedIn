import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { generateDayBlocksFromText } from "../lib/geminiDay";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AiDaySheet({ open, onClose }: Props) {
  const { t, addBlock } = useSchedule();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    const v = text.trim();
    if (!v.length) {
      setErr(t("build_ai_err_empty"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const blocks = await generateDayBlocksFromText(v);
      // Keep the existing schedule and append generated blocks.
      for (const block of blocks) addBlock(block);
      setText("");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet sheet--fullscreen" role="dialog" aria-modal="true" aria-labelledby="ai-day-title">
      <button type="button" className="sheet__backdrop" aria-label={t("block_close")} onClick={onClose} />
      <div className="sheet__panel glass-panel">
        <div className="sheet__head">
          <div className="sheet__grab" aria-hidden />
          <div className="sheet__top">
            <h2 id="ai-day-title" className="sheet__title sheet__title--row">
              <Sparkles size={22} strokeWidth={2} className="ai-day__icon" aria-hidden />
              {t("build_ai_title")}
            </h2>
            <button type="button" className="icon-btn glass-hit" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <p className="sheet__lede">{t("build_ai_lede")}</p>
          <p className="build-ai__key-hint friends__muted">{t("build_ai_key_hint")}</p>
          <label className="visually-hidden" htmlFor="ai-day-text">
            {t("build_ai_label")}
          </label>
          <textarea
            id="ai-day-text"
            className="build-ai__textarea"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("build_ai_placeholder")}
            disabled={busy}
          />
          {err ? <p className="form__error build-ai__err">{err}</p> : null}
          <div className="build-ai__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? t("build_ai_generating") : t("build_ai_submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

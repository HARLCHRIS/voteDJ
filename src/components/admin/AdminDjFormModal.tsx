'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { validateAndReadDjPhotoFile } from '@/lib/media/validate-dj-photo';
import type {
  AdminDjFormInput,
  AdminPerformanceRankingRow,
  CsvDjImportReport,
  PublicRoundSummary,
} from '@/types';

interface AdminDjFormPanelProps {
  rounds: PublicRoundSummary[];
  editingRow: AdminPerformanceRankingRow | null;
  onCancelEdit: () => void;
  onCreateDj: (input: AdminDjFormInput) => Promise<unknown>;
  onUpdateDj: (djId: string, input: AdminDjFormInput) => Promise<unknown>;
  onImportCsv: (csvText: string) => Promise<CsvDjImportReport | null>;
}

/**
 * Formulaire rapide d'enregistrement/modification d'un DJ (nom + prime obligatoires),
 * champ photo détourée PNG/WebP (>= 1 200 px, < 300 Ko) avec aperçu sur fond vert,
 * et import CSV facultatif (FR-15, FR-16).
 */
export function AdminDjFormPanel({
  rounds,
  editingRow,
  onCancelEdit,
  onCreateDj,
  onUpdateDj,
  onImportCsv,
}: AdminDjFormPanelProps) {
  const defaultRoundId = editingRow?.roundId ?? rounds[0]?.id ?? '';
  const [mode, setMode] = useState<'form' | 'csv'>('form');
  const [stageName, setStageName] = useState(editingRow?.stageName ?? '');
  const [roundId, setRoundId] = useState(defaultRoundId);
  const [genre, setGenre] = useState(editingRow?.genre ?? '');
  const [photoUrl, setPhotoUrl] = useState(editingRow?.photoUrl ?? '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoInfo, setPhotoInfo] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [csvText, setCsvText] = useState('');
  const [csvReport, setCsvReport] = useState<CsvDjImportReport | null>(null);

  const isRoundLocked =
    Boolean(editingRow) && editingRow?.status !== 'waiting';

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setPhotoInfo(null);

    try {
      const result = await validateAndReadDjPhotoFile(file);
      if (!result.valid) {
        setPhotoError(result.error);
        e.target.value = '';
        return;
      }

      if (result.previewUrl) {
        setPhotoUrl(result.previewUrl);
        setPhotoInfo(
          `Image valide (${result.width}×${result.height} px • ${Math.round(
            result.sizeBytes / 1024
          )} Ko)`
        );
      }
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Impossible de valider cette image.'
      );
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim() || !roundId) return;

    setSubmitting(true);
    try {
      const payload: AdminDjFormInput = {
        stageName: stageName.trim(),
        roundId,
        genre: genre.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        mediaUrl: mediaUrl.trim() || undefined,
      };

      if (editingRow) {
        await onUpdateDj(editingRow.djId, payload);
        onCancelEdit();
      } else {
        await onCreateDj(payload);
        setStageName('');
        setGenre('');
        setPhotoUrl('');
        setPhotoInfo(null);
        setPhotoError(null);
        setBio('');
        setMediaUrl('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleRunCsvImport = async () => {
    if (!csvText.trim()) return;
    setSubmitting(true);
    try {
      const report = await onImportCsv(csvText);
      setCsvReport(report);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-[#042812]/90 p-5 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black tracking-wide text-[#D9E81B] uppercase">
          {editingRow
            ? `Modifier ${editingRow.stageName}`
            : 'Enregistrer un DJ'}
        </h3>

        {!editingRow ? (
          <div className="flex rounded-xl bg-black/35 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('form')}
              className={`rounded-lg px-3 py-1 transition ${
                mode === 'form'
                  ? 'bg-[#76E000] text-[#063B1B]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Formulaire rapide
            </button>
            <button
              type="button"
              onClick={() => setMode('csv')}
              className={`rounded-lg px-3 py-1 transition ${
                mode === 'csv'
                  ? 'bg-[#76E000] text-[#063B1B]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              Import CSV
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-xs font-bold text-white/80 hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
            Annuler
          </button>
        )}
      </div>

      {mode === 'form' || editingRow ? (
        <form onSubmit={handleSubmitForm} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-white/85">
              Nom de scène *
            </label>
            <input
              type="text"
              required
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="Ex : DJ Kerozen"
              className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#76E000] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white/85">
              Prime * {isRoundLocked ? '(verrouillée après ouverture)' : ''}
            </label>
            <select
              required
              disabled={isRoundLocked}
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-[#76E000] focus:outline-none disabled:opacity-50"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#063B1B]">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white/70">
              Style / Genre (facultatif)
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Afrobeats, Amapiano, Coupé-Décalé..."
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#76E000] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-white/70">
              Photo détourée URL (PNG/WebP, facultatif)
            </label>
            <input
              type="text"
              value={photoUrl.startsWith('data:') ? '' : photoUrl}
              onChange={(e) => {
                setPhotoError(null);
                setPhotoInfo(null);
                setPhotoUrl(e.target.value);
              }}
              placeholder="https://... ou importez un fichier ci-dessous"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#76E000] focus:outline-none"
            />
          </div>

          {/* Upload photo détourée PNG/WebP + validation (>=1200px, <300Ko) + aperçu fond vert */}
          <div className="sm:col-span-2 rounded-xl border border-white/15 bg-black/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white/90">
                  Importer une photo détourée (facultatif)
                </p>
                <p className="text-[11px] text-white/65">
                  Format PNG ou WebP à fond transparent • Hauteur ≥ 1 200 px •
                  Poids &lt; 300 Ko
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#76E000]/50 bg-[#09421A] px-3 py-2 text-xs font-bold text-[#D9E81B] transition hover:bg-[#0E6B32]">
                  <ImagePlus className="h-4 w-4" />
                  Choisir PNG / WebP
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    onChange={(e) => void handlePhotoFileChange(e)}
                    className="hidden"
                  />
                </label>

                {photoUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setPhotoError(null);
                      setPhotoInfo(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-400/30 bg-red-950/50 px-2.5 py-2 text-xs font-bold text-red-200 hover:bg-red-900/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Retirer
                  </button>
                ) : null}
              </div>
            </div>

            {photoError ? (
              <p
                role="alert"
                className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-950/60 px-3 py-2 text-xs font-bold text-red-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {photoError}
              </p>
            ) : null}

            {photoInfo ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#76E000]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {photoInfo}
              </p>
            ) : null}

            {photoUrl ? (
              <div className="mt-3 flex items-center gap-4">
                <div className="poster-bg relative flex h-44 w-32 items-end justify-center overflow-hidden rounded-xl border border-white/25 shadow-inner">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-4 text-center text-2xl font-black tracking-tight text-white/80"
                  >
                    VOTE
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="Aperçu détouré sur fond vert"
                    className="relative z-10 h-40 w-auto object-contain object-bottom"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-white/75">
                  Aperçu du rendu détouré sur le fond vert officiel de l’affiche
                  « VOTE ».
                </p>
              </div>
            ) : null}
          </div>

          <div className="sm:col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#76E000] px-5 py-2.5 text-xs font-black uppercase text-[#063B1B] shadow-md transition hover:bg-[#8ef31a] disabled:opacity-50"
            >
              {editingRow ? (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer les modifications
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Ajouter le DJ à la prime
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
            <p>
              Colonnes attendues : <code>nom,prime</code> (ex :{' '}
              <code>DJ Spark,Prime 1</code>)
            </p>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20">
              <Upload className="h-3.5 w-3.5" />
              Choisir un fichier .csv
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'nom,prime\nDJ Nova,Prime 1\nDJ Tempo,Prime 2'}
            className="w-full rounded-xl border border-white/20 bg-black/40 p-3 font-mono text-xs text-white placeholder:text-white/35 focus:border-[#76E000] focus:outline-none"
          />

          <button
            type="button"
            disabled={submitting || !csvText.trim()}
            onClick={handleRunCsvImport}
            className="inline-flex items-center gap-2 rounded-xl bg-[#76E000] px-4 py-2.5 text-xs font-black uppercase text-[#063B1B] disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importer la liste CSV
          </button>

          {csvReport ? (
            <div className="rounded-xl border border-white/15 bg-black/40 p-3 text-xs">
              <p className="font-bold text-[#76E000]">
                {csvReport.importedCount} / {csvReport.totalRows} DJ importés avec
                succès.
              </p>
              {csvReport.errors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-red-300">
                  {csvReport.errors.map((err, i) => (
                    <li key={`${err.rowNumber}-${i}`}>
                      Ligne {err.rowNumber} ({err.rawName} / {err.rawRound}) :{' '}
                      {err.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

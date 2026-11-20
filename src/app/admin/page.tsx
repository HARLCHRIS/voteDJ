import { FestivalHeader } from '@/components/shared/FestivalHeader';
import { AdminLiveConsole } from '@/components/admin/AdminLiveConsole';

/**
 * Page Back-office Régie Live & Résultats (protégée par middleware + vérification de rôle).
 */
export default function AdminPage() {
  return (
    <div className="min-h-screen pb-14">
      <FestivalHeader />
      <main className="mt-4">
        <AdminLiveConsole />
      </main>
    </div>
  );
}


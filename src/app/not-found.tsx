import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#063B1B] p-6 text-center text-white">
      <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md">
        <h1 className="text-6xl font-black text-[#D9E81B]">404</h1>
        <h2 className="text-xl font-bold uppercase tracking-wider text-[#76E000]">
          Page introuvable
        </h2>
        <p className="text-sm text-white/70">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/vote"
          className="inline-block rounded-xl bg-gradient-to-r from-[#0E6B32] to-[#28C840] px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Retourner au vote
        </Link>
      </div>
    </main>
  );
}

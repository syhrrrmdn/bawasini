import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-block mb-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-3xl">🛠️</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-3">
            Developer Tools Suite
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Kumpulan tool praktis untuk kebutuhan developer. Pilih menu di bawah untuk memulai.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/bulk-api-sender"
            className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-md shadow-amber-500/30">
                <span className="text-2xl">📡</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bulk API Sender
              </h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                Kirim ratusan object JSON satu per satu (sequential) untuk testing API.
                Cocok untuk bulk import, migrasi data, atau stress test endpoint.
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-xs font-medium bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                  Batch Request
                </span>
                <span className="text-xs font-medium bg-orange-50 text-orange-700 px-3 py-1 rounded-full">
                  Custom Header
                </span>
                <span className="text-xs font-medium bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full">
                  Proxy CORS Bypass
                </span>
                <span className="text-xs font-medium bg-red-50 text-red-700 px-3 py-1 rounded-full">
                  Retry Failed
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-600 font-semibold group-hover:gap-4 transition-all">
                Buka tool
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          <Link
            href="/image-converter"
            className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-5 shadow-md shadow-emerald-500/30">
                <span className="text-2xl">🖼️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Image Converter
              </h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                Konversi gambar massal ke format JPG, PNG, atau WebP dengan kualitas kustom.
                Support upload ZIP untuk batch processing sekaligus.
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                  JPG / PNG / WebP
                </span>
                <span className="text-xs font-medium bg-teal-50 text-teal-700 px-3 py-1 rounded-full">
                  ZIP Bulk
                </span>
                <span className="text-xs font-medium bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full">
                  Quality Slider
                </span>
                <span className="text-xs font-medium bg-green-50 text-green-700 px-3 py-1 rounded-full">
                  Preview Before/After
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-semibold group-hover:gap-4 transition-all">
                Buka tool
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <footer className="text-center text-xs text-gray-400 mt-16">
          Built with Next.js & Tailwind CSS • Ready for Vercel deployment
        </footer>
      </div>
    </main>
  );
}

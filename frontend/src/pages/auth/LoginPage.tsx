import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const slides = [
  {
    quote: "Todas tus conversaciones de WhatsApp en un solo lugar",
    description:
      "Centraliza bandejas, asigna agentes y responde a tus clientes sin perder el hilo de cada chat.",
  },
  {
    quote: "Tu equipo ve qué está pendiente y qué es urgente",
    description:
      "Etiquetas, notas y estados te ayudan a priorizar sin revisar conversación por conversación.",
  },
  {
    quote: "Soporte ágil, con la calidez que esperan tus clientes",
    description:
      "Plantillas, respuestas rápidas y multimedia en un solo panel pensado para equipos en Perú.",
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const success = await login(username, password, rememberMe);
    setLoading(false);

    if (!success) {
      setError("Usuario o contraseña incorrectos");
      return;
    }

    navigate("/inbox", { replace: true });
  };

  const slide = slides[activeSlide];

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="flex w-full max-w-[980px] min-h-[580px] rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)] border border-white/5">
          <div className="flex-1 bg-[#232323] px-8 sm:px-10 py-10 flex flex-col justify-center">
            <div className="max-w-[360px] mx-auto w-full">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">Chatpool</span>
              </div>

              <h1 className="text-[28px] leading-tight font-semibold text-white mb-2">
                ¡Bienvenido de nuevo!
              </h1>
              <p className="text-sm text-[#9aa0a6] mb-8">
                Inicia sesión para continuar a Chatpool.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-white mb-1.5">
                    Usuario <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. soporte"
                    autoComplete="username"
                    className="w-full rounded-lg border border-[#3d3d3d] bg-[#2f2f2f] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-brand)] placeholder:text-[#6f747c]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm text-white">
                      Contraseña <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setError("Contacta al administrador para restablecer tu contraseña")}
                      className="text-xs text-[var(--color-brand)] hover:opacity-80 transition-opacity"
                    >
                      ¿Has olvidado tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#3d3d3d] bg-[#2f2f2f] px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-[var(--color-brand)]"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-white transition-colors"
                      title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#4a4a4a] bg-[#2f2f2f] accent-[var(--color-brand)]"
                  />
                  <span className="text-sm text-[#b0b5bd]">Acuérdate de mí</span>
                </label>

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[var(--color-brand)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-light)] disabled:opacity-60"
                >
                  {loading ? "Iniciando sesión…" : "Iniciar sesión"}
                </button>
              </form>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 relative overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80')",
              }}
            />
            <div className="absolute inset-0 bg-[var(--color-brand)]/75 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

            <div className="relative z-10 flex flex-col justify-end p-10 text-white">
              <p className="text-[28px] leading-snug font-semibold mb-4 max-w-md animate-fade-in">
                “{slide.quote}”
              </p>
              <p className="text-sm leading-relaxed text-white/85 max-w-md animate-fade-in">
                {slide.description}
              </p>

              <div className="flex items-center gap-2 mt-10">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    className={cn(
                      "h-1 rounded-full transition-all",
                      index === activeSlide
                        ? "w-8 bg-white"
                        : "w-4 bg-white/35 hover:bg-white/55"
                    )}
                    aria-label={`Ir a diapositiva ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="pb-6 text-center text-xs text-[#6f747c]">
        © {new Date().getFullYear()} Chatpool. Plataforma de mensajería para equipos.
      </footer>
    </div>
  );
}

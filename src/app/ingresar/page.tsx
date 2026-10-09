import { AuthForm } from '@/components/auth-form';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="container page-shell">
      <div className="auth-shell">
        <div className="page-header">
          <span className="eyebrow">Tu próxima oportunidad</span>
          <h1>Bienvenido a reacondicionargdos.</h1>
          <p>Ingresá o creá tu cuenta con un enlace seguro.</p>
        </div>
        {error && (
          <div className="notice error">
            El enlace venció o ya se utilizó. Pedí uno nuevo desde este formulario.
          </div>
        )}
        <div className="panel">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}

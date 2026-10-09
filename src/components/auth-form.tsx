'use client';
import { useActionState } from 'react';
import { sendAccessLink } from '@/app/actions/auth';
export function AuthForm() {
  const [state, action, pending] = useActionState(sendAccessLink, {});
  return (
    <form action={action}>
      <label className="field">
        Tu nombre
        <input
          name="display_name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder="Nombre y apellido"
        />
      </label>
      <label className="field">
        Correo electrónico
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
        />
      </label>
      <label className="field">
        ¿Cómo vas a usar reacondicionargdos?
        <select name="role">
          <option value="cliente">Quiero vender o reparar mi equipo</option>
          <option value="tecnico">Soy técnico / reacondicionador</option>
        </select>
      </label>
      <label className="field">
        Localidad
        <input value="Rosario, Santa Fe" disabled />
      </label>
      <input name="city" value="Rosario" type="hidden" />
      <label className="check">
        <input name="consent" type="checkbox" required />
        <span>
          Opero en Rosario y acepto las{' '}
          <a href="/terminos" className="text-link">
            condiciones de uso
          </a>
          .
        </span>
      </label>
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="notice success" role="status">
          {state.success}
        </div>
      )}
      <button disabled={pending} className="button full">
        {pending ? 'Enviando…' : 'Recibir enlace para ingresar'}
      </button>
      <p className="quote-foot">Sin contraseña. El enlace llega a tu correo.</p>
    </form>
  );
}

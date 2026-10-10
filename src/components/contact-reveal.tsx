'use client';
import { useActionState } from 'react';
import { revealContact } from '@/app/actions/contacts';
export function ContactReveal({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revealContact, {});
  return (
    <div className="contact-paywall">
      {state.contact ? (
        <>
          <h3>Contactá a {state.contact.contact_name}</h3>
          <div className="actions">
            {state.contact.whatsapp_e164 && (
              <a
                className="button"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${state.contact.whatsapp_e164.replace('+', '')}`}
              >
                WhatsApp
              </a>
            )}
            {state.contact.contact_email && (
              <a
                className="button secondary"
                href={`mailto:${encodeURIComponent(state.contact.contact_email)}`}
              >
                Email
              </a>
            )}
          </div>
        </>
      ) : (
        <form action={action}>
          <h3>Contactá al titular</h3>
          <p>
            El contacto es gratuito. Para prevenir extracción masiva, hay un límite de 30 contactos distintos cada 24 horas para todas las cuentas. No está
            permitida su extracción masiva ni su reventa.
          </p>
          <input type="hidden" name="id" value={id} />
          {state.error && <p role="alert">{state.error}</p>}
          <button className="button" disabled={pending}>
            {pending ? 'Verificando acceso…' : 'Ver contacto'}
          </button>
        </form>
      )}
    </div>
  );
}

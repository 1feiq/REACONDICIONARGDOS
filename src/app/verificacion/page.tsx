import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/data';
import { db } from '@/lib/supabase/server';
import { verificationLabels } from '@/lib/commerce';
import { CommerceForm } from '@/components/commerce-form';
export default async function Verification() {
  const p = await getProfile();
  if (!p) redirect('/ingresar');
  const client = (await db())!;
  const { data } = await client.from('users').select('verification_status').eq('id', p.id).single();
  return (
    <div className="container page-shell">
      <h1>Verificación de cuenta</h1>
      <section className="panel">
        <h2>{verificationLabels[data?.verification_status ?? 'unverified']}</h2>
        <p>
          Tu ingreso confirma acceso a tu correo, no tu identidad ni la propiedad de un dispositivo.
        </p>
        <p>
          El proveedor de identidad y la confirmación de teléfono aún no están integrados. No envíes
          fotos de documentos por formularios ni mensajes. Solicitar revisión no otorga una
          insignia.
        </p>
        <CommerceForm
          action="request_verification"
          label="Registrar mi solicitud de verificación"
        />
      </section>
    </div>
  );
}

export function DeviceSpecFields() {
  return (
    <fieldset className="panel">
      <legend>Estado declarado del equipo</legend>
      <p>
        Indicá «desconocido» cuando no puedas comprobar un dato. No publiques el IMEI en fotos ni en
        la descripción.
      </p>
      <div className="form-grid">
        {Object.entries({
          storage_capacity: 'Capacidad de almacenamiento (o desconocida)',
          physical_condition: 'Estado físico',
          screen: 'Estado de pantalla',
          battery: 'Batería comprobable o desconocida',
          motherboard: 'Placa base conocida o desconocida',
          previous_repairs: 'Reparaciones anteriores o desconocidas',
        }).map(([k, v]) => (
          <label className="field" key={k}>
            {v}
            <input
              name={k}
              required
              maxLength={
                k === 'storage_capacity'
                  ? 40
                  : k === 'physical_condition' || k === 'previous_repairs'
                    ? 500
                    : 300
              }
            />
          </label>
        ))}
        <label className="field">
          ¿Enciende?
          <select name="power_on">
            <option value="desconocido">No comprobado</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="field">
          Bloqueo de activación, cuentas y restricciones
          <select name="activation_lock">
            <option value="desconocido">No comprobado</option>
            <option value="libre">Declaro que no tiene bloqueos</option>
            <option value="bloqueado">Tiene bloqueos / cuentas asociadas</option>
          </select>
        </label>
        <label className="field">
          Precio solicitado (ARS, opcional para reparación)
          <input name="asking_price" type="number" min="1" max="999999999" step="0.01" />
        </label>
        <label className="field">
          Entrega
          <select name="delivery">
            <option value="presencial">Presencial en Rosario</option>
            <option value="envio">Envío</option>
            <option value="ambas">Ambas</option>
          </select>
        </label>
        <label className="field">
          Identificador privado, opcional
          <input name="identifier" minLength={5} maxLength={32} autoComplete="off" />
          <small>Solo vos y administración. No verifica titularidad.</small>
        </label>
        <label className="field">
          Tipo
          <select name="identifier_kind">
            <option value="imei">IMEI (15 dígitos)</option>
            <option value="serial">Número de serie</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input name="accepts_offers" type="checkbox" defaultChecked />
        Acepto ofertas
      </label>
      <p>
        Video opcional: próximamente, cuando esté disponible el procesamiento seguro. Los datos del
        formulario son declaraciones, no una verificación independiente.
      </p>
    </fieldset>
  );
}

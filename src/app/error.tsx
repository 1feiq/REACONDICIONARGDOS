'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container section">
      <div className="empty">
        <h1>No pudimos cargar esta página.</h1>
        <p>Intentá nuevamente en unos instantes.</p>
        <button className="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

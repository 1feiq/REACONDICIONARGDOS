'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { DeviceCard } from './device-card';
import { categories } from '@/lib/config';
import type { Device } from '@/lib/types';
export function Feed({ devices }: { devices: Device[] }) {
  const [category, setCategory] = useState('todos');
  const [intent, setIntent] = useState('todos');
  const [search, setSearch] = useState('');
  const filtered = devices.filter(
    (d) =>
      (category === 'todos' || d.category === category) &&
      (intent === 'todos' || d.intent === intent || d.intent === 'ambas') &&
      `${d.brand} ${d.model} ${d.neighborhood ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          aria-label="Buscar por marca, modelo o barrio"
          placeholder="Buscá por marca, modelo o barrio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="search"
          style={{ flex: '0 1 220px' }}
          aria-label="Filtrar por intención"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        >
          <option value="todos">Venta y reparación</option>
          <option value="vender">Equipos en venta</option>
          <option value="reparar">Buscan reparación</option>
        </select>
      </div>
      <div className="tabs" aria-label="Categorías">
        {[['todos', 'Todos los equipos'], ...Object.entries(categories)].map(([key, label]) => (
          <button
            key={key}
            className={`tab ${category === key ? 'active' : ''}`}
            aria-pressed={category === key}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '.85rem' }} aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'equipo disponible' : 'equipos disponibles'} en
        esta selección
      </p>
      <div className="device-grid">
        {filtered.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          <Search size={32} />
          <h3>No encontramos equipos con esos filtros.</h3>
          <p>Probá otra marca o revisá todas las categorías.</p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch('');
              setCategory('todos');
              setIntent('todos');
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { Inventario } from '@/components/magazzino/inventario';

export const metadata: Metadata = { title: 'Inventario — Gestionale Bar' };

export default async function PaginaInventario() {
  // L'inventario lo fa chi conta, non chi comanda: un barista che trova due
  // bottiglie in meno deve poterlo scrivere quando se ne accorge.
  await richiediAccesso();
  return <Inventario />;
}

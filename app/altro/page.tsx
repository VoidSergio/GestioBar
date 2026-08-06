import type { Metadata } from 'next';
import { richiediAccesso } from '@/lib/supabase/accesso';
import { MenuAltro } from '@/components/shell/menu-altro';

export const metadata: Metadata = { title: 'Altro — Gestionale Bar' };

export default async function PaginaAltro() {
  await richiediAccesso();
  return <MenuAltro />;
}

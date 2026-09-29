import type { ServiceOrderListItem } from '../types';
import { ArrowRightIcon, InboxIcon, MailIcon, SearchIcon } from './Icons';
import { Button, Card, EmptyState, SkeletonRows } from './ui';

export interface OSTableProps {
  items: ServiceOrderListItem[];
  loading: boolean;
  searchTerm: string;
  onOpen: (id: number) => void;
  /** Ausente para o perfil de consulta (não mostra o botão de cadastrar). */
  onCreate?: () => void;
}

/** Lista/tabela de OS cadastradas. */
export function OSTable({ items, loading, searchTerm, onOpen, onCreate }: OSTableProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        {searchTerm ? (
          <EmptyState
            icon={<SearchIcon className="h-7 w-7" />}
            title="Nenhuma OS encontrada"
            description={`Não encontramos nenhuma OS para "${searchTerm}". Tente outro número, cliente, obra ou fornecedor.`}
          />
        ) : (
          <EmptyState
            icon={<InboxIcon className="h-7 w-7" />}
            title="Nenhuma OS cadastrada"
            description={
              onCreate
                ? 'Cadastre a primeira ordem de serviço para começar a guardar os e-mails dos clientes.'
                : 'Ainda não existem ordens de serviço cadastradas no sistema.'
            }
            action={
              onCreate ? (
                <Button icon={<span className="text-base leading-none">+</span>} onClick={onCreate}>
                  Nova OS
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th scope="col" className="px-5 py-3">
                OS
              </th>
              <th scope="col" className="px-5 py-3">
                Cliente
              </th>
              <th scope="col" className="px-5 py-3">
                Obra
              </th>
              <th scope="col" className="px-5 py-3 text-center">
                E-mails
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr
                key={item.id}
                tabIndex={0}
                role="link"
                onClick={() => onOpen(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(item.id);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-indigo-50/50 focus:bg-indigo-50/60 focus:outline-none"
              >
                <td className="px-5 py-4">
                  <span className="font-mono text-sm font-bold text-slate-900">{item.numero_os}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm font-medium text-slate-800">{item.cliente}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200 ring-inset">
                    {item.obra}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      item.email_count > 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}
                  >
                    <MailIcon className="h-3.5 w-3.5" />
                    {item.email_count}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                    Abrir
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

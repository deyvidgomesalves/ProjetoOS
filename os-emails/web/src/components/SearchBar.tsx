import { CloseIcon, SearchIcon, SpinnerIcon } from './Icons';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

/** Campo de pesquisa principal: procura por número da OS, cliente, obra ou fornecedor. */
export function SearchBar({ value, onChange, loading = false }: SearchBarProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">
        <SearchIcon className="h-5 w-5" />
      </span>

      <input
        type="search"
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        placeholder="Pesquisar OS, cliente, obra ou fornecedor..."
        aria-label="Pesquisar OS, cliente, obra ou fornecedor"
        className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pr-24 pl-11 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />

      <div className="absolute inset-y-0 right-3 flex items-center gap-2">
        {loading ? <SpinnerIcon className="h-4 w-4 animate-spin text-indigo-500" /> : null}
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <CloseIcon className="h-3.5 w-3.5" />
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}

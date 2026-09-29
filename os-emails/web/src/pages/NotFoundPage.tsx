import { Link } from 'react-router-dom';
import { SearchIcon } from '../components/Icons';
import { Button, Card, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<SearchIcon className="h-7 w-7" />}
        title="Página não encontrada"
        description="O endereço acessado não existe neste sistema."
        action={
          <Link to="/">
            <Button>Ir para a lista de OS</Button>
          </Link>
        }
      />
    </Card>
  );
}

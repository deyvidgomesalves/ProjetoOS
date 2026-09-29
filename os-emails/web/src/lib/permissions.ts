import type { Role, SessionUser } from '../types';

/** O administrador pode tudo; o usuário comum só consulta (pesquisar, abrir e copiar). */
export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}

export function canManage(user: SessionUser | null): boolean {
  return isAdmin(user);
}

export function roleLabel(role: Role | undefined): string {
  return role === 'admin' ? 'Administrador' : 'Somente consulta';
}

/** Resumo das permissões (usado na tela de login e no cabeçalho). */
export function permissionSummary(role: Role | undefined): string {
  return role === 'admin'
    ? 'Pode cadastrar, editar, excluir OS e gerenciar os e-mails.'
    : 'Pode pesquisar, abrir as OS e copiar os e-mails.';
}

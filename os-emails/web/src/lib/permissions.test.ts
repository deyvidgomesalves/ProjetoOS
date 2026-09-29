import { describe, expect, it } from 'vitest';
import { canManage, isAdmin, permissionSummary, roleLabel } from './permissions';
import type { SessionUser } from '../types';

const admin: SessionUser = { username: 'admin', name: 'Administrador', role: 'admin' };
const usuario: SessionUser = { username: 'usuario', name: 'Usuário', role: 'user' };

describe('permissões por perfil', () => {
  it('reconhece o administrador', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(canManage(admin)).toBe(true);
  });

  it('trata o usuário comum como somente consulta', () => {
    expect(isAdmin(usuario)).toBe(false);
    expect(canManage(usuario)).toBe(false);
  });

  it('trata visitante (sem login) como sem permissão', () => {
    expect(isAdmin(null)).toBe(false);
    expect(canManage(null)).toBe(false);
  });

  it('descreve o perfil exibido no cabeçalho', () => {
    expect(roleLabel('admin')).toBe('Administrador');
    expect(roleLabel('user')).toBe('Somente consulta');
    expect(permissionSummary('admin')).toContain('cadastrar');
    expect(permissionSummary('user')).toContain('copiar');
  });
});

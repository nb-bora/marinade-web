/**
 * Le restaurant dans lequel l'utilisateur travaille en ce moment.
 *
 * Objet simple, sans Vue : le client HTTP en a besoin pour fixer `X-Tenant-ID` et ne doit
 * pas dépendre des stores de l'interface. Le store des restaurants en est le seul auteur.
 */
export class TenantContext {
  private current: string | null = null

  get id(): string | null {
    return this.current
  }

  set(id: string | null): void {
    this.current = id
  }
}

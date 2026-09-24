export class ModelMouseInput {
  private enabled = true
  private revision = 0
  private readonly targets = new Map<string, number>()

  constructor(private readonly writeParameter: (id: string, value: number) => void) { }

  public begin() {
    return this.revision
  }

  public isCurrent(token: number) {
    return token === this.revision
  }

  public latest(id: string) {
    return this.targets.get(id)
  }

  public accepts(token: number) {
    return this.enabled && token === this.revision
  }

  public setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return

    this.enabled = enabled
    this.revision++

    if (enabled) {
      for (const [id, value] of this.targets) this.writeParameter(id, value)
      return
    }

    // MikuCat's external overrides persist across frames. Do not freeze the last cursor pose.
    for (const id of [
      'ParamMouseX',
      'ParamMouseY',
      'ParamAngleX',
      'ParamAngleY',
      'ParamMouseLeftDown',
      'ParamMouseRightDown',
    ]) {
      this.writeParameter(id, 0)
    }
  }

  public reset() {
    this.enabled = true
    this.revision++
    this.targets.clear()
  }

  public write(id: string, value: number | boolean, token = this.revision) {
    if (!this.isCurrent(token)) return

    const numeric = Number(value)
    this.targets.set(id, numeric)
    if (this.enabled) this.writeParameter(id, numeric)
  }
}

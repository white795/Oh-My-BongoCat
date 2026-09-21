export type ModelMode = 'standard' | 'keyboard' | 'gamepad'
export type ModelPresetKey = ModelMode | 'mikucat'

export interface Model {
  id: string
  path: string
  mode: ModelMode
  isPreset: boolean
  presetKey?: ModelPresetKey
}

const presets: ReadonlyArray<{ key: ModelPresetKey, mode: ModelMode }> = [
  { key: 'standard', mode: 'standard' },
  { key: 'keyboard', mode: 'keyboard' },
  { key: 'gamepad', mode: 'gamepad' },
  { key: 'mikucat', mode: 'standard' },
]

export function initializeModelPresets(
  models: Model[],
  currentModelId: string | undefined,
  resolvePath: (key: ModelPresetKey) => string,
) {
  const presetModels = models.filter(model => model.isPreset)
  const builtIns = presets.map(({ key, mode }): Model => {
    // Legacy presets had one model per mode. Never use that fallback for MikuCat.
    const matched = presetModels.find(model => model.presetKey === key)
      ?? (key === mode
        ? presetModels.find(model => model.presetKey == null && model.mode === mode)
        : undefined)

    return {
      id: matched?.id ?? `preset:${key}`,
      presetKey: key,
      mode,
      isPreset: true,
      path: resolvePath(key),
    }
  })
  const nextModels = [...builtIns, ...models.filter(model => !model.isPreset)]

  return {
    models: nextModels,
    currentModel: nextModels.find(model => model.id === currentModelId) ?? nextModels[0],
  }
}

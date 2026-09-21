import type { ExpressionInfo, MotionInfo } from 'easy-live2d'

import { resolveResource } from '@tauri-apps/api/path'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { Model } from '@/utils/modelPresets'

import { initializeModelPresets } from '@/utils/modelPresets'
import { join } from '@/utils/path'

export type { Model, ModelMode } from '@/utils/modelPresets'

export const useModelStore = defineStore('model', () => {
  const modelReady = ref(true)
  const models = ref<Model[]>([])
  const currentModel = ref<Model>()
  const supportKeys = reactive<Record<string, string>>({})
  const pressedKeys = reactive<Record<string, string>>({})
  const currentMotions = ref<Array<[string, MotionInfo[]]>>([])
  const currentExpressions = ref<ExpressionInfo[]>([])
  const shortcuts = reactive<Record<string, string>>({})

  const init = async () => {
    const modelsPath = await resolveResource('assets/models')

    const next = initializeModelPresets(
      models.value,
      currentModel.value?.id,
      key => join(modelsPath, key),
    )

    currentModel.value = next.currentModel
    models.value = next.models
  }

  return {
    modelReady,
    models,
    currentModel,
    supportKeys,
    pressedKeys,
    currentMotions,
    currentExpressions,
    shortcuts,
    init,
  }
}, {
  tauri: {
    filterKeys: ['supportKeys', 'pressedKeys'],
  },
})

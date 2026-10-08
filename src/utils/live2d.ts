import type { MotionInfo } from 'easy-live2d'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Config, CubismSetting, Live2DSprite, Priority } from 'easy-live2d'
import { groupBy } from 'es-toolkit/compat'
import JSON5 from 'json5'
import { Application, Ticker } from 'pixi.js'

import type { ModelSize } from '@/composables/useModel'

import { i18n } from '@/locales'

import type { AngryAnimationIntent } from './angryAnimation'
import type { GuitarMotifId } from './guitarMotifs'
import type { GuitarPerformanceIntent, GuitarPerformanceTemplateId } from './guitarPerformance'
import type { ModelPresetKey } from './modelPresets'

import { AngryAnimation } from './angryAnimation'
import { GuitarHandAnimation } from './guitarHandAnimation'
import { ModelMouseInput } from './modelMouseInput'
import { MIKUCAT_ANGRY_OWNED_PARAMETERS, MIKUCAT_GUITAR_OWNED_PARAMETERS, ModelParameterOwnership } from './modelParameterOwnership'
import { join } from './path'

Config.MouseFollow = false

class Live2d {
  private app: Application | null = null
  private angryExpressionIndex = -1
  private guitarExpressionIndex = -1
  private readonly angryParameterOwner = Symbol('mikucat-angry-animation')
  private readonly guitarParameterOwner = Symbol('mikucat-guitar-animation')
  private readonly parameterOwnership = new ModelParameterOwnership(
    (id, value, weight) => this.setParameterValue(id, value, weight),
    id => this.getParameterValueRange(id),
  )

  private readonly guitarHands = new GuitarHandAnimation((id, value) => {
    this.parameterOwnership.write(this.guitarParameterOwner, id, value)
  })

  private readonly angryAnimation = new AngryAnimation((id, value) => {
    this.parameterOwnership.write(this.angryParameterOwner, id, value)
  })

  private readonly updateAngryAnimation = (ticker: Ticker) => {
    this.angryAnimation.update(ticker.deltaMS)
    if (!this.angryAnimation.isActive) {
      Ticker.shared.remove(this.updateAngryAnimation)
      this.parameterOwnership.release(this.angryParameterOwner)
      this.syncMouseInputOwnership()
    }
  }

  private readonly updateGuitarHands = (ticker: Ticker) => {
    this.guitarHands.update(ticker.deltaMS, undefined, this.mouseHeadPose())
    if (!this.guitarHands.isActive) {
      Ticker.shared.remove(this.updateGuitarHands)
      this.parameterOwnership.release(this.guitarParameterOwner)
      this.syncMouseInputOwnership()
    }
  }

  public model: Live2DSprite | null = null
  public readonly mouseInput = new ModelMouseInput((id, value) => this.setParameterValue(id, value))

  constructor() { }

  public get isAngryAnimating() {
    const { phase } = this.angryAnimation.snapshot

    return phase === 'entering' || phase === 'playing'
  }

  public get angryAnimationSnapshot() {
    return this.angryAnimation.snapshot
  }

  public setAngryAnimationIntent(intent: AngryAnimationIntent) {
    return this.angryAnimation.setIntent(intent)
  }

  public get isGuitarPerforming() {
    const { phase } = this.guitarHands.snapshot

    return phase === 'entering' || phase === 'playing'
  }

  public get guitarPerformanceSnapshot() {
    return this.guitarHands.snapshot
  }

  public setGuitarPerformanceIntent(intent: GuitarPerformanceIntent) {
    return this.guitarHands.setIntent(intent)
  }

  public setGuitarPerformanceTemplateOverride(templateId?: GuitarPerformanceTemplateId) {
    return this.guitarHands.setTemplateOverride(templateId)
  }

  public setGuitarMotifPreview(motifId?: GuitarMotifId) {
    return this.guitarHands.setMotifPreview(motifId)
  }

  private initApp() {
    if (this.app) return

    const view = document.getElementById('live2dCanvas') as HTMLCanvasElement

    this.app = new Application()

    return this.app.init({
      view,
      resizeTo: window,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: devicePixelRatio,
    })
  }

  public async load(path: string, presetKey?: ModelPresetKey) {
    await this.initApp()

    this.destroy()

    const files = await readDir(path)

    const modelFile = files.find(file => file.name.endsWith('.model3.json'))

    if (!modelFile) {
      throw new Error(i18n.global.t('utils.live2d.hints.notFound'))
    }

    const modelPath = join(path, modelFile.name)

    const modelJSON = JSON5.parse(await readTextFile(modelPath))

    if (presetKey === 'mikucat') {
      this.angryExpressionIndex = modelJSON.FileReferences?.Expressions?.findIndex(
        (expression: { File: string }) => expression.File === 'expressions/angry.exp3.json',
      ) ?? -1
      this.guitarExpressionIndex = modelJSON.FileReferences?.Expressions?.findIndex(
        (expression: { File: string }) => expression.File === 'expressions/guitar.exp3.json',
      ) ?? -1
    }

    const modelSetting = new CubismSetting({
      modelJSON,
    })

    modelSetting.redirectPath(({ file }) => {
      return convertFileSrc(join(path, file))
    })

    this.model = new Live2DSprite({
      modelSetting,
      ticker: Ticker.shared,
    })

    this.app?.stage.addChild(this.model)

    await this.model.ready

    const { width, height } = this.model

    const motions = groupBy(this.model.getMotions(), 'group')
    const expressions = this.model.getExpressions()

    return {
      width,
      height,
      motions,
      expressions,
    }
  }

  public destroy() {
    Ticker.shared.remove(this.updateAngryAnimation)
    Ticker.shared.remove(this.updateGuitarHands)
    this.angryAnimation.abort()
    this.guitarHands.abort()
    this.parameterOwnership.release(this.angryParameterOwner)
    this.parameterOwnership.release(this.guitarParameterOwner)
    this.mouseInput.reset()
    this.angryExpressionIndex = -1
    this.guitarExpressionIndex = -1

    if (!this.model) return

    this.model?.destroy()

    this.model = null
  }

  public resizeModel(modelSize: ModelSize) {
    if (!this.model) return

    const { width, height } = modelSize

    const scaleX = innerWidth / width
    const scaleY = innerHeight / height
    const scale = Math.min(scaleX, scaleY)

    this.model.scale.set(scale)
    this.model.x = innerWidth / 2
    this.model.y = innerHeight / 2
    this.model.anchor.set(0.5)
  }

  public startMotion(motion: MotionInfo) {
    return this.model?.startMotion({
      ...motion,
      priority: Priority.Normal,
    })
  }

  public setExpression(index: number) {
    if (!this.model?.getExpressions()[index]) return

    this.model.setExpression({ index })

    if (index === this.angryExpressionIndex) {
      if (this.guitarHands.isActive) {
        this.guitarHands.stop(undefined, this.mouseHeadPose())
        return
      }
      const initialHead = this.mouseHeadPose()
      if (!this.parameterOwnership.acquire(this.angryParameterOwner, MIKUCAT_ANGRY_OWNED_PARAMETERS)) return
      this.mouseInput.setEnabled(false)
      if (this.angryAnimation.start(initialHead)) Ticker.shared.add(this.updateAngryAnimation)
    } else if (index === this.guitarExpressionIndex) {
      if (this.angryAnimation.isActive) {
        this.angryAnimation.stop(this.mouseHeadPose())
        return
      }
      const initialHead = this.mouseHeadPose()
      if (!this.parameterOwnership.acquire(this.guitarParameterOwner, MIKUCAT_GUITAR_OWNED_PARAMETERS)) return
      this.mouseInput.setEnabled(false)
      if (this.guitarHands.start(undefined, initialHead)) Ticker.shared.add(this.updateGuitarHands)
    } else {
      if (this.angryAnimation.isActive) this.angryAnimation.stop(this.mouseHeadPose())
      if (this.guitarHands.isActive) this.guitarHands.stop(undefined, this.mouseHeadPose())
      this.syncMouseInputOwnership()
    }
  }

  private syncMouseInputOwnership() {
    this.mouseInput.setEnabled(!this.angryAnimation.isActive && !this.guitarHands.isActive)
  }

  private mouseHeadPose() {
    return {
      x: this.mouseInput.latest('ParamAngleX') ?? 0,
      y: this.mouseInput.latest('ParamAngleY') ?? 0,
    }
  }

  public getParameterValueRange(id: string) {
    return this.model?.getParameterValueRangeById(id)
  }

  public setParameterValue(id: string, value: number | boolean, weight = 1) {
    return this.model?.setParameterValueById(id, Number(value), weight)
  }

  public setMotionSoundEnabled(enabled: boolean) {
    Config.MotionSound = enabled
  }

  public setMaxFPS(fps: number) {
    Ticker.shared.maxFPS = fps
  }
}

const live2d = new Live2d()

export default live2d

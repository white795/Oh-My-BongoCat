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
import type { MikuCatEnteredMode, MikuCatPresentationMode } from './mikuCatPresentationConsumer'
import type { ModelPresetKey } from './modelPresets'

import { AngryAnimation } from './angryAnimation'
import { CompletionAnimation } from './completionAnimation'
import { GuitarHandAnimation } from './guitarHandAnimation'
import { ModelMouseInput } from './modelMouseInput'
import { MIKUCAT_ANGRY_OWNED_PARAMETERS, MIKUCAT_COMPLETION_OWNED_PARAMETERS, MIKUCAT_GUITAR_OWNED_PARAMETERS, ModelParameterOwnership } from './modelParameterOwnership'
import { join } from './path'

Config.MouseFollow = false

type MikuCatAnimationMode = 'angry' | 'completion' | 'guitar'

class Live2d {
  private app: Application | null = null
  private angryExpressionIndex = -1
  private completionExpressionIndex = -1
  private defaultExpressionIndex = -1
  private guitarExpressionIndex = -1
  private enteredAnimationModeValue: MikuCatEnteredMode = 'relaxed'
  private readonly animationModeListeners = new Set<(mode: MikuCatEnteredMode) => void>()
  private requestedAnimationMode?: MikuCatAnimationMode
  private readonly angryParameterOwner = Symbol('mikucat-angry-animation')
  private readonly completionParameterOwner = Symbol('mikucat-completion-animation')
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

  private readonly completionAnimation = new CompletionAnimation((id, value) => {
    this.parameterOwnership.write(this.completionParameterOwner, id, value)
  })

  private readonly updateAngryAnimation = (ticker: Ticker) => {
    this.angryAnimation.update(ticker.deltaMS)
    if (!this.angryAnimation.isActive) {
      Ticker.shared.remove(this.updateAngryAnimation)
      this.parameterOwnership.release(this.angryParameterOwner)
      this.reconcileAnimationMode()
    }
  }

  private readonly updateGuitarHands = (ticker: Ticker) => {
    this.guitarHands.update(ticker.deltaMS, undefined, this.mouseHeadPose())
    if (!this.guitarHands.isActive) {
      Ticker.shared.remove(this.updateGuitarHands)
      this.parameterOwnership.release(this.guitarParameterOwner)
      this.reconcileAnimationMode()
    }
  }

  private readonly updateCompletionAnimation = (ticker: Ticker) => {
    const previousPhase = this.completionAnimation.snapshot.phase

    this.completionAnimation.update(ticker.deltaMS, this.mouseHeadPose())
    if (
      previousPhase === 'playing'
      && this.completionAnimation.snapshot.phase !== 'playing'
      && this.requestedAnimationMode === 'completion'
    ) {
      this.requestedAnimationMode = undefined
      this.setBuiltInExpression(this.defaultExpressionIndex)
    }
    if (!this.completionAnimation.isActive) {
      Ticker.shared.remove(this.updateCompletionAnimation)
      this.parameterOwnership.release(this.completionParameterOwner)
      this.reconcileAnimationMode()
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

  public get isCompletionAnimating() {
    return this.completionAnimation.isActive
  }

  public get enteredAnimationMode(): MikuCatEnteredMode {
    return this.enteredAnimationModeValue
  }

  public onAnimationModeChange(listener: (mode: MikuCatEnteredMode) => void) {
    this.animationModeListeners.add(listener)
    return () => this.animationModeListeners.delete(listener)
  }

  public get completionAnimationSnapshot() {
    return this.completionAnimation.snapshot
  }

  public playCompletionAnimation() {
    if (
      this.defaultExpressionIndex < 0
      || this.completionExpressionIndex < 0
      || this.requestedAnimationMode === 'completion'
      || this.completionAnimation.isActive
    ) {
      return false
    }

    this.requestedAnimationMode = 'completion'
    this.reconcileAnimationMode()
    return true
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
      this.defaultExpressionIndex = modelJSON.FileReferences?.Expressions?.findIndex(
        (expression: { File: string }) => expression.File === 'expressions/default.exp3.json',
      ) ?? -1
      this.completionExpressionIndex = modelJSON.FileReferences?.Expressions?.findIndex(
        (expression: { File: string }) => expression.File === 'expressions/dot-eyes.exp3.json',
      ) ?? -1
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
    Ticker.shared.remove(this.updateCompletionAnimation)
    Ticker.shared.remove(this.updateGuitarHands)
    this.angryAnimation.abort()
    this.completionAnimation.abort()
    this.guitarHands.abort()
    this.parameterOwnership.release(this.angryParameterOwner)
    this.parameterOwnership.release(this.completionParameterOwner)
    this.parameterOwnership.release(this.guitarParameterOwner)
    this.mouseInput.reset()
    this.angryExpressionIndex = -1
    this.completionExpressionIndex = -1
    this.defaultExpressionIndex = -1
    this.guitarExpressionIndex = -1
    this.enteredAnimationModeValue = 'relaxed'
    this.requestedAnimationMode = undefined

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
    if (!this.model?.getExpressions()[index]) return false

    this.model.setExpression({ index })

    this.requestedAnimationMode = index === this.angryExpressionIndex
      ? 'angry'
      : index === this.guitarExpressionIndex
        ? 'guitar'
        : undefined
    this.reconcileAnimationMode()
    return true
  }

  public applyAgentPresentation(mode: MikuCatPresentationMode) {
    const index = mode === 'angry'
      ? this.angryExpressionIndex
      : mode === 'guitar'
        ? this.guitarExpressionIndex
        : this.defaultExpressionIndex

    if (index < 0) return false
    return this.setExpression(index)
  }

  public releaseAgentPresentation() {
    if (this.defaultExpressionIndex < 0) {
      this.requestedAnimationMode = undefined
      this.reconcileAnimationMode()
      return true
    }

    return this.setExpression(this.defaultExpressionIndex)
  }

  private reconcileAnimationMode() {
    if (this.requestedAnimationMode !== 'completion' && this.completionAnimation.isActive) {
      this.completionAnimation.stop(this.mouseHeadPose())
      return
    }

    if (this.requestedAnimationMode === 'completion') {
      if (this.guitarHands.isActive) {
        this.guitarHands.stop(undefined, this.mouseHeadPose())
        return
      }
      if (this.angryAnimation.isActive) {
        this.angryAnimation.stop(this.mouseHeadPose())
        return
      }

      this.startCompletionAnimation()
      return
    }

    if (this.requestedAnimationMode === 'angry') {
      if (this.guitarHands.isActive) {
        this.guitarHands.stop(undefined, this.mouseHeadPose())
        return
      }

      this.startAngryAnimation()
      return
    }

    if (this.requestedAnimationMode === 'guitar') {
      if (this.angryAnimation.isActive) {
        this.angryAnimation.stop(this.mouseHeadPose())
        return
      }

      this.startGuitarAnimation()
      return
    }

    if (this.angryAnimation.isActive) this.angryAnimation.stop(this.mouseHeadPose())
    if (this.guitarHands.isActive) this.guitarHands.stop(undefined, this.mouseHeadPose())
    this.syncMouseInputOwnership()
  }

  private startAngryAnimation() {
    const initialHead = this.mouseHeadPose()
    if (!this.parameterOwnership.acquire(this.angryParameterOwner, MIKUCAT_ANGRY_OWNED_PARAMETERS)) return

    this.mouseInput.setEnabled(false)
    if (this.angryAnimation.start(initialHead)) Ticker.shared.add(this.updateAngryAnimation)
    if (this.angryAnimation.isActive) this.setEnteredAnimationMode('angry')
  }

  private startGuitarAnimation() {
    const initialHead = this.mouseHeadPose()
    if (!this.parameterOwnership.acquire(this.guitarParameterOwner, MIKUCAT_GUITAR_OWNED_PARAMETERS)) return

    this.mouseInput.setEnabled(false)
    if (this.guitarHands.start(undefined, initialHead)) Ticker.shared.add(this.updateGuitarHands)
    if (this.guitarHands.isActive) this.setEnteredAnimationMode('guitar')
  }

  private startCompletionAnimation() {
    const initialHead = this.mouseHeadPose()
    if (!this.parameterOwnership.acquire(
      this.completionParameterOwner,
      MIKUCAT_COMPLETION_OWNED_PARAMETERS,
    )) {
      return
    }

    this.mouseInput.setEnabled(false)
    this.setBuiltInExpression(this.completionExpressionIndex)
    if (this.completionAnimation.start(initialHead)) {
      Ticker.shared.add(this.updateCompletionAnimation)
    }
    if (this.completionAnimation.isActive) this.setEnteredAnimationMode('completion')
  }

  private setBuiltInExpression(index: number) {
    if (index < 0 || !this.model?.getExpressions()[index]) return false

    this.model.setExpression({ index })
    return true
  }

  private syncMouseInputOwnership() {
    const animationsIdle = !this.angryAnimation.isActive
      && !this.completionAnimation.isActive
      && !this.guitarHands.isActive

    this.mouseInput.setEnabled(animationsIdle)
    if (animationsIdle && this.requestedAnimationMode === undefined) {
      this.setEnteredAnimationMode('relaxed')
    }
  }

  private setEnteredAnimationMode(mode: MikuCatEnteredMode) {
    if (mode === this.enteredAnimationModeValue) return

    this.enteredAnimationModeValue = mode
    for (const listener of this.animationModeListeners) listener(mode)
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

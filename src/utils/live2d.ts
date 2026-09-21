import type { MotionInfo } from 'easy-live2d'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Config, CubismSetting, Live2DSprite, Priority } from 'easy-live2d'
import { groupBy } from 'es-toolkit/compat'
import JSON5 from 'json5'
import { Application, Ticker } from 'pixi.js'

import type { ModelSize } from '@/composables/useModel'

import { i18n } from '@/locales'

import type { ModelPresetKey } from './modelPresets'

import { GuitarHandAnimation } from './guitarHandAnimation'
import { ModelMouseInput } from './modelMouseInput'
import { join } from './path'

Config.MouseFollow = false

class Live2d {
  private app: Application | null = null
  private guitarExpressionIndex = -1
  private readonly guitarHands = new GuitarHandAnimation((id, value) => this.setParameterValue(id, value))
  private readonly updateGuitarHands = (ticker: Ticker) => {
    this.guitarHands.update(ticker.deltaMS, this.mouseHandPose(), this.mouseHeadPose())
    if (!this.guitarHands.isActive) {
      Ticker.shared.remove(this.updateGuitarHands)
      this.mouseInput.setEnabled(true)
    }
  }

  public model: Live2DSprite | null = null
  public readonly mouseInput = new ModelMouseInput((id, value) => this.setParameterValue(id, value))

  constructor() { }

  public get isGuitarPerforming() {
    const { phase } = this.guitarHands.snapshot

    return phase === 'entering' || phase === 'playing'
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
    Ticker.shared.remove(this.updateGuitarHands)
    this.guitarHands.abort()
    this.mouseInput.reset()
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

    if (index === this.guitarExpressionIndex) {
      const initialPose = this.mouseHandPose()
      const initialHead = this.mouseHeadPose()
      this.mouseInput.setEnabled(false)
      if (this.guitarHands.start(initialPose, initialHead)) Ticker.shared.add(this.updateGuitarHands)
    } else if (this.guitarHands.isActive) {
      this.guitarHands.stop(this.mouseHandPose(), this.mouseHeadPose())
    } else {
      this.mouseInput.setEnabled(true)
    }
  }

  private mouseHandPose() {
    return {
      x: this.mouseInput.latest('ParamMouseX') ?? 0,
      y: this.mouseInput.latest('ParamMouseY') ?? 0,
    }
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

  public setParameterValue(id: string, value: number | boolean) {
    return this.model?.setParameterValueById(id, Number(value))
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

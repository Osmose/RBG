import BaseScene from 'gate/scenes/base';
import { asyncTween, steppedCubicEase, wait } from 'gate/util';

interface ScriptTint {
  color: number;
  start: number;
  length: number;
}

enum ScriptActionType {
  ShowText = 'showText',
  Delay = 'delay',
}

type ScriptAction =
  | {
      type: ScriptActionType.ShowText;
      tints: ScriptTint[];
      text: string;
    }
  | {
      type: ScriptActionType.Delay;
      duration: number;
    };

export interface DialogOptions {
  width?: number;
  height?: number;
  text?: string;
  characterDelay?: number;
  sound?: Phaser.Sound.BaseSound;
}

export default class Dialog {
  scene: BaseScene;
  box: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.BitmapText;
  characterDelay: number;
  sound?: Phaser.Sound.BaseSound;
  abortController?: AbortController;

  static padding = {
    top: 8,
    left: 4,
    right: 4,
    bottom: 2,
  };

  static preload(scene: BaseScene) {
    scene.load.bitmapFont('sodapop', 'ui/sodapop_0.png', 'ui/sodapop.fnt');
    scene.load.image('dialogSlice', 'ui/dialog_slice.png');
  }

  constructor(
    scene: BaseScene,
    x: number,
    y: number,
    { width = 10, height = 10, text, characterDelay = 75, sound }: DialogOptions = {}
  ) {
    this.scene = scene;
    this.characterDelay = characterDelay;
    this.sound = sound;

    this.box = scene.add.nineslice(
      x,
      y,
      'dialogSlice',
      0,
      width + Dialog.padding.left + Dialog.padding.right,
      height + Dialog.padding.top + Dialog.padding.bottom,
      1,
      1,
      1,
      2
    );
    const boxTopLeft = this.box.getTopLeft<Phaser.Math.Vector2>();
    this.text = scene.add.bitmapText(
      boxTopLeft.x + Dialog.padding.left,
      boxTopLeft.y + Dialog.padding.top,
      'sodapop',
      text
    );
    this.text.setTint(0xfffa9b).setMaxWidth(this.box.width - 8);
  }

  setText(text: string, autosize = false) {
    this.abortController?.abort();

    this.text.setText(text);
    if (autosize) {
      this.text.setMaxWidth(0);

      const bounds = this.text.getTextBounds();
      this.box.setSize(bounds.global.width + 8, bounds.global.height + 6);

      const boxTopLeft = this.box.getTopLeft<Phaser.Math.Vector2>();
      this.text.setPosition(boxTopLeft.x + Dialog.padding.left, boxTopLeft.y + Dialog.padding.top);
    }
    return this;
  }

  setDepth(depth: number) {
    this.box.setDepth(depth);
    this.text.setDepth(depth);
    return this;
  }

  setVisible(visible: boolean) {
    this.box.setVisible(visible);
    this.text.setVisible(visible);
    return this;
  }

  loadScript(script: string) {
    const scriptParts = script.split(/(<\/?[A-Za-z]+>)/);
    let tints: ScriptTint[] = [];
    let currentTint: ScriptTint | null = null;
    let text = '';
    const actions: ScriptAction[] = [];

    for (const scriptPart of scriptParts) {
      switch (scriptPart.toLowerCase()) {
        case '<red>':
          currentTint = { color: 0xac311e, start: text.length, length: -1 };
          tints.push(currentTint);
          break;
        case '</red>':
          if (!currentTint) {
            throw new Error('Encountered </red> before <red> in dialog script.');
          }

          currentTint.length = text.length - currentTint.start;
          currentTint = null;
          break;
        case '<delay>':
          actions.push({ type: ScriptActionType.ShowText, tints, text });
          actions.push({ type: ScriptActionType.Delay, duration: 3000 });
          tints = [];
          text = '';
          break;
        default:
          text += scriptPart;
          break;
      }
    }

    if (text !== '') {
      actions.push({ type: ScriptActionType.ShowText, tints, text });
    }

    return actions;
  }

  async animateScript(script: string | string[]) {
    this.abortController?.abort();
    this.abortController = new AbortController();

    let aborted = false;
    const abortHandler = () => {
      aborted = true;
      this.sound?.stop();
      this.abortController!.signal.removeEventListener('abort', abortHandler);
    };
    this.abortController.signal.addEventListener('abort', abortHandler);

    let joinedScript = '';
    if (Array.isArray(script)) {
      joinedScript = script.join('');
    } else {
      joinedScript = script;
    }

    const actions = this.loadScript(joinedScript);
    for (const action of actions) {
      if (aborted) {
        break;
      }

      switch (action.type) {
        case ScriptActionType.ShowText: {
          const { text, tints } = action;

          // setCharacterTint limits tinting to the current text length, so we set the
          // text temporarily to its final value. The tint data is preserved even
          // after we set the text to be empty again.
          this.text.setVisible(false).setText(text);
          this.text.setCharacterTint(0, -1);
          for (const { color, start, length } of tints) {
            this.text.setCharacterTint(start, length, true, color);
          }
          this.text.setText('').setVisible(true);

          this.sound?.play({ loop: true });
          for (let k = 0; k < text.length && !aborted; k++) {
            this.text.setText(text.slice(0, k));
            await wait(this.scene, this.characterDelay);
          }

          if (!aborted) {
            this.sound?.stop();
            this.text.setText(text);
          }
          break;
        }
        case ScriptActionType.Delay: {
          await wait(this.scene, action.duration);
          break;
        }
      }
    }
  }

  async animateAppear() {
    const initialWidth = this.box.width;
    const initialHeight = this.box.height;

    const textMask = this.scene.make.graphics().fillStyle(0xffffff);
    this.text.setMask(textMask.createGeometryMask()).setVisible(true);

    this.box.setSize(3, 4).setVisible(true);
    await asyncTween(this.scene, {
      targets: [this.box],
      width: initialWidth,
      ease: steppedCubicEase(400),
      duration: 400,
    });
    await asyncTween(this.scene, {
      targets: [this.box],
      height: initialHeight,
      ease: steppedCubicEase(600),
      duration: 600,
      onUpdate: () => {
        const topLeft = this.box.getTopLeft<Phaser.Math.Vector2>();
        textMask.fillRect(topLeft.x, topLeft.y, this.box.width, this.box.height);
      },
    });

    this.text.clearMask();
  }
}

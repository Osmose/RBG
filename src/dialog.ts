import BaseScene from 'gate/scenes/base';
import { wait } from 'gate/util';

interface ScriptTint {
  color: number;
  start: number;
  length: number;
}

export default class Dialog {
  scene: BaseScene;
  box: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;

  static preload(scene: BaseScene) {
    scene.load.bitmapFont('sodapop', 'ui/sodapop_0.png', 'ui/sodapop.fnt');
    scene.load.image('dialogBox', 'ui/dialog_box.png');
  }

  constructor(scene: BaseScene, x: number, y: number, text?: string) {
    this.scene = scene;
    this.box = scene.add.image(x, y, 'dialogBox');
    this.text = scene.add.bitmapText(x - this.box.width / 2 + 4, y - this.box.height / 2 + 6, 'sodapop', text);
    this.text.setTint(0xfffa9b).setMaxWidth(this.box.width - 8);
  }

  setText(text: string) {
    this.text.setText(text);
  }

  setDepth(depth: number) {
    this.box.setDepth(depth);
    this.text.setDepth(depth);
    return this;
  }

  loadScript(script: string) {
    const scriptParts = script.split(/(<\/?[A-Za-z]+>)/);
    const tints: ScriptTint[] = [];
    let currentTint: ScriptTint | null = null;
    let text = '';

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
        default:
          text += scriptPart;
          break;
      }
    }

    return { text, tints };
  }

  async animateScript(script: string, step: number, sound?: Phaser.Sound.BaseSound) {
    const { text, tints } = this.loadScript(script);

    // setCharacterTint limits tinting to the current text length, so we set the
    // text temporarily to its final value. The tint data is preserved even
    // after we set the text to be empty again.
    this.text.setVisible(false).setText(text);
    this.text.setCharacterTint(0, -1);
    for (const { color, start, length } of tints) {
      this.text.setCharacterTint(start, length, true, color);
    }
    this.text.setText('').setVisible(true);

    sound?.play({ loop: true });
    for (let k = 0; k < text.length; k++) {
      this.setText(text.slice(0, k));
      await wait(this.scene, step);
    }
    this.setText(text);
    sound?.stop();
  }
}

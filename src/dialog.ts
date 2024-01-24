import BaseScene from 'gate/scenes/base';
import { wait } from 'gate/util';

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

  async animateText(text: string, step: number, sound?: Phaser.Sound.BaseSound) {
    sound?.play({ loop: true });
    for (let k = 0; k < text.length; k++) {
      this.setText(text.slice(0, k));
      await wait(this.scene, step);
    }
    this.setText(text);
    sound?.stop();
  }
}

export default class BaseScene extends Phaser.Scene {
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  loadResources(_scene: BaseScene) {}

  create(_data?: object) {
    // Keyboard
    this.keys = this.input.keyboard!.createCursorKeys();
  }
}

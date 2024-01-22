export default class BaseScene extends Phaser.Scene {
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  create() {
    // Keyboard
    this.keys = this.input.keyboard!.createCursorKeys();
  }
}

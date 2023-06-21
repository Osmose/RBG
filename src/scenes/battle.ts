import { State, StateMachine, justDown, pixelDiff, randomChoice } from 'gate/util';
import Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  stateMachine!: StateMachine;

  // UI
  battleBorder!: Phaser.GameObjects.Image;
  battleGrid!: Phaser.GameObjects.TileSprite;
  battleSphereWindow!: Phaser.GameObjects.Image;
  spheres!: Phaser.GameObjects.Sprite[];

  constructor() {
    super({
      key: 'board',
    });
  }

  preload() {
    this.load.image('battleBorder', 'ui/battle_border.png');
    this.load.image('battleGrid', 'ui/battle_grid.png');
    this.load.image('battleSphereWindow', 'ui/battle_sphere_window.png');
    this.load.spritesheet('battleSpheres', 'ui/spheres.png', { frameWidth: 14, frameHeight: 14 });
  }

  create() {
    // Keyboard
    this.keys = this.input.keyboard!.createCursorKeys();

    this.battleGrid = this.add.tileSprite(196, 114, 326, 104, 'battleGrid');
    this.battleBorder = this.add.image(190, 120, 'battleBorder');
    this.battleSphereWindow = this.add.image(64 + 58, 48 + 65, 'battleSphereWindow');

    this.spheres = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 8; x++) {
        const sphere = this.add.sprite(
          x * 14 + 66 + 7,
          y * 14 + 50 + 7,
          'battleSpheres',
          randomChoice([0, 1, 2, 3, 4])
        );
        this.spheres.push(sphere);
      }
    }

    this.stateMachine = new StateMachine(
      'movePhase',
      {
        movePhase: new MovePhase(),
      },
      [this]
    );
  }

  update(time: number, delta: number) {
    this.battleGrid.x -= pixelDiff(10, delta);
    if (this.battleGrid.x <= 188) {
      this.battleGrid.x += 8;
    }

    this.stateMachine.step(time, delta);
  }
}

class MovePhase extends State {
  cursor!: Phaser.GameObjects.Sprite;
  cursorX!: number;
  cursorY!: number;

  init(scene: BattleScene) {
    this.cursor = scene.add.sprite(66 + 7, 50 + 7, 'battleSpheres', 5);
    this.cursorX = 0;
    this.cursorY = 0;
    this.cursor.setVisible(false);
  }

  setCursorPos(x: number, y: number) {
    this.cursorX = x;
    this.cursorY = y;
    this.cursor.setPosition(66 + 7 + x * 14, 50 + 7 + y * 14);
  }

  moveCursor(xDiff: number, yDiff: number) {
    this.setCursorPos(this.cursorX + xDiff, this.cursorY + yDiff);
  }

  handleEntered() {
    this.cursor.setVisible(true);
  }

  execute(scene: BattleScene) {
    if (justDown(scene.keys.right, 500) && this.cursorX < 7) {
      this.moveCursor(1, 0);
    }
    if (justDown(scene.keys.left, 500) && this.cursorX > 0) {
      this.moveCursor(-1, 0);
    }
    if (justDown(scene.keys.up, 500) && this.cursorY > 0) {
      this.moveCursor(0, -1);
    }
    if (justDown(scene.keys.down, 500) && this.cursorY < 8) {
      this.moveCursor(0, 1);
    }
  }
}

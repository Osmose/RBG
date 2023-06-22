import {
  DIRECTIONS,
  Direction,
  State,
  StateMachine,
  asyncAnimation,
  justDown,
  oppositeDir,
  pixelDiff,
  randomChoice,
} from 'gate/util';
import Phaser from 'phaser';

const GRID_WIDTH = 8;
const GRID_HEIGHT = 9;

export default class BattleScene extends Phaser.Scene {
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  stateMachine!: StateMachine;

  // UI
  battleBorder!: Phaser.GameObjects.Image;
  battleGrid!: Phaser.GameObjects.TileSprite;
  battleSphereWindow!: Phaser.GameObjects.Image;
  spheres!: Sphere[];

  constructor() {
    super({
      key: 'board',
    });
  }

  preload() {
    Sphere.preload(this);

    this.load.image('battleBorder', 'ui/battle_border.png');
    this.load.image('battleGrid', 'ui/battle_grid.png');
    this.load.image('battleSphereWindow', 'ui/battle_sphere_window.png');
  }

  create() {
    Sphere.create(this);

    // Keyboard
    this.keys = this.input.keyboard!.createCursorKeys();

    this.battleGrid = this.add.tileSprite(196, 114, 326, 104, 'battleGrid');
    this.battleBorder = this.add.image(190, 120, 'battleBorder');
    this.battleSphereWindow = this.add.image(64 + 58, 48 + 65, 'battleSphereWindow');

    this.spheres = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.spheres.push(new Sphere(this, x, y, randomChoice(SPHERE_TYPES)));
      }
    }

    this.stateMachine = new StateMachine(
      'movePhase',
      {
        movePhase: new MovePhaseState(),
        swapChoice: new SwapChoiceState(),
        swap: new SwapState(),
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

  getSphere(gridX: number, gridY: number) {
    return this.spheres[gridY * GRID_WIDTH + gridX];
  }
}

enum SphereType {
  Red = 0,
  Key,
  Cyan,
  Green,
  Yellow,
}

const SPHERE_TYPES = [SphereType.Red, SphereType.Key, SphereType.Cyan, SphereType.Green, SphereType.Yellow];
const SPHERE_DIRECTION_OFFSETS = {
  [Direction.Up]: 0,
  [Direction.Right]: 8,
  [Direction.Down]: 16,
  [Direction.Left]: 24,
};

class Sphere {
  scene: BattleScene;
  gridX: number;
  gridY: number;
  type: SphereType;
  sprite: Phaser.GameObjects.Sprite;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('battleSpheres', 'ui/spheres.png', { frameWidth: 14, frameHeight: 14 });
  }

  static create(scene: BattleScene) {
    for (const type of SPHERE_TYPES) {
      for (const direction of DIRECTIONS) {
        scene.anims.create({
          key: `sphereSwapFrom:${type}:${direction}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [type + 16 + SPHERE_DIRECTION_OFFSETS[oppositeDir(direction)], type],
          }),
        });
        scene.anims.create({
          key: `sphereSwapTo:${type}:${direction}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [type + 16 + SPHERE_DIRECTION_OFFSETS[direction], type + 8],
          }),
        });
      }
    }
  }

  constructor(scene: BattleScene, gridX: number, gridY: number, type: SphereType) {
    this.scene = scene;
    this.gridX = gridX;
    this.gridY = gridY;
    this.type = type;
    this.sprite = scene.add.sprite(gridX * 14 + 66 + 7, gridY * 14 + 50 + 7, 'battleSpheres', type);
  }

  select() {
    this.sprite.setFrame(this.type + 8);
  }

  deselect() {
    this.sprite.setFrame(this.type);
  }

  setType(type: SphereType) {
    this.type = type;
    this.sprite.setFrame(type);
  }
}

class MovePhaseState extends State {
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

  handleEntered(_scene: BattleScene, toX?: number, toY?: number) {
    this.cursor.setVisible(true);

    if (toX !== undefined && toY !== undefined) {
      this.setCursorPos(toX, toY);
    }
  }

  execute(scene: BattleScene) {
    if (justDown(scene.keys.space)) {
      return this.transition('swapChoice', this.cursorX, this.cursorY);
    }

    if (justDown(scene.keys.right, 500) && this.cursorX < GRID_WIDTH - 1) {
      this.moveCursor(1, 0);
    }
    if (justDown(scene.keys.left, 500) && this.cursorX > 0) {
      this.moveCursor(-1, 0);
    }
    if (justDown(scene.keys.up, 500) && this.cursorY > 0) {
      this.moveCursor(0, -1);
    }
    if (justDown(scene.keys.down, 500) && this.cursorY < GRID_HEIGHT - 1) {
      this.moveCursor(0, 1);
    }
  }

  handleExited() {
    this.cursor.setVisible(false);
  }
}

class SwapChoiceState extends State {
  fromX!: number;
  fromY!: number;
  fromSphere!: Sphere;

  handleEntered(scene: BattleScene, fromX: number, fromY: number) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.fromSphere = scene.getSphere(fromX, fromY);
    this.fromSphere.select();
  }

  swap(direction: Direction) {
    return this.transition('swap', this.fromX, this.fromY, direction);
  }

  execute(scene: BattleScene) {
    if (!scene.keys.space.isDown) {
      return this.transition('movePhase');
    }

    if (scene.keys.up.isDown && this.fromY > 0) {
      return this.swap(Direction.Up);
    }
    if (scene.keys.down.isDown && this.fromY < GRID_HEIGHT - 1) {
      return this.swap(Direction.Down);
    }
    if (scene.keys.left.isDown && this.fromX > 0) {
      return this.swap(Direction.Left);
    }
    if (scene.keys.right.isDown && this.fromX < GRID_WIDTH - 1) {
      return this.swap(Direction.Right);
    }
  }

  handleExited() {
    this.fromSphere.deselect();
  }
}

class SwapState extends State {
  async handleEntered(scene: BattleScene, fromX: number, fromY: number, direction: Direction) {
    let toX = fromX;
    let toY = fromY;
    switch (direction) {
      case Direction.Up:
        toY--;
        break;
      case Direction.Down:
        toY++;
        break;
      case Direction.Left:
        toX--;
        break;
      case Direction.Right:
        toX++;
        break;
    }

    const fromSphere = scene.getSphere(fromX, fromY);
    const toSphere = scene.getSphere(toX, toY);
    const fromType = fromSphere.type;
    const toType = toSphere.type;
    await Promise.all([
      asyncAnimation(fromSphere.sprite, `sphereSwapFrom:${toType}:${direction}`),
      asyncAnimation(toSphere.sprite, `sphereSwapTo:${fromType}:${direction}`),
    ]);

    fromSphere.setType(toType);
    toSphere.setType(fromType);

    this.transition('movePhase', toX, toY);
  }
}

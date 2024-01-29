import {
  DIRECTIONS,
  Direction,
  State,
  StateMachine,
  asyncAnimation,
  asyncTween,
  gridMove,
  justDown,
  oppositeDir,
  pixelDiff,
  randomChoice,
  wait,
  setFaded,
  animateFaded,
  shake,
  ShakeAxis,
  forEachTween,
  relativePositionTween,
} from 'gate/util';
import Phaser from 'phaser';
import BaseScene from 'gate/scenes/base';
import Menu, { horizontalMenuItems } from 'gate/menu';
import Dialog from 'gate/dialog';
import { Entries } from 'type-fest';

const GRID_WIDTH = 8;
const GRID_HEIGHT = 9;

const SPHERE_WINDOW_LEFT = 48;
const SPHERE_WINDOW_TOP = 40;
const SPHERE_STOCK_LEFT = 54;
const SPHERE_STOCK_TOP = 172;
const HEALTH_LEFT = 186;
const HEALTH_TOP = 37;

const PARTY_LEFT = 184;
const PARTY_TOP = 62;
const ENEMY_LEFT = 259;
const ENEMY_TOP = 85;

const DIALOG_LEFT = 178;
const DIALOG_TOP = 172;

const ALPHA_FADED = 0.6;
const ALPHA_UNFADED = 0;

const DEPTH_BACKGROUND = -10;
const DEPTH_ENTITIES = 0;
const DEPTH_UI = 10;

const TINT_CREAM = 0xfffa9b;
const TINT_YELLOW = 0xfff55e;
const TINT_RED = 0xac311e;

enum Characters {
  Rojo = 'rojo',
  Blue = 'blue',
  Midori = 'midori',
}

const CHARACTER_COLORS = {
  [Characters.Rojo]: 0xac311e,
  [Characters.Blue]: 0x63a09b,
  [Characters.Midori]: 0x5ad932,
};

enum SphereType {
  Red = 0,
  Cyan,
  Green,
  Yellow,
  Key,
}

const CHARACTER_SPHERE_TYPES = {
  [Characters.Rojo]: SphereType.Red,
  [Characters.Blue]: SphereType.Cyan,
  [Characters.Midori]: SphereType.Green,
};

export default class BattleScene extends BaseScene {
  stateMachine!: StateMachine;

  // UI
  battleBorder!: Phaser.GameObjects.Image;
  battleGrid!: Phaser.GameObjects.TileSprite;
  battleSphereWindow!: Phaser.GameObjects.Image;
  battleSphereStock!: Phaser.GameObjects.Image;
  battleSphereWindowOverlay!: Phaser.GameObjects.Rectangle;
  actionSprites!: { [character in Characters]: { [action in BattleActions]: Phaser.GameObjects.Sprite } };
  allActionSprites!: Phaser.GameObjects.Sprite;
  dialog!: Dialog;

  // Enemies
  enemySkelly!: Skelly;
  healthEnemy!: HealthBar;

  // Party
  party!: { [key in Characters]: PartyMember };
  partyHealth!: { [key in Characters]: HealthBar };

  // Spheres
  stockCounts!: StockCount[];
  spheres!: Sphere[];

  // Sound
  soundSwap!: Phaser.Sound.BaseSound;
  soundClear!: Phaser.Sound.BaseSound;
  soundActionAppear!: Phaser.Sound.BaseSound;
  soundSelect!: Phaser.Sound.BaseSound;
  soundMoveCursor!: Phaser.Sound.BaseSound;
  soundText!: Phaser.Sound.BaseSound;
  soundPartyAttack!: { [key in Characters]: Phaser.Sound.BaseSound };
  soundEnemyAttack!: Phaser.Sound.BaseSound;

  // Battle logic
  battleState!: BattleState;
  currentTurnInputs!: TurnInputs;
  currentTurnResult!: TurnResult;

  /** Order in which character stuff generally happens */
  characterOrder = [Characters.Rojo, Characters.Blue, Characters.Midori];

  constructor() {
    super({
      key: 'board',
    });
  }

  preload() {
    Sphere.preload(this);
    StockCount.preload(this);
    Skelly.preload(this);
    PartyMember.preload(this);
    HealthBar.preload(this);
    ActionChoiceState.preload(this);
    Dialog.preload(this);

    this.load.image('battleBorder', 'ui/battle_border.png');
    this.load.image('battleGrid', 'ui/battle_grid.png');
    this.load.image('battleSphereWindow', 'ui/battle_sphere_window.png');
    this.load.image('battleSphereStock', 'ui/color_stock.png');

    this.load.bitmapFont('numbers', 'ui/numbers.png', 'ui/numbers.fnt');

    this.load.audio('swap', 'audio/swap.mp3');
    this.load.audio('clear', 'audio/clear.mp3');
    this.load.audio('actionAppear', 'audio/action_appear.mp3');
    this.load.audio('select', 'audio/select.mp3');
    this.load.audio('moveCursor', 'audio/move_cursor.mp3');
    this.load.audio('soundText', 'audio/text.mp3');
    this.load.audio('soundRojoAttack', 'audio/rojo_attack.mp3');
    this.load.audio('soundBlueAttack', 'audio/blue_attack.mp3');
    this.load.audio('soundMidoriAttack', 'audio/midori_attack.mp3');
    this.load.audio('soundEnemyAttack', 'audio/enemy_attack.mp3');
  }

  create() {
    super.create();

    Sphere.create(this);
    Skelly.create(this);
    PartyMember.create(this);
    ActionChoiceState.create(this);

    this.battleGrid = this.add.tileSprite(196, 114, 326, 104, 'battleGrid').setDepth(DEPTH_BACKGROUND);
    this.battleBorder = this.add.image(190, 120, 'battleBorder').setDepth(DEPTH_UI);
    this.battleSphereWindow = this.add
      .image(SPHERE_WINDOW_LEFT + 58, SPHERE_WINDOW_TOP + 65, 'battleSphereWindow')
      .setDepth(DEPTH_UI);
    this.battleSphereStock = this.add
      .image(SPHERE_STOCK_LEFT + 46, SPHERE_STOCK_TOP + 16, 'battleSphereStock')
      .setDepth(DEPTH_UI);
    this.battleSphereWindowOverlay = this.add
      .rectangle(
        this.battleSphereWindow.x,
        this.battleSphereWindow.y,
        this.battleSphereWindow.width,
        this.battleSphereWindow.height,
        0x000000
      )
      .setDepth(DEPTH_UI + 1)
      .setAlpha(ALPHA_FADED);

    this.soundSwap = this.sound.add('swap');
    this.soundClear = this.sound.add('clear');
    this.soundActionAppear = this.sound.add('actionAppear');
    this.soundSelect = this.sound.add('select');
    this.soundMoveCursor = this.sound.add('moveCursor');
    this.soundText = this.sound.add('soundText');
    this.soundPartyAttack = {
      [Characters.Rojo]: this.sound.add('soundRojoAttack'),
      [Characters.Blue]: this.sound.add('soundBlueAttack'),
      [Characters.Midori]: this.sound.add('soundMidoriAttack'),
    };
    this.soundEnemyAttack = this.sound.add('soundEnemyAttack');

    this.spheres = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.spheres.push(new Sphere(this, x, y, randomChoice(SPHERE_TYPES)));
      }
    }

    this.stockCounts = [];
    for (const type of SPHERE_TYPES) {
      this.stockCounts.push(new StockCount(this, type));
    }

    this.enemySkelly = new Skelly(this, ENEMY_LEFT + 32, ENEMY_TOP + 32);

    this.party = {
      [Characters.Rojo]: new PartyMember(this, Characters.Rojo, PARTY_LEFT + 32, PARTY_TOP + 16),
      [Characters.Blue]: new PartyMember(this, Characters.Blue, PARTY_LEFT + 16, PARTY_TOP + 48),
      [Characters.Midori]: new PartyMember(this, Characters.Midori, PARTY_LEFT + 32, PARTY_TOP + 78),
    };

    this.battleState = new BattleState(
      {
        [Characters.Rojo]: { hp: 101, maxHp: 101, atk: 70 },
        [Characters.Blue]: { hp: 93, maxHp: 93, atk: 25 },
        [Characters.Midori]: { hp: 123, maxHp: 123, atk: 35 },
      },
      { hp: 300, maxHp: 300 }
    );

    const pStatus = this.battleState.partyMemberStatuses;
    this.partyHealth = {
      [Characters.Rojo]: new HealthBar(
        this,
        HealthBarType.Rojo,
        HEALTH_LEFT + 23,
        HEALTH_TOP + 3,
        pStatus[Characters.Rojo].hp,
        pStatus[Characters.Rojo].maxHp
      ),
      [Characters.Blue]: new HealthBar(
        this,
        HealthBarType.Blue,
        HEALTH_LEFT + 20,
        HEALTH_TOP + 14,
        pStatus[Characters.Blue].hp,
        pStatus[Characters.Blue].maxHp
      ),
      [Characters.Midori]: new HealthBar(
        this,
        HealthBarType.Midori,
        HEALTH_LEFT + 17,
        HEALTH_TOP + 25,
        pStatus[Characters.Midori].hp,
        pStatus[Characters.Midori].maxHp
      ),
    };
    this.healthEnemy = new HealthBar(
      this,
      HealthBarType.Enemy,
      HEALTH_LEFT + 124,
      HEALTH_TOP + 14,
      this.battleState.enemyStatus.hp,
      this.battleState.enemyStatus.maxHp
    );

    this.dialog = new Dialog(this, DIALOG_LEFT + 82, DIALOG_TOP + 16).setDepth(DEPTH_UI);

    this.stateMachine = new StateMachine(
      'startActionChoice',
      {
        startActionChoice: new StartActionChoiceState(),
        actionChoice: new ActionChoiceState(),
        movePhase: new MovePhaseState(),
        swapChoice: new SwapChoiceState(),
        swap: new SwapState(),
        solve: new SolveState(),
        turnResult: new TurnResultPhaseState(),
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
    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) {
      return null;
    }

    return this.spheres[gridY * GRID_WIDTH + gridX];
  }
}

interface EnemyStatus {
  hp: number;
  maxHp: number;
}

interface PartyMemberStatus {
  hp: number;
  maxHp: number;
  atk: number;
}

type TurnInputs = { [key in Characters]: BattleActions };

interface PartyActionResultAttack {
  character: Characters;
  battleAction: BattleActions.Attack;
  damage: number;
}

interface PartyActionResultDefend {
  character: Characters;
  battleAction: BattleActions.Defend;
}

type PartyActionResult = PartyActionResultAttack | PartyActionResultDefend;

interface EnemyActionResult {
  target: Characters;
  damage: number;
}

interface TurnResult {
  partyActionResults: { [key in Characters]: PartyActionResult | null };
  enemyActionResult: EnemyActionResult | null;
  stockCounts: { [key in SphereType]: number };
}

class BattleState {
  partyMemberStatuses: { [key in Characters]: PartyMemberStatus };
  enemyStatus: EnemyStatus;
  stockCounts: { [key in SphereType]: number };

  constructor(partyMemberStatuses: { [key in Characters]: PartyMemberStatus }, enemyStatus: EnemyStatus) {
    this.partyMemberStatuses = partyMemberStatuses;
    this.enemyStatus = enemyStatus;
    this.stockCounts = {
      [SphereType.Red]: 0,
      [SphereType.Cyan]: 0,
      [SphereType.Green]: 0,
      [SphereType.Yellow]: 0,
      [SphereType.Key]: 0,
    };
  }

  setStockCount(type: SphereType, value: number) {
    this.stockCounts[type] = value;
  }

  modStockCount(type: SphereType, value: number) {
    this.stockCounts[type] += value;
  }

  executeTurn(turnInputs: TurnInputs): TurnResult {
    const partyActionResults: Partial<TurnResult['partyActionResults']> = {};

    // Character actions
    let clearKey = false;
    for (const [character, battleAction] of Object.entries(turnInputs) as Entries<typeof turnInputs>) {
      const sphereType = CHARACTER_SPHERE_TYPES[character];
      if (battleAction === BattleActions.Attack) {
        const damage =
          this.partyMemberStatuses[character].atk + this.stockCounts[sphereType] + this.stockCounts[SphereType.Key];
        this.enemyStatus.hp = Math.max(this.enemyStatus.hp - damage, 0);
        this.stockCounts[sphereType] = 0;
        clearKey = true;

        partyActionResults[character] = { character, battleAction, damage };
      } else {
        partyActionResults[character] = { character, battleAction };
      }
    }

    if (clearKey) {
      this.stockCounts[SphereType.Key] = 0;
    }

    let enemyActionResult = null;
    if (this.enemyStatus.hp > 0) {
      const target = randomChoice(
        Object.values(Characters).filter((character) => this.partyMemberStatuses[character].hp > 0)
      );

      let damage = Math.floor(Math.random() * 15) + 20;
      if (turnInputs[target] === BattleActions.Defend) {
        const sphereType = CHARACTER_SPHERE_TYPES[target];
        damage -= this.stockCounts[sphereType] + this.stockCounts[SphereType.Yellow];
        this.stockCounts[sphereType] = 0;
        this.stockCounts[SphereType.Yellow] = 0;
      }

      this.partyMemberStatuses[target].hp = Math.max(this.partyMemberStatuses[target].hp - damage, 0);

      enemyActionResult = {
        target,
        damage,
      };
    }

    return {
      partyActionResults: partyActionResults as TurnResult['partyActionResults'],
      enemyActionResult,
      stockCounts: this.stockCounts,
    };
  }
}

class Skelly {
  scene: BattleScene;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('enemySkelly', 'enemies/skelly.png', { frameWidth: 80, frameHeight: 64 });
    scene.load.image('enemySkellyGround', 'enemies/skelly_ground.png');
    scene.load.spritesheet('enemySkellyAttackEffect', 'effects/enemy_attack.png', { frameWidth: 96, frameHeight: 80 });
  }

  static create(scene: BattleScene) {
    scene.anims.create({
      key: 'enemySkellyIdle',
      frameRate: 5,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 0, end: 3 }),
      repeat: -1,
    });
    scene.anims.create({
      key: 'enemySkellyHurt',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 4, end: 5 }),
      repeat: 0,
    });
    scene.anims.create({
      key: 'enemySkellyAttack',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkelly', { start: 6, end: 18 }),
      repeat: 0,
    });
    scene.anims.create({
      key: 'enemySkellyAttackEffect',
      frameRate: 10,
      frames: scene.anims.generateFrameNumbers('enemySkellyAttackEffect', {
        frames: [7, 7, 7, 0, 1, 2, 1, 3, 4, 5, 5, 6],
      }),
      repeat: 0,
    });
  }

  constructor(scene: BattleScene, x: number, y: number) {
    this.scene = scene;
    this.ground = scene.add.image(x + 2, y + 23, 'enemySkellyGround').setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(x, y, 'enemySkellyIdle', 0).setDepth(DEPTH_ENTITIES);
    this.sprite.play('enemySkellyIdle');
  }

  setFaded(faded: boolean) {
    setFaded(this.sprite, faded);
    setFaded(this.ground, faded);
  }

  async animateFaded(faded: boolean) {
    return Promise.all([
      animateFaded(this.scene, this.sprite, faded, 400),
      animateFaded(this.scene, this.ground, faded, 400),
    ]);
  }

  async animateHurt() {
    await asyncAnimation(this.sprite, 'enemySkellyHurt');
    this.sprite.play('enemySkellyIdle');
  }

  async animateAttack(onHit?: () => void) {
    const handleAnimationUpdate = (
      _animation: Phaser.Animations.Animation,
      frame: Phaser.Animations.AnimationFrame
    ) => {
      if (frame.index === 8) {
        this.sprite.off('animationupdate', handleAnimationUpdate);
        onHit?.();

        // Ground shake
        shake(this.scene, [this.ground], ShakeAxis.Y, [1, -1, 0], 50);
      }
    };
    this.sprite.on('animationupdate', handleAnimationUpdate);

    await asyncAnimation(this.sprite, 'enemySkellyAttack');
    this.sprite.play('enemySkellyIdle');
  }

  async animateAttackEffect(x: number, y: number) {
    const effectSprite = this.scene.add.sprite(x, y, 'enemySkellyAttackEffect', 7);
    return asyncAnimation(effectSprite, `enemySkellyAttackEffect`).then(() => effectSprite.destroy());
  }
}

class PartyMember {
  scene: BattleScene;
  character: Characters;
  sprite: Phaser.GameObjects.Sprite;
  ground: Phaser.GameObjects.Image;

  static attackDamageFrame = {
    [Characters.Rojo]: 7,
    [Characters.Blue]: 7,
    [Characters.Midori]: 9,
  };

  static preload(scene: BattleScene) {
    for (const character of Object.values(Characters)) {
      scene.load.spritesheet(`party[${character}]`, `party/${character}.png`, {
        frameWidth: 64,
        frameHeight: 48,
      });
      scene.load.image(`party[${character}]Ground`, `party/${character}_ground.png`);
    }
    scene.load.spritesheet('partyAttackEffects', 'effects/party_attacks.png', { frameWidth: 96, frameHeight: 96 });
  }

  static create(scene: BattleScene) {
    for (const character of Object.values(Characters)) {
      scene.anims.create({
        key: `party[${character}]Idle`,
        frameRate: 5,
        frames: scene.anims.generateFrameNumbers(`party[${character}]`, { start: 0, end: 3 }),
        repeat: -1,
      });
    }

    // Character-specific animations
    const partyAnims: [Characters, string, number[]][] = [
      [Characters.Rojo, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 12, 13, 14, 15]],
      [Characters.Rojo, 'Hurt', [16, 17, 17, 17, 18, 18, 19, 20]],
      [Characters.Rojo, 'Death', [21, 22]],
      [Characters.Blue, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
      [Characters.Blue, 'Hurt', [16, 17, 17, 17, 18, 18, 19, 20]],
      [Characters.Blue, 'Death', [21, 22]],
      [Characters.Midori, 'Attack', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17, 17]],
      [Characters.Midori, 'Hurt', [18, 19, 19, 19, 20, 20, 21, 22]],
      [Characters.Midori, 'Death', [23, 24]],
    ];
    for (const [character, key, frames] of partyAnims) {
      scene.anims.create({
        key: `party[${character}]${key}`,
        frameRate: 10,
        repeat: 0,
        frames: scene.anims.generateFrameNumbers(`party[${character}]`, {
          frames,
        }),
      });
    }

    scene.anims.create({
      key: `party[${Characters.Rojo}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 0, 0, 1, 2, 3, 4, 5],
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Blue}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 0, 6, 7, 8, 9, 10, 11, 12, 13],
      }),
    });
    scene.anims.create({
      key: `party[${Characters.Midori}]AttackEffect`,
      frameRate: 10,
      repeat: 0,
      frames: scene.anims.generateFrameNumbers('partyAttackEffects', {
        frames: [0, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      }),
    });
  }

  constructor(scene: BattleScene, character: Characters, x: number, y: number) {
    this.scene = scene;
    this.character = character;
    this.ground = scene.add.image(x - 1, y + 23, `party[${character}]Ground`).setDepth(DEPTH_ENTITIES);
    this.sprite = scene.add.sprite(x, y, `party[${character}]`, 0).setDepth(DEPTH_ENTITIES);
    this.sprite.play(`party[${character}]Idle`);
  }

  setFaded(faded: boolean) {
    setFaded(this.sprite, faded);
    setFaded(this.ground, faded);
  }

  async animateFaded(faded: boolean) {
    return Promise.all([
      animateFaded(this.scene, this.sprite, faded, 400),
      animateFaded(this.scene, this.ground, faded, 400),
    ]);
  }

  async animateAttack(showDamageCallback: () => void) {
    // Trigger damage numbers on a specific animation frame
    const handleAnimationUpdate = (
      _animation: Phaser.Animations.Animation,
      frame: Phaser.Animations.AnimationFrame
    ) => {
      if (frame.index === PartyMember.attackDamageFrame[this.character]) {
        showDamageCallback();
      }
    };
    this.sprite.on('animationupdate', handleAnimationUpdate);

    // Effect frames are timed to match attack so we can play it without awaiting
    const effectSprite = this.scene.add.sprite(
      this.scene.enemySkelly.sprite.x,
      this.scene.enemySkelly.sprite.y,
      'partyAttackEffects',
      0
    );
    asyncAnimation(effectSprite, `party[${this.character}]AttackEffect`).then(() => effectSprite.destroy());

    await asyncAnimation(this.sprite, `party[${this.character}]Attack`);
    this.sprite.off('animationupdate', handleAnimationUpdate);
    this.sprite.play(`party[${this.character}]Idle`);
  }

  async animateHurt(death: boolean) {
    await asyncAnimation(this.sprite, `party[${this.character}]Hurt`);
    if (death) {
      await asyncAnimation(this.sprite, `party[${this.character}]Death`);
    } else {
      this.sprite.play(`party[${this.character}]Idle`);
    }
  }
}

enum HealthBarType {
  Rojo = 0,
  Blue = 1,
  Midori = 2,
  Enemy = 3,
}

class HealthBar {
  scene: Phaser.Scene;
  type: HealthBarType;
  fullBarWidth: number;
  halfBarWidth: number;
  halfBarHeight: number;

  barFrame: Phaser.GameObjects.Image;
  bar1: Phaser.GameObjects.Rectangle;
  bar2: Phaser.GameObjects.Rectangle;
  currentHealthText?: Phaser.GameObjects.BitmapText;
  maxHealthText?: Phaser.GameObjects.BitmapText;
  portrait: Phaser.GameObjects.Sprite;

  maxHealth = 0;
  currentHealth = 0;

  static barColors = {
    [HealthBarType.Rojo]: CHARACTER_COLORS[Characters.Rojo],
    [HealthBarType.Blue]: CHARACTER_COLORS[Characters.Blue],
    [HealthBarType.Midori]: CHARACTER_COLORS[Characters.Midori],
    [HealthBarType.Enemy]: TINT_YELLOW,
  };

  static preload(scene: BattleScene) {
    scene.load.spritesheet('partyHealthBarFrames', 'ui/party_health_bar_frames.png', {
      frameWidth: 34,
      frameHeight: 6,
    });
    scene.load.spritesheet('portraits', 'ui/portraits.png', { frameWidth: 16, frameHeight: 16 });
    scene.load.image('enemyHealthBarFrame', 'ui/enemy_health_bar_frame.png');
  }

  constructor(
    scene: BattleScene,
    type: HealthBarType,
    barX: number,
    barY: number,
    currentHealth: number,
    maxHealth: number
  ) {
    this.scene = scene;
    this.type = type;

    if (type === HealthBarType.Enemy) {
      this.barFrame = scene.add.image(barX, barY, 'enemyHealthBarFrame').setDepth(DEPTH_UI);
    } else {
      this.barFrame = scene.add.image(barX, barY, 'partyHealthBarFrames', type).setDepth(DEPTH_UI);
    }

    this.fullBarWidth = this.barFrame.width - (type === HealthBarType.Enemy ? 5 : 6);
    this.halfBarWidth = Math.floor(this.fullBarWidth / 2);
    this.halfBarHeight = (this.barFrame.height - 4) / 2;

    this.bar1 = scene.add
      .rectangle(
        barX - this.halfBarWidth,
        barY - this.halfBarHeight / 2,
        this.fullBarWidth,
        this.halfBarHeight,
        HealthBar.barColors[type]
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    this.bar2 = scene.add
      .rectangle(
        barX - this.halfBarWidth - 1,
        barY + this.halfBarHeight / 2,
        this.fullBarWidth,
        this.halfBarHeight,
        HealthBar.barColors[type]
      )
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);

    if (type !== HealthBarType.Enemy) {
      this.currentHealthText = scene.add
        .bitmapText(barX + 33, barY - 2, 'numbers', '')
        .setOrigin(1, 0)
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_UI);
      this.maxHealthText = scene.add
        .bitmapText(barX + 33, barY - 2, 'numbers', '')
        .setTint(TINT_CREAM)
        .setDepth(DEPTH_UI);
    }

    this.portrait = scene.add
      .sprite(barX - this.barFrame.width / 2 - 8, barY + this.barFrame.height / 2 - 8, 'portraits', type)
      .setDepth(DEPTH_UI);

    this.setHealth(currentHealth, maxHealth);
  }

  setHealth(currentHealth: number, maxHealth?: number) {
    this.currentHealth = currentHealth;
    this.maxHealth = maxHealth ?? this.maxHealth;

    const percent = this.currentHealth / this.maxHealth;
    this.bar1.width = Math.ceil(percent * this.fullBarWidth);
    this.bar2.width = Math.ceil(percent * this.fullBarWidth);
    this.currentHealthText?.setText(this.currentHealth.toString().padStart(3, ' '));
    this.maxHealthText?.setText(`/${this.maxHealth}`);
  }

  async animateDamage(damage: number, color: number = TINT_YELLOW, shouldShake = true) {
    const startWidth = this.bar1.width;
    this.setHealth(this.currentHealth - damage);
    const damageWidth = startWidth - this.bar1.width;

    const damageBar1 = this.scene.add
      .rectangle(this.bar1.x + this.bar1.width, this.bar1.y, damageWidth, this.bar1.height, color)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    const damageBar2 = this.scene.add
      .rectangle(this.bar2.x + this.bar2.width, this.bar2.y, damageWidth, this.bar2.height, color)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);

    // Hurt face
    this.portrait.setFrame(this.type + 4);

    const animations = [
      asyncTween(this.scene, {
        targets: [damageBar1, damageBar2],
        width: 0,
        delay: 400,
        duration: 400,
        completeDelay: 100,
        ease: 'Cubic.out',
      }),
    ];

    // Shake bars and portrait
    if (shouldShake) {
      animations.push(
        shake(
          this.scene,
          [this.barFrame, this.bar1, this.bar2, damageBar1, damageBar2],
          ShakeAxis.X,
          [-2, 1, -1, 0],
          50
        ),
        shake(this.scene, [this.portrait], ShakeAxis.X, [-1, 1, 0], 50)
      );

      // Shake and tint current health if available too
      if (this.currentHealthText) {
        const originalX = this.currentHealthText.x;
        animations.push(
          forEachTween(
            this.scene,
            [
              [TINT_RED, 3],
              [TINT_YELLOW, -2],
              [null, 0],
            ],
            50,
            ([tint, xMod]) => {
              this.currentHealthText?.setTint(tint ?? TINT_CREAM);
              this.currentHealthText?.setX(originalX + (xMod ?? 0));
            }
          )
        );
      }
    }
    await Promise.all(animations);

    // Un-hurt face
    this.portrait.setFrame(this.type);

    damageBar1.destroy();
    damageBar2.destroy();
  }
}

const SPHERE_TYPES = [SphereType.Red, SphereType.Cyan, SphereType.Green, SphereType.Yellow, SphereType.Key];
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
  index: number;
  type: SphereType | null;
  sprite: Phaser.GameObjects.Sprite;

  static EMPTY_FRAME = 29;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('battleSpheres', 'ui/spheres.png', { frameWidth: 14, frameHeight: 14 });
  }

  static create(scene: BattleScene) {
    for (const type of SPHERE_TYPES) {
      // Swaps
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

      // Clear
      scene.anims.create({
        key: `sphereClear:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [type + 48, 52, 13, 21, Sphere.EMPTY_FRAME],
        }),
      });

      // Refill
      for (const refillFromType of SPHERE_TYPES) {
        scene.anims.create({
          key: `sphereRefillTop:${refillFromType}:${type}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [refillFromType + 56, 37, type + 8, type],
          }),
        });
        scene.anims.create({
          key: `sphereRefillMiddle:${refillFromType}:${type}`,
          frameRate: 10,
          frames: scene.anims.generateFrameNumbers('battleSpheres', {
            frames: [refillFromType + 56, 45, type + 8, type],
          }),
        });
      }

      // Refill empty
      scene.anims.create({
        key: `sphereRefillTop:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [Sphere.EMPTY_FRAME, 37, type + 8, type],
        }),
      });
      scene.anims.create({
        key: `sphereRefillMiddle:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', { frames: [Sphere.EMPTY_FRAME, 45, type + 8, type] }),
      });
      scene.anims.create({
        key: `sphereRefillBottom:${null}:${type}`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleSpheres', {
          frames: [Sphere.EMPTY_FRAME, type + 64, type + 8, type],
        }),
      });
    }
  }

  constructor(scene: BattleScene, gridX: number, gridY: number, type: SphereType) {
    this.scene = scene;
    this.gridX = gridX;
    this.gridY = gridY;
    this.index = gridX + gridY * GRID_WIDTH;
    this.type = type;
    this.sprite = scene.add
      .sprite(gridX * 14 + SPHERE_WINDOW_LEFT + 9, gridY * 14 + SPHERE_WINDOW_TOP + 9, 'battleSpheres', type)
      .setDepth(DEPTH_UI);
  }

  select() {
    if (this.type !== null) {
      this.sprite.setFrame(this.type + 8);
    }
  }

  deselect() {
    if (this.type !== null) {
      this.sprite.setFrame(this.type);
    }
  }
}

class StockCount {
  scene: BattleScene;
  bar: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.BitmapText;
  count!: number;

  static preload(scene: BattleScene) {
    scene.load.spritesheet('sphereStockBar', 'ui/stock_bar.png', { frameWidth: 80, frameHeight: 4 });
  }

  constructor(scene: BattleScene, type: SphereType) {
    this.scene = scene;
    this.bar = scene.add
      .image(SPHERE_STOCK_LEFT + 11 + 40, SPHERE_STOCK_TOP + 4 + 6 * type, 'sphereStockBar', type)
      .setDepth(DEPTH_UI);
    this.mask = scene.add.rectangle(this.bar.x + 40, this.bar.y, 80, 4, 0x000000).setDepth(DEPTH_UI);
    this.mask.setOrigin(1, 0.5);
    this.text = scene.add
      .bitmapText(SPHERE_STOCK_LEFT + 94, SPHERE_STOCK_TOP + 1 + 6 * type, 'numbers', '')
      .setTint(TINT_CREAM)
      .setDepth(DEPTH_UI);

    this.setCount(0);
  }

  modCount(count: number) {
    this.setCount(this.count + count);
  }

  setCount(count: number) {
    this.count = Math.min(count, 40);
    this.mask.setDisplaySize((40 - count) * 2, 4);
    this.text.setText(`${count}`);
  }

  async animateModCount(count: number) {
    return this.animateSetCount(Math.min(this.count + count, 40));
  }

  async animateSetCount(count: number) {
    await Promise.all([
      asyncTween(this.scene, {
        targets: [this.mask],
        displayWidth: (40 - count) * 2,
        duration: 400,
      }),
      (async () => {
        this.text.setTint(0x3f3e47);
        await wait(this.scene, 100);
        this.text.setText(`${count}`);
        await wait(this.scene, 100);
        this.text.setTint(TINT_CREAM);
      })(),
    ]);

    this.count = count;
  }
}

class StartActionChoiceState extends State {
  async handleEntered(scene: BattleScene) {
    const fadeTweens = [scene.enemySkelly.animateFaded(true)];
    for (const character of scene.characterOrder.slice(1)) {
      fadeTweens.push(scene.party[character].animateFaded(true));
    }
    await Promise.all(fadeTweens);

    this.transition('actionChoice', 0);
  }
}

enum BattleActions {
  Attack = 'attack',
  Defend = 'defend',
}

class ActionChoiceState extends State {
  menu!: Menu;
  characterIndex!: number;
  character!: Characters;
  partyMember!: PartyMember;

  static actionSpriteIndex = {
    [BattleActions.Defend]: 0,
    [BattleActions.Attack]: 9,
  };

  static preload(scene: BattleScene) {
    scene.load.spritesheet('battleActions', 'ui/battle_actions.png', { frameWidth: 22, frameHeight: 20 });
  }

  static create(scene: BattleScene) {
    for (const battleAction of Object.values(BattleActions)) {
      const index = ActionChoiceState.actionSpriteIndex[battleAction];
      scene.anims.create({
        key: `battleActionAppear[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index, index + 1, index + 2],
        }),
      });
      scene.anims.create({
        key: `battleActionSelect[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index + 4, index + 8, index + 3],
        }),
      });
      scene.anims.create({
        key: `battleActionDisappearSelected[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index + 5, index + 6, index + 7],
        }),
      });
      scene.anims.create({
        key: `battleActionDisappearUnselected[${battleAction}]`,
        frameRate: 10,
        frames: scene.anims.generateFrameNumbers('battleActions', {
          frames: [index, index + 6, index + 7],
        }),
      });
    }
  }

  init(scene: BattleScene) {
    scene.actionSprites = {} as typeof scene.actionSprites;
    for (const character of scene.characterOrder) {
      const partyMember = scene.party[character];
      scene.actionSprites[character] = {
        [BattleActions.Defend]: scene.add.sprite(
          partyMember.sprite.x - 26,
          partyMember.sprite.y + 8,
          'battleActions',
          1
        ),
        [BattleActions.Attack]: scene.add.sprite(
          partyMember.sprite.x + 26,
          partyMember.sprite.y + 8,
          'battleActions',
          9
        ),
      };
    }

    const allSprites = Object.values(scene.actionSprites).flatMap((actionMap) => Object.values(actionMap));
    for (const sprite of allSprites) {
      sprite.setVisible(false);
    }

    this.menu = new Menu(scene, horizontalMenuItems([{ key: BattleActions.Defend }, { key: BattleActions.Attack }]));
    this.menu.pauseInput();
    this.menu.on('focus', (cursor: string) => {
      // Only play sound for user-initiated focus
      if (!this.menu.inputPaused) {
        scene.soundMoveCursor.play();
      }

      for (const [key, sprite] of Object.entries(scene.actionSprites[this.character])) {
        sprite.setFrame(ActionChoiceState.actionSpriteIndex[key as BattleActions] + (key === cursor ? 3 : 2));
      }
    });
    this.menu.on('select', (cursor: string) => {
      this.menu.pauseInput();

      scene.currentTurnInputs[this.character] = cursor as BattleActions;

      scene.soundSelect.play();
      for (const [key, sprite] of Object.entries(scene.actionSprites[this.character])) {
        if (key === cursor) {
          sprite.play(`battleActionSelect[${key}]`);
        } else {
          sprite.play({ key: `battleActionDisappearUnselected[${key}]`, hideOnComplete: true });
        }
      }
      this.partyMember.animateFaded(true);

      if (this.characterIndex < scene.characterOrder.length - 1) {
        this.transition('actionChoice', this.characterIndex + 1);
      } else {
        this.transition('movePhase');
      }
    });
  }

  async handleEntered(scene: BattleScene, characterIndex: number) {
    this.characterIndex = characterIndex;
    this.character = scene.characterOrder[characterIndex];
    this.partyMember = scene.party[this.character];

    // Reset choices if new turn
    if (characterIndex === 0) {
      scene.currentTurnInputs = {} as TurnInputs;
    }

    scene.soundActionAppear.play();

    const animations: Promise<any>[] = [this.partyMember.animateFaded(false)];
    for (const action of [BattleActions.Defend, BattleActions.Attack]) {
      const sprite = scene.actionSprites[this.character][action];
      animations.push(asyncAnimation(sprite, `battleActionAppear[${action}]`));
      sprite.setVisible(true);
      await wait(scene, 100);
    }
    await Promise.all(animations);

    this.menu.moveCursorTo(BattleActions.Attack);
    this.menu.resumeInput();
  }

  execute() {
    this.menu.update();
  }
}

class MovePhaseState extends State {
  scene!: BattleScene;
  cursor!: Phaser.GameObjects.Sprite;
  cursorX!: number;
  cursorY!: number;

  init(scene: BattleScene) {
    this.scene = scene;
    this.cursor = scene.add.sprite(0, 0, 'battleSpheres', 5).setDepth(DEPTH_UI);
    this.cursorX = 0;
    this.cursorY = 0;
    this.cursor.setVisible(false);

    this.setCursorPos(0, 0);
  }

  setCursorPos(x: number, y: number) {
    this.cursorX = x;
    this.cursorY = y;
    this.cursor.setPosition(SPHERE_WINDOW_LEFT + 9 + x * 14, SPHERE_WINDOW_TOP + 9 + y * 14);
  }

  moveCursor(xDiff: number, yDiff: number) {
    this.scene.soundMoveCursor.play();
    this.setCursorPos(this.cursorX + xDiff, this.cursorY + yDiff);
  }

  handleEntered(scene: BattleScene, toX?: number, toY?: number) {
    scene.tweens.add({
      targets: [scene.battleSphereWindowOverlay],
      alpha: ALPHA_UNFADED,
      duration: 400,
    });
    this.cursor.setVisible(true);

    if (toX !== undefined && toY !== undefined) {
      this.setCursorPos(toX, toY);
    }

    if (scene.keys.space.isDown) {
      return this.transition('swapChoice', this.cursorX, this.cursorY);
    }
  }

  execute(scene: BattleScene) {
    if (justDown(scene.keys.space)) {
      return this.transition('swapChoice', this.cursorX, this.cursorY);
    }
    if (justDown(scene.keys.shift)) {
      return this.transition('solve');
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
    this.fromSphere = scene.getSphere(fromX, fromY)!;
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

    const fromSphere = scene.getSphere(fromX, fromY)!;
    const toSphere = scene.getSphere(toX, toY)!;
    const fromType = fromSphere.type;
    const toType = toSphere.type;

    scene.soundSwap.play();
    await Promise.all([
      asyncAnimation(fromSphere.sprite, `sphereSwapFrom:${toType}:${direction}`),
      asyncAnimation(toSphere.sprite, `sphereSwapTo:${fromType}:${direction}`),
    ]);

    fromSphere.type = toType;
    toSphere.type = fromType;

    fromSphere.deselect();
    toSphere.deselect();

    this.transition('movePhase', toX, toY);
  }
}

function findGroup(scene: BattleScene, sphere: Sphere, visited: Set<number>, group: Sphere[]) {
  for (const direction of DIRECTIONS) {
    const [x, y] = gridMove(sphere.gridX, sphere.gridY, direction);
    const checkSphere = scene.getSphere(x, y);
    if (checkSphere && !visited.has(checkSphere.index) && sphere.type === checkSphere.type) {
      group.push(checkSphere);
      visited.add(checkSphere.index);
      findGroup(scene, checkSphere, visited, group);
    }
  }

  return group;
}

class SolveState extends State {
  async handleEntered(scene: BattleScene) {
    // Find all matched groups
    const visited = new Set<number>();
    const groups: Sphere[][] = [];
    for (const sphere of scene.spheres) {
      if (visited.has(sphere.index)) {
        continue;
      }
      visited.add(sphere.index);
      groups.push(findGroup(scene, sphere, visited, [sphere]));
    }

    // Group matches by type
    const matchGroups = groups.filter((group) => group.length >= 3);
    const matchedByType: Map<SphereType, Sphere[]> = new Map();
    for (const type of SPHERE_TYPES) {
      const spheres = matchGroups.filter((group) => group[0].type === type).flat();
      if (spheres.length > 0) {
        matchedByType.set(type, spheres);
      }
    }

    // If no matches, exit early
    if (matchGroups.flat().length < 1) {
      // TODO: Add bad sound to indicate no matches
      return this.transition('movePhase');
    }

    // Update the battle state first before animations
    for (const [type, spheres] of matchedByType.entries()) {
      scene.battleState.modStockCount(type, spheres.length);
    }

    // Clearing audio
    scene.soundClear.play();

    // Clear spheres
    const clearAnimations: Promise<void>[] = [];
    for (const [type, spheres] of matchedByType.entries()) {
      for (const sphere of spheres) {
        clearAnimations.push(asyncAnimation(sphere.sprite, `sphereClear:${type}`));
      }
      clearAnimations.push(scene.stockCounts[type].animateModCount(spheres.length));
      await wait(scene, 100);
    }
    await Promise.all(clearAnimations);
    for (const sphere of matchGroups.flat()) {
      sphere.type = null;
    }

    // Collapse each column and fill in new spheres
    const refillAnimations: Promise<void>[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const oldColumnTypes: (SphereType | null)[] = [];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        oldColumnTypes.push(scene.getSphere(x, y)!.type);
      }

      // Early exit if nothing changed
      if (!oldColumnTypes.some((type) => type === null)) {
        continue;
      }

      let newColumnTypes: (SphereType | null)[] = oldColumnTypes.filter((type) => type !== null);
      newColumnTypes = [...Array(GRID_HEIGHT - newColumnTypes.length).fill(null), ...newColumnTypes];
      newColumnTypes = newColumnTypes.map((type) => type ?? randomChoice(SPHERE_TYPES));

      const animEnd = oldColumnTypes.findLastIndex((type) => type === null);
      for (let y = 0; y <= animEnd; y++) {
        const oldType = oldColumnTypes[y];
        const newType = newColumnTypes[y];

        const sphere = scene.getSphere(x, y)!;
        sphere.type = newType;

        let refillAnimationKey = 'sphereRefillMiddle';
        if (y === 0) {
          refillAnimationKey = 'sphereRefillTop';
        } else if (y === animEnd) {
          refillAnimationKey = 'sphereRefillBottom';
        }
        refillAnimations.push(asyncAnimation(sphere.sprite, `${refillAnimationKey}:${oldType}:${newType}`));
      }
    }
    await Promise.all(refillAnimations);

    // DEBUG: Reset in case the visuals don't match
    for (const sphere of scene.spheres) {
      sphere.sprite.setFrame(sphere.type ?? Sphere.EMPTY_FRAME);
    }

    return this.transition('turnResult');
  }
}

interface DamageAnimation {
  damage: Phaser.Types.Math.Vector2Like[];
  highlight: Phaser.Types.Math.Vector2Like[];
}

const DamageAnimations: { [key: string]: DamageAnimation } = {
  TO_ENEMY: {
    damage: [{ x: -15, y: 5 }, { x: -8, y: -3 }, { x: -6, y: 5 }, { x: -3, y: -2 }, { x: -1, y: 1 }, {}],
    highlight: [{ x: -14, y: 6 }, { x: -6, y: -1 }, { x: -4, y: 5 }, { x: -1, y: 1 }, { x: 1, y: 2 }, {}],
  },
  TO_PARTY: {
    damage: [{ x: -1, y: -3 }, { x: 2, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: -1 }, {}],
    highlight: [{ x: 3, y: 0 }, { x: 1, y: -2 }, {}, { x: 0, y: -1 }, { x: 0, y: -1 }, {}],
  },
};

class DamageNumber {
  scene: BaseScene;
  x: number;
  y: number;
  damageSprite: Phaser.GameObjects.BitmapText;
  highlightSprite: Phaser.GameObjects.BitmapText;
  borderSprites: Phaser.GameObjects.BitmapText[];

  static appearFrames = [[]];

  constructor(scene: BaseScene, amount: number, color: number, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.borderSprites = [
      [-1, 0],
      [0, -1],
      [1, 0],
      [0, 1],
      [1, 2],
      [2, 1],
    ].map(([xMod, yMod]) =>
      scene.add
        .bitmapText(x + xMod, y + yMod, 'sodapop', amount.toString())
        .setDepth(DEPTH_UI)
        .setVisible(false)
        .setTint(0x000000)
    );
    this.highlightSprite = scene.add
      .bitmapText(x + 1, y + 1, 'sodapop', amount.toString())
      .setDepth(DEPTH_UI)
      .setVisible(false)
      .setTint(color);
    this.damageSprite = scene.add
      .bitmapText(x, y, 'sodapop', amount.toString())
      .setDepth(DEPTH_UI)
      .setVisible(false)
      .setTint(TINT_CREAM);
  }

  async animateAppear(animation: DamageAnimation) {
    // Manual animation because abstracting this is just too annoying right now without a much better animation
    // abstraction.
    this.highlightSprite.setVisible(true).setPosition(this.x + 1, this.y + 1);
    this.damageSprite.setVisible(true).setPosition(this.x, this.y);

    await Promise.all([
      relativePositionTween(this.scene, [this.damageSprite], animation.damage, 75),
      relativePositionTween(this.scene, [this.highlightSprite], animation.highlight, 75),
    ]);

    for (const sprite of this.borderSprites) {
      sprite.setVisible(true);
    }
  }

  async animateDestroy() {
    this.damageSprite.destroy();
    this.highlightSprite.setPosition(this.highlightSprite.x + 1, this.highlightSprite.y);
    for (const sprite of this.borderSprites) {
      sprite.setPosition(sprite.x + 1, sprite.y);
    }
    await wait(this.scene, 75);

    this.highlightSprite.destroy();
    for (const sprite of this.borderSprites) {
      sprite.destroy();
    }
  }
}

class TurnResultPhaseState extends State {
  async handleEntered(scene: BattleScene) {
    const hideAnimations = [
      asyncTween(scene, {
        targets: [scene.battleSphereWindowOverlay],
        alpha: ALPHA_FADED,
        duration: 400,
      }),
    ];
    for (const character of scene.characterOrder) {
      const battleAction = scene.currentTurnInputs[character];
      hideAnimations.push(
        asyncAnimation(scene.actionSprites[character][battleAction], {
          key: `battleActionDisappearSelected[${battleAction}]`,
          hideOnComplete: true,
        })
      );
    }
    await Promise.all(hideAnimations);

    const fadeInAnimations = [scene.enemySkelly.animateFaded(false)];
    for (const partyMember of Object.values(scene.party)) {
      fadeInAnimations.push(partyMember.animateFaded(false));
    }
    await Promise.all(fadeInAnimations);

    const { partyActionResults, enemyActionResult, stockCounts } = (scene.currentTurnResult =
      scene.battleState.executeTurn(scene.currentTurnInputs));

    // Animate attacks, if needed
    if (Object.values(partyActionResults).some((result) => result?.battleAction === BattleActions.Attack)) {
      await scene.dialog.animateScript('-Attack!', 75, scene.soundText);
      await wait(scene, 100);

      const attackResults = Object.values(partyActionResults).filter(
        (result): result is PartyActionResultAttack => result?.battleAction === BattleActions.Attack
      );

      // Prepare damage numbers for display
      const partyDamageNumbers = attackResults.map(
        ({ character, damage }, index) =>
          new DamageNumber(scene, damage, CHARACTER_COLORS[character], 272 - 3 * index, 82 + 11 * index)
      );

      const attackAnimations: Promise<void>[] = [];
      for (let k = 0; k < attackResults.length; k++) {
        const { character, damage } = attackResults[k];
        attackAnimations.push(
          scene.party[character].animateAttack(() => {
            partyDamageNumbers[k].animateAppear(DamageAnimations.TO_ENEMY);
            scene.healthEnemy.animateDamage(damage, CHARACTER_COLORS[character], false);
            scene.enemySkelly.animateHurt();

            const sphereType = CHARACTER_SPHERE_TYPES[character];
            scene.stockCounts[sphereType].animateSetCount(stockCounts[sphereType]);
            if (k === 0) {
              scene.stockCounts[SphereType.Key].animateSetCount(stockCounts[SphereType.Key]);
            }
          })
        );
        scene.soundPartyAttack[character].play();
        await wait(scene, 600);
      }

      await Promise.all(attackAnimations);
      await wait(scene, 400);
      await Promise.all(partyDamageNumbers.map((damageNumber) => damageNumber.animateDestroy()));
    }

    if (enemyActionResult) {
      const { target, damage } = enemyActionResult;
      await scene.dialog.animateScript('-The <red>Enemy</red> strikes\n  back!', 75, scene.soundText);

      const targetMember = scene.party[target];
      const enemyDamageNumber = new DamageNumber(
        scene,
        damage,
        CHARACTER_COLORS[target],
        targetMember.sprite.x + 16,
        targetMember.sprite.y + 8
      );
      const enemyAttackAnimations: Promise<void>[] = [
        scene.enemySkelly.animateAttack(() => {
          enemyAttackAnimations.push(
            shake(scene, [scene.dialog.box], ShakeAxis.Y, [2, -1, 0], 50),
            shake(scene, [scene.dialog.text], ShakeAxis.Y, [0, 2, -1, 0], 50),
            scene.partyHealth[target].animateDamage(damage),
            scene.party[target].animateHurt(false),
            enemyDamageNumber.animateAppear(DamageAnimations.TO_PARTY)
          );

          if (partyActionResults[target]?.battleAction === BattleActions.Defend) {
            const sphereType = CHARACTER_SPHERE_TYPES[target];
            enemyAttackAnimations.push(
              scene.stockCounts[sphereType].animateSetCount(stockCounts[sphereType]),
              scene.stockCounts[SphereType.Yellow].animateSetCount(stockCounts[SphereType.Yellow])
            );
          }
        }),
        scene.enemySkelly.animateAttackEffect(targetMember.sprite.x, targetMember.sprite.y),
      ];
      scene.soundEnemyAttack.play();

      await Promise.all(enemyAttackAnimations);
      await wait(scene, 400);
      await enemyDamageNumber.animateDestroy();

      scene.dialog.setText('');
      return this.transition('startActionChoice');
    }
  }
}
